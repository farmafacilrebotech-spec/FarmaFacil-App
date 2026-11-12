-- =============================================================================
-- 085_corporate_email_phase_b_send_v1.sql
-- Emails Fase B: propósito operativo/comercial, consentimiento, adjuntos meta,
-- lista de oposición y RPCs de outbox idempotente (escritura vía DEFINER).
--
-- Prerrequisito: 075 (email_drafts, email_sends, platform.emails.*).
-- NO envía correo: el proveedor Resend vive en la app (server).
-- NO APLICAR en producción sin autorización explícita.
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.email_drafts') IS NULL
     OR to_regclass('public.email_sends') IS NULL THEN
    RAISE EXCEPTION '085 requires migration 075 (email_drafts + email_sends)';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Extensiones borradores
-- -----------------------------------------------------------------------------
ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'operational',
  ADD COLUMN IF NOT EXISTS legal_basis text NULL,
  ADD COLUMN IF NOT EXISTS commercial_auth_ack boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opposition_checked boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_drafts_purpose_chk'
  ) THEN
    ALTER TABLE public.email_drafts
      ADD CONSTRAINT email_drafts_purpose_chk
      CHECK (purpose = ANY (ARRAY['operational'::text, 'commercial'::text]));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_drafts_legal_basis_chk'
  ) THEN
    ALTER TABLE public.email_drafts
      ADD CONSTRAINT email_drafts_legal_basis_chk
      CHECK (
        legal_basis IS NULL
        OR legal_basis = ANY (
          ARRAY[
            'consent'::text,
            'legitimate_interest_documented'::text,
            'contractual'::text
          ]
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.email_drafts.purpose IS
  '085: operational (servicio) vs commercial (marketing/prospección).';
COMMENT ON COLUMN public.email_drafts.legal_basis IS
  '085: base jurídica obligatoria si purpose=commercial.';

-- -----------------------------------------------------------------------------
-- Extensiones outbox
-- -----------------------------------------------------------------------------
ALTER TABLE public.email_sends
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'operational',
  ADD COLUMN IF NOT EXISTS legal_basis text NULL,
  ADD COLUMN IF NOT EXISTS confirmation_ack_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS dry_run boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attachment_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_sends_purpose_chk'
  ) THEN
    ALTER TABLE public.email_sends
      ADD CONSTRAINT email_sends_purpose_chk
      CHECK (purpose = ANY (ARRAY['operational'::text, 'commercial'::text]));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_sends_legal_basis_chk'
  ) THEN
    ALTER TABLE public.email_sends
      ADD CONSTRAINT email_sends_legal_basis_chk
      CHECK (
        legal_basis IS NULL
        OR legal_basis = ANY (
          ARRAY[
            'consent'::text,
            'legitimate_interest_documented'::text,
            'contractual'::text
          ]
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_sends_attachment_count_chk'
  ) THEN
    ALTER TABLE public.email_sends
      ADD CONSTRAINT email_sends_attachment_count_chk
      CHECK (attachment_count >= 0 AND attachment_count <= 10);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Lista de oposición / bajas (comunicaciones comerciales)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_suppression_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  reason text NOT NULL DEFAULT 'unsubscribe',
  source text NOT NULL DEFAULT 'manual',
  notes text NULL,
  created_by uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_suppression_email_len_chk CHECK (char_length(email) <= 320),
  CONSTRAINT email_suppression_email_key UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS email_suppression_list_email_idx
  ON public.email_suppression_list (email);

COMMENT ON TABLE public.email_suppression_list IS
  '085: oposición/bajas. Bloquea purpose=commercial hacia ese email.';

ALTER TABLE public.email_suppression_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_suppression_select ON public.email_suppression_list;
CREATE POLICY email_suppression_select ON public.email_suppression_list
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.emails.read'));

DROP POLICY IF EXISTS email_suppression_write ON public.email_suppression_list;
CREATE POLICY email_suppression_write ON public.email_suppression_list
  FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.emails.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.emails.write'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_suppression_list TO authenticated;
GRANT ALL ON public.email_suppression_list TO service_role;

-- -----------------------------------------------------------------------------
-- Metadatos de adjuntos (binario en Storage privado; no en BD)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_send_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid NOT NULL REFERENCES public.email_sends (id) ON DELETE CASCADE,
  draft_id uuid NULL REFERENCES public.email_drafts (id) ON DELETE SET NULL,
  file_name text NOT NULL,
  content_type text NOT NULL,
  byte_size integer NOT NULL,
  storage_path text NOT NULL,
  sha256 text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_send_attachments_size_chk CHECK (
    byte_size > 0 AND byte_size <= 5242880
  ),
  CONSTRAINT email_send_attachments_name_len_chk CHECK (char_length(file_name) <= 200),
  CONSTRAINT email_send_attachments_ctype_len_chk CHECK (char_length(content_type) <= 120)
);

CREATE INDEX IF NOT EXISTS email_send_attachments_send_idx
  ON public.email_send_attachments (send_id);

COMMENT ON TABLE public.email_send_attachments IS
  '085: metadatos adjuntos. Binario en bucket privado email-attachments.';

ALTER TABLE public.email_send_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_send_attachments_select ON public.email_send_attachments;
CREATE POLICY email_send_attachments_select ON public.email_send_attachments
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.emails.read'));

-- Inserts solo vía service_role / RPC DEFINER
REVOKE INSERT, UPDATE, DELETE ON public.email_send_attachments FROM authenticated;
GRANT SELECT ON public.email_send_attachments TO authenticated;
GRANT ALL ON public.email_send_attachments TO service_role;

-- Bucket Storage (idempotente)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'email-attachments',
  'email-attachments',
  false,
  5242880,
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- RPC: claim idempotente (queued) — requiere platform.emails.send
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_corporate_email_claim_send_v1(
  p_idempotency_key text,
  p_draft_id uuid,
  p_template_slug text,
  p_subject text,
  p_html_body text,
  p_text_body text,
  p_recipient_email text,
  p_recipient_name text,
  p_from_address text,
  p_reply_to text,
  p_purpose text,
  p_legal_basis text,
  p_payload_hash text,
  p_dry_run boolean DEFAULT false,
  p_attachment_count integer DEFAULT 0,
  p_confirmation_ack_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_existing public.email_sends%ROWTYPE;
  v_row public.email_sends%ROWTYPE;
  v_email text := lower(btrim(coalesce(p_recipient_email, '')));
  v_purpose text := lower(btrim(coalesce(p_purpose, 'operational')));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.emails.send') THEN
    RAISE EXCEPTION 'forbidden_emails_send' USING ERRCODE = '42501';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE = '23514';
  END IF;
  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'recipient_email_required' USING ERRCODE = '23514';
  END IF;
  IF v_purpose NOT IN ('operational', 'commercial') THEN
    RAISE EXCEPTION 'invalid_purpose' USING ERRCODE = '23514';
  END IF;
  IF v_purpose = 'commercial' THEN
    IF p_legal_basis IS NULL OR btrim(p_legal_basis) = '' THEN
      RAISE EXCEPTION 'commercial_legal_basis_required' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.email_suppression_list s WHERE s.email = v_email
    ) THEN
      RAISE EXCEPTION 'recipient_suppressed' USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT * INTO v_existing
  FROM public.email_sends
  WHERE idempotency_key = btrim(p_idempotency_key);

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'replay', true,
      'id', v_existing.id,
      'status', v_existing.status,
      'provider_message_id', v_existing.provider_message_id,
      'dry_run', v_existing.dry_run
    );
  END IF;

  INSERT INTO public.email_sends (
    idempotency_key,
    draft_id,
    template_slug,
    subject,
    html_body,
    text_body,
    recipient_email,
    recipient_name,
    from_address,
    reply_to,
    status,
    provider,
    payload_hash,
    authorized_by,
    authorized_at,
    created_by,
    purpose,
    legal_basis,
    confirmation_ack_at,
    dry_run,
    attachment_count
  ) VALUES (
    btrim(p_idempotency_key),
    p_draft_id,
    coalesce(nullif(btrim(p_template_slug), ''), 'blank'),
    p_subject,
    p_html_body,
    p_text_body,
    v_email,
    nullif(btrim(coalesce(p_recipient_name, '')), ''),
    p_from_address,
    nullif(btrim(coalesce(p_reply_to, '')), ''),
    'queued',
    'resend',
    p_payload_hash,
    v_uid,
    coalesce(p_confirmation_ack_at, now()),
    v_uid,
    v_purpose,
    nullif(btrim(coalesce(p_legal_basis, '')), ''),
    coalesce(p_confirmation_ack_at, now()),
    coalesce(p_dry_run, false),
    coalesce(p_attachment_count, 0)
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'replay', false,
    'id', v_row.id,
    'status', v_row.status,
    'dry_run', v_row.dry_run
  );
END;
$$;

COMMENT ON FUNCTION public.ff_corporate_email_claim_send_v1 IS
  '085: inserta email_sends queued con idempotencia; exige platform.emails.send.';

REVOKE ALL ON FUNCTION public.ff_corporate_email_claim_send_v1(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, boolean, integer, timestamptz
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_corporate_email_claim_send_v1(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, boolean, integer, timestamptz
) TO authenticated;

-- -----------------------------------------------------------------------------
-- RPC: finalize sent/failed/blocked
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_corporate_email_finalize_send_v1(
  p_send_id uuid,
  p_status text,
  p_provider_message_id text DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_row public.email_sends%ROWTYPE;
  v_status text := lower(btrim(coalesce(p_status, '')));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.emails.send') THEN
    RAISE EXCEPTION 'forbidden_emails_send' USING ERRCODE = '42501';
  END IF;
  IF v_status NOT IN ('sent', 'failed', 'blocked', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_finalize_status' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_row
  FROM public.email_sends
  WHERE id = p_send_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'send_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotente: si ya terminal, devolver estado actual
  IF v_row.status IN ('sent', 'failed', 'blocked', 'cancelled') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'replay', true,
      'id', v_row.id,
      'status', v_row.status,
      'provider_message_id', v_row.provider_message_id
    );
  END IF;

  UPDATE public.email_sends
  SET
    status = v_status,
    provider_message_id = coalesce(p_provider_message_id, provider_message_id),
    error = CASE WHEN v_status = 'failed' THEN left(coalesce(p_error, 'error'), 2000) ELSE NULL END,
    sent_at = CASE WHEN v_status = 'sent' THEN now() ELSE sent_at END,
    updated_at = now()
  WHERE id = p_send_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'replay', false,
    'id', v_row.id,
    'status', v_row.status,
    'provider_message_id', v_row.provider_message_id
  );
END;
$$;

COMMENT ON FUNCTION public.ff_corporate_email_finalize_send_v1 IS
  '085: cierra outbox sent|failed|blocked|cancelled.';

REVOKE ALL ON FUNCTION public.ff_corporate_email_finalize_send_v1(uuid, text, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_corporate_email_finalize_send_v1(uuid, text, text, text)
  TO authenticated;
