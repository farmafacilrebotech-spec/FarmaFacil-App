-- =============================================================================
-- 021_user_legal_acceptances_v1.sql
-- Evidencia legal global por usuario + RPC atómica de primer acceso.
--
-- Alcance:
--   - Tabla user_legal_acceptances (sin pharmacy_id: aceptación de plataforma)
--   - Histórico por (profile_id, terms_version, privacy_version)
--   - RLS: INSERT/SELECT propias; lectura admin platform.users.read/write
--   - Sin UPDATE/DELETE de negocio
--   - RPC ff_complete_pharmacy_first_access_v1: evidencia + activación
--     en UNA sola transacción PostgreSQL
--
-- No debilita ni elimina ff_accept_pharmacy_invitation_v1.
-- =============================================================================

CREATE TABLE public.user_legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  accepted_terms_at timestamptz NOT NULL,
  privacy_acknowledged_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_legal_acceptances_terms_version_not_blank_chk
    CHECK (length(btrim(terms_version)) > 0),
  CONSTRAINT user_legal_acceptances_privacy_version_not_blank_chk
    CHECK (length(btrim(privacy_version)) > 0),
  CONSTRAINT user_legal_acceptances_profile_versions_key
    UNIQUE (profile_id, terms_version, privacy_version)
);

COMMENT ON TABLE public.user_legal_acceptances IS
  'Aceptaciones legales globales del usuario FarmaFácil. Histórico por versión. Inmutable en app.';
COMMENT ON COLUMN public.user_legal_acceptances.terms_version IS
  'Versión de Términos aceptada (p. ej. 1.0). Nueva versión = nueva fila.';
COMMENT ON COLUMN public.user_legal_acceptances.privacy_version IS
  'Versión de Política de Privacidad leída/reconocida.';
COMMENT ON COLUMN public.user_legal_acceptances.accepted_terms_at IS
  'Momento server-side de aceptación de términos.';
COMMENT ON COLUMN public.user_legal_acceptances.privacy_acknowledged_at IS
  'Momento server-side de reconocimiento de la política de privacidad.';

CREATE INDEX user_legal_acceptances_profile_id_idx
  ON public.user_legal_acceptances (profile_id);

CREATE INDEX user_legal_acceptances_profile_created_idx
  ON public.user_legal_acceptances (profile_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_legal_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_legal_acceptances_select ON public.user_legal_acceptances
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    OR public.ff_has_platform_permission('platform.users.read')
    OR public.ff_has_platform_permission('platform.users.write')
  );

CREATE POLICY user_legal_acceptances_insert ON public.user_legal_acceptances
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT auth.uid())
  );

-- Sin policies UPDATE/DELETE: la evidencia no se altera ni borra desde la app.

GRANT SELECT, INSERT ON TABLE public.user_legal_acceptances TO authenticated;

-- =============================================================================
-- RPC: primer acceso atómico (evidencia legal + membership invited→active)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ff_complete_pharmacy_first_access_v1(
  p_terms_version text,
  p_privacy_version text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_count integer;
  v_membership_id uuid;
  v_pharmacy_id uuid;
  v_now timestamptz := pg_catalog.now();
  v_profile_exists boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF p_terms_version IS NULL OR length(btrim(p_terms_version)) = 0 THEN
    RAISE EXCEPTION 'terms_version_required'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_privacy_version IS NULL OR length(btrim(p_privacy_version)) = 0 THEN
    RAISE EXCEPTION 'privacy_version_required'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = v_uid
  )
    INTO v_profile_exists;

  IF NOT v_profile_exists THEN
    RAISE EXCEPTION 'profile_not_found'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Mismas restricciones que ff_accept_pharmacy_invitation_v1:
  -- exactamente una membership invited del propio usuario.
  SELECT count(*)::integer
    INTO v_count
  FROM public.pharmacy_memberships m
  WHERE m.profile_id = v_uid
    AND m.status = 'invited';

  IF v_count = 0 THEN
    RETURN jsonb_build_object('status', 'no_pending');
  END IF;

  IF v_count > 1 THEN
    RETURN jsonb_build_object(
      'status', 'multiple_pending',
      'count', v_count
    );
  END IF;

  -- Evidencia legal (idempotente para el mismo par de versiones).
  INSERT INTO public.user_legal_acceptances AS ula (
    profile_id,
    terms_version,
    privacy_version,
    accepted_terms_at,
    privacy_acknowledged_at
  )
  VALUES (
    v_uid,
    btrim(p_terms_version),
    btrim(p_privacy_version),
    v_now,
    v_now
  )
  ON CONFLICT (profile_id, terms_version, privacy_version)
  DO NOTHING;

  -- Activación membership. Si falla tras el INSERT → RAISE = rollback de evidencia.
  UPDATE public.pharmacy_memberships m
  SET
    status = 'active',
    accepted_at = v_now,
    updated_by = v_uid,
    updated_at = v_now
  WHERE m.profile_id = v_uid
    AND m.status = 'invited'
  RETURNING m.id, m.pharmacy_id
  INTO v_membership_id, v_pharmacy_id;

  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'membership_activation_failed'
      USING ERRCODE = 'no_data_found';
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'membership_id', v_membership_id,
    'pharmacy_id', v_pharmacy_id
  );
END;
$$;

COMMENT ON FUNCTION public.ff_complete_pharmacy_first_access_v1(text, text) IS
  'Primer acceso atómico: registra aceptación legal (versiones) + invited→active del auth.uid(). Sin parámetros de usuario/farmacia. Rollback conjunto si falla la activación.';

REVOKE ALL ON FUNCTION public.ff_complete_pharmacy_first_access_v1(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ff_complete_pharmacy_first_access_v1(text, text) TO authenticated;

-- =============================================================================
-- Down (manual):
-- REVOKE ALL ON FUNCTION public.ff_complete_pharmacy_first_access_v1(text, text) FROM authenticated;
-- DROP FUNCTION IF EXISTS public.ff_complete_pharmacy_first_access_v1(text, text);
-- REVOKE ALL ON TABLE public.user_legal_acceptances FROM authenticated;
-- DROP POLICY IF EXISTS user_legal_acceptances_insert ON public.user_legal_acceptances;
-- DROP POLICY IF EXISTS user_legal_acceptances_select ON public.user_legal_acceptances;
-- DROP TABLE IF EXISTS public.user_legal_acceptances;
-- =============================================================================
