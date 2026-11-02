-- =============================================================================
-- 067_customer_saved_pharmacies_v1.sql
-- «Mis farmacias»: relación explícita cliente ↔ farmacia (QR /e/{public_id}).
--
-- - No se crea al visitar/escanear el QR; solo vía acción consciente.
-- - No borra pedidos ni cuenta al quitar una farmacia guardada.
-- - No enlaza solicitudes de invitado automáticamente.
-- - pharmacy_id no se expone en el resolve público 044; se resuelve en RPCs.
--
-- NO APLICAR en producción sin autorización expresa.
-- Depende de: 003, 006, 009, 042, 044, 064.
-- Numeración: 067 (066 = historial errores kiosko; 068 = compras kioskos).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.customer_saved_pharmacies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE CASCADE,
  pharmacy_id uuid NOT NULL
    REFERENCES public.pharmacies (id) ON DELETE CASCADE,
  -- public_id del entrypoint pharmacy_home usado al guardar (deep-link /e/…).
  public_id text NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT customer_saved_pharmacies_public_id_format_chk CHECK (
    public_id ~ '^[a-z0-9][a-z0-9\-]{2,63}$'
  ),
  CONSTRAINT customer_saved_pharmacies_profile_pharmacy_uidx
    UNIQUE (profile_id, pharmacy_id)
);

COMMENT ON TABLE public.customer_saved_pharmacies IS
  'Farmacias guardadas explícitamente por cuentas customer. Aislado por RLS; sin backfill desde visitas QR.';

CREATE INDEX IF NOT EXISTS customer_saved_pharmacies_profile_saved_idx
  ON public.customer_saved_pharmacies (profile_id, saved_at DESC);

CREATE INDEX IF NOT EXISTS customer_saved_pharmacies_public_id_idx
  ON public.customer_saved_pharmacies (profile_id, public_id);

ALTER TABLE public.customer_saved_pharmacies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_saved_pharmacies_select_own
  ON public.customer_saved_pharmacies;
CREATE POLICY customer_saved_pharmacies_select_own
  ON public.customer_saved_pharmacies
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.account_kind = 'customer'
    )
  );

DROP POLICY IF EXISTS customer_saved_pharmacies_delete_own
  ON public.customer_saved_pharmacies;
CREATE POLICY customer_saved_pharmacies_delete_own
  ON public.customer_saved_pharmacies
  FOR DELETE TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.account_kind = 'customer'
    )
  );

-- Altas solo vía RPC DEFINER (resuelve public_id → pharmacy_id sin filtrar UUID).
REVOKE ALL ON public.customer_saved_pharmacies FROM PUBLIC;
GRANT SELECT, DELETE ON public.customer_saved_pharmacies TO authenticated;
GRANT ALL ON public.customer_saved_pharmacies TO service_role;

-- -----------------------------------------------------------------------------
-- Guardar por public_id del QR
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_customer_save_pharmacy_v1(p_public_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id text;
  v_ep public.public_entrypoints%ROWTYPE;
  v_name text;
  v_row_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND p.account_kind = 'customer'
  ) THEN
    RETURN jsonb_build_object('status', 'not_customer');
  END IF;

  v_id := lower(btrim(COALESCE(p_public_id, '')));
  IF v_id = '' OR v_id !~ '^[a-z0-9][a-z0-9\-]{2,63}$' THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT * INTO v_ep
  FROM public.public_entrypoints pe
  WHERE pe.public_id = v_id
    AND pe.purpose = 'pharmacy_home'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_ep.is_active IS NOT TRUE
     OR (v_ep.expires_at IS NOT NULL AND v_ep.expires_at <= pg_catalog.now()) THEN
    RETURN jsonb_build_object('status', 'inactive');
  END IF;

  SELECT p.name INTO v_name
  FROM public.pharmacies p
  WHERE p.id = v_ep.pharmacy_id;

  IF v_name IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  INSERT INTO public.customer_saved_pharmacies (
    profile_id, pharmacy_id, public_id
  )
  VALUES (v_uid, v_ep.pharmacy_id, v_ep.public_id)
  ON CONFLICT (profile_id, pharmacy_id) DO UPDATE
  SET public_id = EXCLUDED.public_id
  RETURNING id INTO v_row_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'id', v_row_id,
    'pharmacy_id', v_ep.pharmacy_id,
    'public_id', v_ep.public_id,
    'pharmacy_name', v_name
  );
END;
$$;

COMMENT ON FUNCTION public.ff_customer_save_pharmacy_v1(text) IS
  'Guarda una farmacia en Mis farmacias a partir del public_id del QR. Idempotente.';

REVOKE ALL ON FUNCTION public.ff_customer_save_pharmacy_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_customer_save_pharmacy_v1(text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Quitar (por public_id o pharmacy_id)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_customer_unsave_pharmacy_v1(
  p_public_id text DEFAULT NULL,
  p_pharmacy_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deleted int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND p.account_kind = 'customer'
  ) THEN
    RETURN jsonb_build_object('status', 'not_customer');
  END IF;

  IF p_pharmacy_id IS NOT NULL THEN
    DELETE FROM public.customer_saved_pharmacies
    WHERE profile_id = v_uid AND pharmacy_id = p_pharmacy_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  ELSIF p_public_id IS NOT NULL AND btrim(p_public_id) <> '' THEN
    DELETE FROM public.customer_saved_pharmacies
    WHERE profile_id = v_uid
      AND public_id = lower(btrim(p_public_id));
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  ELSE
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'removed', v_deleted > 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ff_customer_unsave_pharmacy_v1(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_customer_unsave_pharmacy_v1(text, uuid)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Listado con nombre (sin abrir SELECT global de pharmacies al cliente)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_customer_list_saved_pharmacies_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND p.account_kind = 'customer'
  ) THEN
    RETURN jsonb_build_object('status', 'not_customer');
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'items', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'pharmacy_id', s.pharmacy_id,
            'public_id', s.public_id,
            'pharmacy_name', p.name,
            'saved_at', s.saved_at
          )
          ORDER BY s.saved_at DESC
        )
        FROM public.customer_saved_pharmacies s
        INNER JOIN public.pharmacies p ON p.id = s.pharmacy_id
        WHERE s.profile_id = v_uid
      ),
      '[]'::jsonb
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ff_customer_list_saved_pharmacies_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_customer_list_saved_pharmacies_v1()
  TO authenticated, service_role;

-- DOWN (desarrollo):
-- DROP FUNCTION IF EXISTS public.ff_customer_list_saved_pharmacies_v1();
-- DROP FUNCTION IF EXISTS public.ff_customer_unsave_pharmacy_v1(text, uuid);
-- DROP FUNCTION IF EXISTS public.ff_customer_save_pharmacy_v1(text);
-- DROP TABLE IF EXISTS public.customer_saved_pharmacies;
