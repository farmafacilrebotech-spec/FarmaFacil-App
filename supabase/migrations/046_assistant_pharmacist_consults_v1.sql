-- =============================================================================
-- 046_assistant_pharmacist_consults_v1.sql
-- Consultas kiosko → farmacéutico (+ estructura preparada para customer_portal).
--
-- Guarda SOLO mensaje del cliente y respuesta del farmacéutico (sin OpenAI).
--
-- Caducidad / conservación (pruebas iniciales; política definitiva pendiente):
--   expires_at   = +2h   → fin de entrega al kiosko
--   retain_until = +7d   → conservación en dashboard (pruebas)
--   purge RPC            → eliminación física (NO cron automático en esta migración)
--
-- Seguridad (correcciones auditoría B1/B2/B3):
--   B1: turno de cliente (token aleatorio hasheado); poll exige turno activo.
--   B2: helper interno consults_enabled SIN EXECUTE a anon/authenticated.
--   B3: rate-limit por turno / dispositivo / farmacia (atómico).
--
-- Canal:
--   channel = 'kiosk' | 'customer_portal'
--   Portal: columnas preparadas; sin RPCs de portal en esta migración.
--
-- NO APLICAR automáticamente. Depende de: 004, 011, 034–038, 045.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Permisos del módulo assistant_ai
-- -----------------------------------------------------------------------------
INSERT INTO public.permissions (key, module_key, description)
VALUES
  (
    'assistant.consults.view',
    'assistant_ai',
    'Ver consultas al farmacéutico enviadas desde el kiosko u otros canales'
  ),
  (
    'assistant.consults.manage',
    'assistant_ai',
    'Responder y resolver consultas al farmacéutico'
  )
ON CONFLICT (key) DO UPDATE
SET
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key IN (
  'PHARMACY_OWNER',
  'PHARMACY_ADMIN',
  'PHARMACIST',
  'STAFF'
)
  AND p.key = 'assistant.consults.view'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key IN (
  'PHARMACY_OWNER',
  'PHARMACY_ADMIN',
  'PHARMACIST'
)
  AND p.key = 'assistant.consults.manage'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2) Contador de códigos visibles por farmacia
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacy_assistant_consult_counters (
  pharmacy_id uuid PRIMARY KEY
    REFERENCES public.pharmacies (id) ON DELETE CASCADE,
  last_number bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT pharmacy_assistant_consult_counters_nonneg_chk CHECK (last_number >= 0)
);

COMMENT ON TABLE public.pharmacy_assistant_consult_counters IS
  'Secuencia de códigos de consulta al farmacéutico por farmacia.';

ALTER TABLE public.pharmacy_assistant_consult_counters ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3) Turnos de cliente (B1) — kiosko ahora; portal preparado
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacy_assistant_client_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL
    REFERENCES public.pharmacies (id) ON DELETE RESTRICT,
  channel text NOT NULL,
  -- Kiosko
  device_id uuid
    REFERENCES public.pharmacy_devices (id) ON DELETE RESTRICT,
  device_session_id uuid
    REFERENCES public.pharmacy_device_sessions (id) ON DELETE RESTRICT,
  -- Portal (futuro): identidad autenticada; NUNCA confiar en UUID del navegador sin auth.uid()
  customer_profile_id uuid
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  -- Token en claro NUNCA se guarda; solo digest.
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT pharmacy_assistant_client_turns_channel_chk CHECK (
    channel = ANY (ARRAY['kiosk', 'customer_portal'])
  ),
  CONSTRAINT pharmacy_assistant_client_turns_status_chk CHECK (
    status = ANY (ARRAY['active', 'revoked', 'expired'])
  ),
  CONSTRAINT pharmacy_assistant_client_turns_token_hash_chk CHECK (
    length(btrim(token_hash)) = 64
  ),
  CONSTRAINT pharmacy_assistant_client_turns_token_hash_uid UNIQUE (token_hash),
  CONSTRAINT pharmacy_assistant_client_turns_channel_shape_chk CHECK (
    (
      channel = 'kiosk'
      AND device_id IS NOT NULL
      AND device_session_id IS NOT NULL
      AND customer_profile_id IS NULL
    )
    OR (
      channel = 'customer_portal'
      AND customer_profile_id IS NOT NULL
      AND device_id IS NULL
      AND device_session_id IS NULL
    )
  )
);

COMMENT ON TABLE public.pharmacy_assistant_client_turns IS
  'Turno de cliente para autorizar create/poll de consultas. Token solo como hash.';
COMMENT ON COLUMN public.pharmacy_assistant_client_turns.token_hash IS
  'SHA-256 hex (64) del token de turno; nunca loguear el token en claro.';

CREATE INDEX IF NOT EXISTS pharmacy_assistant_client_turns_session_idx
  ON public.pharmacy_assistant_client_turns (device_session_id, status, created_at DESC)
  WHERE device_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pharmacy_assistant_client_turns_pharmacy_idx
  ON public.pharmacy_assistant_client_turns (pharmacy_id, created_at DESC);

CREATE TRIGGER pharmacy_assistant_client_turns_set_updated_at
  BEFORE UPDATE ON public.pharmacy_assistant_client_turns
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

ALTER TABLE public.pharmacy_assistant_client_turns ENABLE ROW LEVEL SECURITY;
-- Sin policies ni GRANT a clientes: solo DEFINER / service_role.

-- -----------------------------------------------------------------------------
-- 4) Tabla única de consultas (multicanal)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacy_assistant_consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL
    REFERENCES public.pharmacies (id) ON DELETE RESTRICT,
  channel text NOT NULL DEFAULT 'kiosk',
  client_turn_id uuid NOT NULL
    REFERENCES public.pharmacy_assistant_client_turns (id) ON DELETE RESTRICT,
  -- Kiosko
  device_id uuid
    REFERENCES public.pharmacy_devices (id) ON DELETE RESTRICT,
  device_session_id uuid
    REFERENCES public.pharmacy_device_sessions (id) ON DELETE RESTRICT,
  -- Portal (futuro)
  customer_profile_id uuid
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  consult_number bigint NOT NULL,
  display_code text NOT NULL,
  client_message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  pharmacist_reply text,
  answered_by uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  answered_at timestamptz,
  resolved_by uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  resolved_at timestamptz,
  client_request_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  retain_until timestamptz NOT NULL,
  kiosk_delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT pharmacy_assistant_consultations_channel_chk CHECK (
    channel = ANY (ARRAY['kiosk', 'customer_portal'])
  ),
  CONSTRAINT pharmacy_assistant_consultations_status_chk CHECK (
    status = ANY (ARRAY['pending', 'answered', 'resolved', 'expired'])
  ),
  CONSTRAINT pharmacy_assistant_consultations_number_positive_chk CHECK (
    consult_number > 0
  ),
  CONSTRAINT pharmacy_assistant_consultations_display_not_blank_chk CHECK (
    length(btrim(display_code)) > 0
    AND length(btrim(display_code)) <= 32
  ),
  CONSTRAINT pharmacy_assistant_consultations_message_chk CHECK (
    length(btrim(client_message)) > 0
    AND length(client_message) <= 500
  ),
  CONSTRAINT pharmacy_assistant_consultations_reply_chk CHECK (
    pharmacist_reply IS NULL
    OR (
      length(btrim(pharmacist_reply)) > 0
      AND length(pharmacist_reply) <= 2000
    )
  ),
  CONSTRAINT pharmacy_assistant_consultations_client_request_chk CHECK (
    length(btrim(client_request_id)) > 0
    AND length(btrim(client_request_id)) <= 128
  ),
  CONSTRAINT pharmacy_assistant_consultations_channel_shape_chk CHECK (
    (
      channel = 'kiosk'
      AND device_id IS NOT NULL
      AND device_session_id IS NOT NULL
      AND customer_profile_id IS NULL
    )
    OR (
      channel = 'customer_portal'
      AND customer_profile_id IS NOT NULL
      AND device_id IS NULL
      AND device_session_id IS NULL
    )
  ),
  CONSTRAINT pharmacy_assistant_consultations_pharmacy_number_uid
    UNIQUE (pharmacy_id, consult_number),
  CONSTRAINT pharmacy_assistant_consultations_pharmacy_request_uid
    UNIQUE (pharmacy_id, client_request_id)
);

COMMENT ON TABLE public.pharmacy_assistant_consultations IS
  'Bandeja única de consultas (kiosk | customer_portal). Sin historial OpenAI.';
COMMENT ON COLUMN public.pharmacy_assistant_consultations.expires_at IS
  'Fin de ventana de entrega al canal de origen (kiosko: 2h).';
COMMENT ON COLUMN public.pharmacy_assistant_consultations.retain_until IS
  'Conservación en dashboard (pruebas: 7 días). Purga física diferida.';
COMMENT ON COLUMN public.pharmacy_assistant_consultations.channel IS
  'Origen: kiosk o customer_portal (portal sin RPCs aún).';

CREATE INDEX IF NOT EXISTS pharmacy_assistant_consultations_pharmacy_created_idx
  ON public.pharmacy_assistant_consultations (pharmacy_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pharmacy_assistant_consultations_pharmacy_status_idx
  ON public.pharmacy_assistant_consultations (pharmacy_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS pharmacy_assistant_consultations_channel_idx
  ON public.pharmacy_assistant_consultations (pharmacy_id, channel, created_at DESC);

CREATE INDEX IF NOT EXISTS pharmacy_assistant_consultations_turn_idx
  ON public.pharmacy_assistant_consultations (client_turn_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pharmacy_assistant_consultations_session_idx
  ON public.pharmacy_assistant_consultations (device_session_id, created_at DESC)
  WHERE device_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pharmacy_assistant_consultations_retain_idx
  ON public.pharmacy_assistant_consultations (retain_until);

CREATE INDEX IF NOT EXISTS pharmacy_assistant_consultations_device_created_idx
  ON public.pharmacy_assistant_consultations (device_id, created_at DESC)
  WHERE device_id IS NOT NULL;

CREATE TRIGGER pharmacy_assistant_consultations_set_updated_at
  BEFORE UPDATE ON public.pharmacy_assistant_consultations
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

-- -----------------------------------------------------------------------------
-- 5) RLS consultas (staff / plataforma)
-- -----------------------------------------------------------------------------
ALTER TABLE public.pharmacy_assistant_consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY pharmacy_assistant_consultations_select
  ON public.pharmacy_assistant_consultations
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.read')
    OR public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_can_read_pharmacy_operational(pharmacy_id)
      AND public.ff_has_pharmacy_permission(pharmacy_id, 'assistant.consults.view')
    )
  );

-- Futuro portal: política adicional basada en auth.uid() = customer_profile_id
-- y pertenencia autorizada a la farmacia. NO activar hasta implementar portal.
-- Ejemplo (NO aplicar ahora):
--   OR (channel = 'customer_portal' AND customer_profile_id = auth.uid() ...)

GRANT SELECT ON TABLE public.pharmacy_assistant_consultations TO authenticated;

-- -----------------------------------------------------------------------------
-- 6) Helper interno: ¿consultas digitales habilitadas? (B2: sin EXECUTE público)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_pharmacy_assistant_consults_enabled(
  p_pharmacy_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_ent record;
  v_settings public.pharmacy_assistant_settings%ROWTYPE;
  v_mode text;
  v_flag boolean;
BEGIN
  IF p_pharmacy_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.ff_pharmacy_has_module(p_pharmacy_id, 'assistant_ai') THEN
    RETURN false;
  END IF;

  SELECT pe.status, pe.config
  INTO v_ent
  FROM public.pharmacy_entitlements pe
  INNER JOIN public.modules m ON m.id = pe.module_id
  WHERE pe.pharmacy_id = p_pharmacy_id
    AND m.key = 'assistant_ai'
  LIMIT 1;

  IF NOT FOUND OR v_ent.status NOT IN ('trial', 'active') THEN
    RETURN false;
  END IF;

  v_mode := coalesce(v_ent.config->>'mode', 'off');
  IF v_mode IS DISTINCT FROM 'contracted' THEN
    RETURN false;
  END IF;

  SELECT * INTO v_settings
  FROM public.pharmacy_assistant_settings s
  WHERE s.pharmacy_id = p_pharmacy_id;

  v_flag := coalesce(
    (v_ent.config->>'pharmacist_consult_enabled')::boolean,
    coalesce(v_settings.pharmacist_consult_enabled, false)
  );

  RETURN v_flag IS TRUE;
END;
$$;

COMMENT ON FUNCTION public.ff_pharmacy_assistant_consults_enabled(uuid) IS
  'INTERNO: True si assistant_ai contratado + pharmacist_consult_enabled. Sin EXECUTE a clientes.';

REVOKE ALL ON FUNCTION public.ff_pharmacy_assistant_consults_enabled(uuid) FROM PUBLIC;
-- B2: no GRANT a anon ni authenticated. Solo el owner DEFINER / service_role.
GRANT EXECUTE ON FUNCTION public.ff_pharmacy_assistant_consults_enabled(uuid)
  TO service_role;

-- -----------------------------------------------------------------------------
-- 7) Helper interno: asegurar / validar turno kiosko (B1)
-- El cliente envía SHA-256 hex del token (64 chars). El plaintext NUNCA llega a SQL.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_assistant_ensure_client_turn_(
  p_pharmacy_id uuid,
  p_device_id uuid,
  p_session_id uuid,
  p_turn_token_hash text
)
RETURNS TABLE (
  out_status text,
  out_turn_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_hash text := lower(btrim(coalesce(p_turn_token_hash, '')));
  v_turn public.pharmacy_assistant_client_turns%ROWTYPE;
BEGIN
  IF v_hash !~ '^[0-9a-f]{64}$' THEN
    out_status := 'invalid_turn';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_turn
  FROM public.pharmacy_assistant_client_turns t
  WHERE t.token_hash = v_hash
  FOR UPDATE;

  IF FOUND THEN
    IF v_turn.status IS DISTINCT FROM 'active'
       OR v_turn.expires_at <= pg_catalog.now() THEN
      IF v_turn.status = 'active' THEN
        UPDATE public.pharmacy_assistant_client_turns
        SET status = 'expired',
            revoked_at = coalesce(revoked_at, pg_catalog.now())
        WHERE id = v_turn.id;
      END IF;
      out_status := 'turn_revoked';
      RETURN NEXT;
      RETURN;
    END IF;

    IF v_turn.channel IS DISTINCT FROM 'kiosk'
       OR v_turn.pharmacy_id IS DISTINCT FROM p_pharmacy_id
       OR v_turn.device_id IS DISTINCT FROM p_device_id
       OR v_turn.device_session_id IS DISTINCT FROM p_session_id THEN
      out_status := 'turn_mismatch';
      RETURN NEXT;
      RETURN;
    END IF;

    out_status := 'ok';
    out_turn_id := v_turn.id;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.pharmacy_assistant_client_turns (
    pharmacy_id,
    channel,
    device_id,
    device_session_id,
    token_hash,
    status,
    expires_at
  ) VALUES (
    p_pharmacy_id,
    'kiosk',
    p_device_id,
    p_session_id,
    v_hash,
    'active',
    pg_catalog.now() + interval '3 hours'
  )
  RETURNING id INTO out_turn_id;

  out_status := 'ok';
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.ff_kiosk_assistant_ensure_client_turn_(uuid, uuid, uuid, text) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 8) Kiosko: abandonar / invalidar turno (B1)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_assistant_abandon_client_turn_v1(
  p_credential_hash text,
  p_turn_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sess record;
  v_hash text := lower(btrim(coalesce(p_turn_token_hash, '')));
  v_turn public.pharmacy_assistant_client_turns%ROWTYPE;
BEGIN
  SELECT * INTO v_sess
  FROM public.ff_kiosk_assistant_resolve_session_(p_credential_hash);

  IF v_sess.out_status IS DISTINCT FROM 'ok'
     AND v_sess.out_status IS DISTINCT FROM 'commercially_blocked' THEN
    RETURN jsonb_build_object('status', 'session_invalid');
  END IF;

  IF v_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('status', 'ok', 'unchanged', true);
  END IF;

  SELECT * INTO v_turn
  FROM public.pharmacy_assistant_client_turns t
  WHERE t.token_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'ok', 'unchanged', true);
  END IF;

  -- Solo el mismo dispositivo/sesión puede revocar.
  IF v_sess.out_status = 'ok' THEN
    IF v_turn.pharmacy_id IS DISTINCT FROM v_sess.out_pharmacy_id
       OR v_turn.device_id IS DISTINCT FROM v_sess.out_device_id
       OR v_turn.device_session_id IS DISTINCT FROM v_sess.out_session_id THEN
      RETURN jsonb_build_object('status', 'forbidden');
    END IF;
  ELSIF v_sess.out_pharmacy_id IS NOT NULL THEN
    IF v_turn.pharmacy_id IS DISTINCT FROM v_sess.out_pharmacy_id THEN
      RETURN jsonb_build_object('status', 'forbidden');
    END IF;
  END IF;

  IF v_turn.status = 'active' THEN
    UPDATE public.pharmacy_assistant_client_turns
    SET status = 'revoked',
        revoked_at = pg_catalog.now()
    WHERE id = v_turn.id;

    -- Consultas pendientes de este turno dejan de ser entregables en kiosko.
    UPDATE public.pharmacy_assistant_consultations
    SET status = CASE
          WHEN status = 'pending' THEN 'expired'
          ELSE status
        END
    WHERE client_turn_id = v_turn.id
      AND channel = 'kiosk'
      AND status IN ('pending', 'answered');
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'unchanged', false);
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_assistant_abandon_client_turn_v1(text, text) IS
  'Invalida el turno de cliente del kiosko. Argumento = SHA-256 hex del token.';

REVOKE ALL ON FUNCTION public.ff_kiosk_assistant_abandon_client_turn_v1(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_assistant_abandon_client_turn_v1(text, text)
  TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 9) Kiosko: crear consulta (B1 + B3)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_assistant_create_consult_v1(
  p_credential_hash text,
  p_message text,
  p_client_request_id text,
  p_turn_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sess record;
  v_msg text := btrim(coalesce(p_message, ''));
  v_req text := btrim(coalesce(p_client_request_id, ''));
  v_existing public.pharmacy_assistant_consultations%ROWTYPE;
  v_turn record;
  v_next bigint;
  v_id uuid;
  v_code text;
  v_expires timestamptz;
  v_retain timestamptz;
  v_count_turn integer;
  v_count_device integer;
  v_count_pharmacy integer;
  -- Límites B3 (pruebas)
  c_max_per_turn constant integer := 5;
  c_max_per_device_hour constant integer := 20;
  c_max_per_pharmacy_hour constant integer := 200;
BEGIN
  SELECT * INTO v_sess
  FROM public.ff_kiosk_assistant_resolve_session_(p_credential_hash);

  IF v_sess.out_status = 'commercially_blocked' THEN
    RETURN jsonb_build_object('status', 'commercially_blocked');
  END IF;
  IF v_sess.out_status IS DISTINCT FROM 'ok' THEN
    RETURN jsonb_build_object('status', 'session_invalid');
  END IF;

  IF NOT public.ff_pharmacy_assistant_consults_enabled(v_sess.out_pharmacy_id) THEN
    RETURN jsonb_build_object('status', 'consults_disabled');
  END IF;

  IF v_msg = '' OR length(v_msg) > 500 THEN
    RETURN jsonb_build_object('status', 'invalid_message');
  END IF;

  IF v_req = '' OR length(v_req) > 128 THEN
    RETURN jsonb_build_object('status', 'invalid_request');
  END IF;

  SELECT * INTO v_turn
  FROM public.ff_kiosk_assistant_ensure_client_turn_(
    v_sess.out_pharmacy_id,
    v_sess.out_device_id,
    v_sess.out_session_id,
    p_turn_token_hash
  );

  IF v_turn.out_status IS DISTINCT FROM 'ok' THEN
    RETURN jsonb_build_object('status', v_turn.out_status);
  END IF;

  -- Idempotencia
  SELECT * INTO v_existing
  FROM public.pharmacy_assistant_consultations c
  WHERE c.pharmacy_id = v_sess.out_pharmacy_id
    AND c.client_request_id = v_req
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.client_turn_id IS DISTINCT FROM v_turn.out_turn_id
       OR v_existing.device_session_id IS DISTINCT FROM v_sess.out_session_id THEN
      RETURN jsonb_build_object('status', 'conflict');
    END IF;
    RETURN jsonb_build_object(
      'status', 'ok',
      'idempotent', true,
      'consult', jsonb_build_object(
        'id', v_existing.id,
        'display_code', v_existing.display_code,
        'consult_status', v_existing.status,
        'channel', v_existing.channel,
        'expires_at', v_existing.expires_at
      )
    );
  END IF;

  -- Rate-limit B3 (tras bloquear el turno con FOR UPDATE en ensure)
  SELECT count(*)::integer INTO v_count_turn
  FROM public.pharmacy_assistant_consultations c
  WHERE c.client_turn_id = v_turn.out_turn_id;

  IF v_count_turn >= c_max_per_turn THEN
    RETURN jsonb_build_object(
      'status', 'rate_limited',
      'scope', 'turn',
      'limit', c_max_per_turn
    );
  END IF;

  SELECT count(*)::integer INTO v_count_device
  FROM public.pharmacy_assistant_consultations c
  WHERE c.device_id = v_sess.out_device_id
    AND c.created_at > pg_catalog.now() - interval '1 hour';

  IF v_count_device >= c_max_per_device_hour THEN
    RETURN jsonb_build_object(
      'status', 'rate_limited',
      'scope', 'device',
      'limit', c_max_per_device_hour
    );
  END IF;

  SELECT count(*)::integer INTO v_count_pharmacy
  FROM public.pharmacy_assistant_consultations c
  WHERE c.pharmacy_id = v_sess.out_pharmacy_id
    AND c.created_at > pg_catalog.now() - interval '1 hour';

  IF v_count_pharmacy >= c_max_per_pharmacy_hour THEN
    RETURN jsonb_build_object(
      'status', 'rate_limited',
      'scope', 'pharmacy',
      'limit', c_max_per_pharmacy_hour
    );
  END IF;

  INSERT INTO public.pharmacy_assistant_consult_counters (pharmacy_id, last_number)
  VALUES (v_sess.out_pharmacy_id, 0)
  ON CONFLICT (pharmacy_id) DO NOTHING;

  UPDATE public.pharmacy_assistant_consult_counters
  SET last_number = last_number + 1,
      updated_at = pg_catalog.now()
  WHERE pharmacy_id = v_sess.out_pharmacy_id
  RETURNING last_number INTO v_next;

  v_code := 'C-' || lpad(v_next::text, 4, '0');
  v_expires := pg_catalog.now() + interval '2 hours';
  v_retain := pg_catalog.now() + interval '7 days';
  v_id := gen_random_uuid();

  INSERT INTO public.pharmacy_assistant_consultations (
    id,
    pharmacy_id,
    channel,
    client_turn_id,
    device_id,
    device_session_id,
    consult_number,
    display_code,
    client_message,
    status,
    client_request_id,
    expires_at,
    retain_until
  ) VALUES (
    v_id,
    v_sess.out_pharmacy_id,
    'kiosk',
    v_turn.out_turn_id,
    v_sess.out_device_id,
    v_sess.out_session_id,
    v_next,
    v_code,
    v_msg,
    'pending',
    v_req,
    v_expires,
    v_retain
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'idempotent', false,
    'consult', jsonb_build_object(
      'id', v_id,
      'display_code', v_code,
      'consult_status', 'pending',
      'channel', 'kiosk',
      'expires_at', v_expires
    )
  );
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_assistant_create_consult_v1(text, text, text, text) IS
  'Kiosko: crea consulta (turno + rate-limit). 4º arg = SHA-256 hex del turn token.';

REVOKE ALL ON FUNCTION public.ff_kiosk_assistant_create_consult_v1(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_assistant_create_consult_v1(text, text, text, text)
  TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 10) Kiosko: poll (exige turno activo — B1)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_assistant_poll_consult_v1(
  p_credential_hash text,
  p_consult_id uuid,
  p_turn_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sess record;
  v_row public.pharmacy_assistant_consultations%ROWTYPE;
  v_turn public.pharmacy_assistant_client_turns%ROWTYPE;
  v_hash text := lower(btrim(coalesce(p_turn_token_hash, '')));
BEGIN
  SELECT * INTO v_sess
  FROM public.ff_kiosk_assistant_resolve_session_(p_credential_hash);

  IF v_sess.out_status = 'commercially_blocked' THEN
    RETURN jsonb_build_object('status', 'commercially_blocked');
  END IF;
  IF v_sess.out_status IS DISTINCT FROM 'ok' THEN
    RETURN jsonb_build_object('status', 'session_invalid');
  END IF;

  IF p_consult_id IS NULL OR v_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT * INTO v_turn
  FROM public.pharmacy_assistant_client_turns t
  WHERE t.token_hash = v_hash
  LIMIT 1;

  IF NOT FOUND
     OR v_turn.status IS DISTINCT FROM 'active'
     OR v_turn.expires_at <= pg_catalog.now() THEN
    RETURN jsonb_build_object('status', 'turn_revoked');
  END IF;

  IF v_turn.channel IS DISTINCT FROM 'kiosk'
     OR v_turn.pharmacy_id IS DISTINCT FROM v_sess.out_pharmacy_id
     OR v_turn.device_id IS DISTINCT FROM v_sess.out_device_id
     OR v_turn.device_session_id IS DISTINCT FROM v_sess.out_session_id THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  SELECT * INTO v_row
  FROM public.pharmacy_assistant_consultations c
  WHERE c.id = p_consult_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- Debe pertenecer a ESTE turno (cliente B con UUID de A → forbidden).
  IF v_row.client_turn_id IS DISTINCT FROM v_turn.id
     OR v_row.pharmacy_id IS DISTINCT FROM v_sess.out_pharmacy_id
     OR v_row.device_session_id IS DISTINCT FROM v_sess.out_session_id
     OR v_row.device_id IS DISTINCT FROM v_sess.out_device_id
     OR v_row.channel IS DISTINCT FROM 'kiosk' THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  IF v_row.expires_at <= pg_catalog.now() THEN
    IF v_row.status = 'pending' THEN
      UPDATE public.pharmacy_assistant_consultations
      SET status = 'expired'
      WHERE id = v_row.id AND status = 'pending';
    END IF;
    RETURN jsonb_build_object(
      'status', 'ok',
      'consult', jsonb_build_object(
        'id', v_row.id,
        'display_code', v_row.display_code,
        'consult_status', 'expired',
        'channel', v_row.channel,
        'reply', NULL,
        'expires_at', v_row.expires_at,
        'late', v_row.pharmacist_reply IS NOT NULL
      )
    );
  END IF;

  IF v_row.status IN ('answered', 'resolved')
     AND v_row.pharmacist_reply IS NOT NULL
     AND v_row.kiosk_delivered_at IS NULL THEN
    UPDATE public.pharmacy_assistant_consultations
    SET kiosk_delivered_at = pg_catalog.now()
    WHERE id = v_row.id
      AND kiosk_delivered_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'consult', jsonb_build_object(
      'id', v_row.id,
      'display_code', v_row.display_code,
      'consult_status', v_row.status,
      'channel', v_row.channel,
      'reply', CASE
        WHEN v_row.status IN ('answered', 'resolved') THEN v_row.pharmacist_reply
        ELSE NULL
      END,
      'expires_at', v_row.expires_at,
      'late', false
    )
  );
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_assistant_poll_consult_v1(text, uuid, text) IS
  'Poll kiosko: exige turno activo + misma consulta. 3º arg = SHA-256 hex del turn token.';

REVOKE ALL ON FUNCTION public.ff_kiosk_assistant_poll_consult_v1(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_assistant_poll_consult_v1(text, uuid, text)
  TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 12) Farmacia: contador pendientes
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_pharmacy_assistant_pending_consult_count_v1(
  p_pharmacy_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;
  IF p_pharmacy_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF NOT (
    public.ff_has_platform_permission('platform.pharmacies.read')
    OR public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_can_read_pharmacy_operational(p_pharmacy_id)
      AND public.ff_has_pharmacy_permission(p_pharmacy_id, 'assistant.consults.view')
    )
  ) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  UPDATE public.pharmacy_assistant_consultations
  SET status = 'expired'
  WHERE pharmacy_id = p_pharmacy_id
    AND status = 'pending'
    AND expires_at <= pg_catalog.now();

  SELECT count(*)::integer INTO v_count
  FROM public.pharmacy_assistant_consultations c
  WHERE c.pharmacy_id = p_pharmacy_id
    AND c.status = 'pending'
    AND c.retain_until > pg_catalog.now();

  RETURN jsonb_build_object(
    'status', 'ok',
    'pending_count', coalesce(v_count, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ff_pharmacy_assistant_pending_consult_count_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_pharmacy_assistant_pending_consult_count_v1(uuid)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 13) Farmacia: listar (incluye channel)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_pharmacy_assistant_list_consults_v1(
  p_pharmacy_id uuid,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;
  IF p_pharmacy_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF NOT (
    public.ff_has_platform_permission('platform.pharmacies.read')
    OR public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_can_read_pharmacy_operational(p_pharmacy_id)
      AND public.ff_has_pharmacy_permission(p_pharmacy_id, 'assistant.consults.view')
    )
  ) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  UPDATE public.pharmacy_assistant_consultations
  SET status = 'expired'
  WHERE pharmacy_id = p_pharmacy_id
    AND status = 'pending'
    AND expires_at <= pg_catalog.now();

  SELECT coalesce(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      c.id,
      c.pharmacy_id,
      c.channel,
      c.display_code,
      c.client_message,
      c.status,
      c.pharmacist_reply,
      c.answered_at,
      c.resolved_at,
      c.expires_at,
      c.created_at,
      c.updated_at
    FROM public.pharmacy_assistant_consultations c
    WHERE c.pharmacy_id = p_pharmacy_id
      AND c.retain_until > pg_catalog.now()
      AND (
        p_status IS NULL
        OR btrim(p_status) = ''
        OR p_status = 'all'
        OR c.status = p_status
      )
    ORDER BY c.created_at DESC
    LIMIT v_limit
  ) x;

  RETURN jsonb_build_object('status', 'ok', 'consults', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.ff_pharmacy_assistant_list_consults_v1(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_pharmacy_assistant_list_consults_v1(uuid, text, integer)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 14) Farmacia: responder
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_pharmacy_assistant_reply_consult_v1(
  p_pharmacy_id uuid,
  p_consult_id uuid,
  p_reply text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_reply text := btrim(coalesce(p_reply, ''));
  v_row public.pharmacy_assistant_consultations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;
  IF p_pharmacy_id IS NULL OR p_consult_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF NOT (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_can_read_pharmacy_operational(p_pharmacy_id)
      AND public.ff_has_pharmacy_permission(p_pharmacy_id, 'assistant.consults.manage')
    )
  ) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  IF v_reply = '' OR length(v_reply) > 2000 THEN
    RETURN jsonb_build_object('status', 'invalid_reply');
  END IF;

  SELECT * INTO v_row
  FROM public.pharmacy_assistant_consultations c
  WHERE c.id = p_consult_id
  FOR UPDATE;

  IF NOT FOUND OR v_row.pharmacy_id IS DISTINCT FROM p_pharmacy_id THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_row.retain_until <= pg_catalog.now() THEN
    RETURN jsonb_build_object('status', 'retained_expired');
  END IF;

  IF v_row.status = 'resolved' THEN
    RETURN jsonb_build_object('status', 'already_resolved');
  END IF;

  IF v_row.status = 'expired'
     OR (v_row.status = 'pending' AND v_row.expires_at <= pg_catalog.now()) THEN
    UPDATE public.pharmacy_assistant_consultations
    SET
      pharmacist_reply = v_reply,
      answered_by = v_uid,
      answered_at = pg_catalog.now(),
      status = 'expired'
    WHERE id = v_row.id;

    RETURN jsonb_build_object(
      'status', 'ok',
      'late', true,
      'consult_status', 'expired',
      'channel', v_row.channel
    );
  END IF;

  UPDATE public.pharmacy_assistant_consultations
  SET
    pharmacist_reply = v_reply,
    answered_by = v_uid,
    answered_at = pg_catalog.now(),
    status = 'answered'
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'late', false,
    'consult_status', 'answered',
    'channel', v_row.channel
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ff_pharmacy_assistant_reply_consult_v1(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_pharmacy_assistant_reply_consult_v1(uuid, uuid, text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 15) Farmacia: resolver
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_pharmacy_assistant_resolve_consult_v1(
  p_pharmacy_id uuid,
  p_consult_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.pharmacy_assistant_consultations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;
  IF p_pharmacy_id IS NULL OR p_consult_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF NOT (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR (
      public.ff_can_read_pharmacy_operational(p_pharmacy_id)
      AND public.ff_has_pharmacy_permission(p_pharmacy_id, 'assistant.consults.manage')
    )
  ) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  SELECT * INTO v_row
  FROM public.pharmacy_assistant_consultations c
  WHERE c.id = p_consult_id
  FOR UPDATE;

  IF NOT FOUND OR v_row.pharmacy_id IS DISTINCT FROM p_pharmacy_id THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_row.status = 'resolved' THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'unchanged', true,
      'consult_status', 'resolved',
      'channel', v_row.channel
    );
  END IF;

  IF v_row.status = 'pending' AND v_row.pharmacist_reply IS NULL THEN
    RETURN jsonb_build_object('status', 'reply_required');
  END IF;

  UPDATE public.pharmacy_assistant_consultations
  SET
    status = 'resolved',
    resolved_by = v_uid,
    resolved_at = pg_catalog.now()
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'unchanged', false,
    'consult_status', 'resolved',
    'channel', v_row.channel
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ff_pharmacy_assistant_resolve_consult_v1(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_pharmacy_assistant_resolve_consult_v1(uuid, uuid)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 16) Purga física (lista para cron; NO activar sin autorización)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_pharmacy_assistant_purge_expired_consults_v1(
  p_limit integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 2000));
  v_deleted integer;
BEGIN
  WITH doomed AS (
    SELECT c.id
    FROM public.pharmacy_assistant_consultations c
    WHERE c.retain_until <= pg_catalog.now()
    ORDER BY c.retain_until ASC
    LIMIT v_limit
  )
  DELETE FROM public.pharmacy_assistant_consultations t
  USING doomed d
  WHERE t.id = d.id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Turnos huérfanos ya revocados/expirados sin consultas (opcional, mismo batch).
  DELETE FROM public.pharmacy_assistant_client_turns t
  WHERE t.status IN ('revoked', 'expired')
    AND t.updated_at < pg_catalog.now() - interval '7 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.pharmacy_assistant_consultations c
      WHERE c.client_turn_id = t.id
    );

  RETURN jsonb_build_object('status', 'ok', 'deleted', coalesce(v_deleted, 0));
END;
$$;

COMMENT ON FUNCTION public.ff_pharmacy_assistant_purge_expired_consults_v1(integer) IS
  'Eliminación física post retain_until. Solo service_role. Sin cron en esta migración.';

REVOKE ALL ON FUNCTION public.ff_pharmacy_assistant_purge_expired_consults_v1(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_pharmacy_assistant_purge_expired_consults_v1(integer)
  TO service_role;

-- =============================================================================
-- ROLLBACK (manual):
-- DROP FUNCTION IF EXISTS public.ff_pharmacy_assistant_purge_expired_consults_v1(integer);
-- DROP FUNCTION IF EXISTS public.ff_pharmacy_assistant_resolve_consult_v1(uuid, uuid);
-- DROP FUNCTION IF EXISTS public.ff_pharmacy_assistant_reply_consult_v1(uuid, uuid, text);
-- DROP FUNCTION IF EXISTS public.ff_pharmacy_assistant_list_consults_v1(uuid, text, integer);
-- DROP FUNCTION IF EXISTS public.ff_pharmacy_assistant_pending_consult_count_v1(uuid);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_assistant_poll_consult_v1(text, uuid, text);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_assistant_create_consult_v1(text, text, text, text);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_assistant_abandon_client_turn_v1(text, text);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_assistant_ensure_client_turn_(uuid, uuid, uuid, text);
-- DROP FUNCTION IF EXISTS public.ff_pharmacy_assistant_consults_enabled(uuid);
-- DROP TABLE IF EXISTS public.pharmacy_assistant_consultations;
-- DROP TABLE IF EXISTS public.pharmacy_assistant_client_turns;
-- DROP TABLE IF EXISTS public.pharmacy_assistant_consult_counters;
-- DELETE FROM public.role_permissions WHERE permission_id IN (
--   SELECT id FROM public.permissions WHERE key IN (
--     'assistant.consults.view', 'assistant.consults.manage'
--   )
-- );
-- DELETE FROM public.permissions WHERE key IN (
--   'assistant.consults.view', 'assistant.consults.manage'
-- );
-- =============================================================================
