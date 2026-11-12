-- =============================================================================
-- 086_corporate_email_attachments_senders_v1.sql
-- Adjuntos de borrador, remitente autorizado, estados de entrega Resend,
-- Storage policies para email-attachments.
-- Prerrequisito: 085.
-- NO APLICAR en producción sin autorización.
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.email_drafts') IS NULL
     OR to_regclass('public.email_sends') IS NULL THEN
    RAISE EXCEPTION '086 requires 075/085 email tables';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Borradores: remitente elegido
-- -----------------------------------------------------------------------------
ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS from_key text NOT NULL DEFAULT 'pilar',
  ADD COLUMN IF NOT EXISTS reply_to_override text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_drafts_from_key_chk'
  ) THEN
    ALTER TABLE public.email_drafts
      ADD CONSTRAINT email_drafts_from_key_chk
      CHECK (
        from_key = ANY (
          ARRAY[
            'pilar'::text,
            'contacto'::text,
            'info'::text,
            'soporte'::text,
            'pruebas'::text,
            'ventas'::text,
            'admin'::text,
            'privacidad'::text
          ]
        )
      );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Outbox: remitente + estado proveedor (aceptado ≠ entregado)
-- -----------------------------------------------------------------------------
ALTER TABLE public.email_sends
  ADD COLUMN IF NOT EXISTS from_key text NOT NULL DEFAULT 'pilar',
  ADD COLUMN IF NOT EXISTS provider_status text NULL,
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_sends_from_key_chk'
  ) THEN
    ALTER TABLE public.email_sends
      ADD CONSTRAINT email_sends_from_key_chk
      CHECK (
        from_key = ANY (
          ARRAY[
            'pilar'::text,
            'contacto'::text,
            'info'::text,
            'soporte'::text,
            'pruebas'::text,
            'ventas'::text,
            'admin'::text,
            'privacidad'::text
          ]
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_sends_provider_status_chk'
  ) THEN
    ALTER TABLE public.email_sends
      ADD CONSTRAINT email_sends_provider_status_chk
      CHECK (
        provider_status IS NULL
        OR provider_status = ANY (
          ARRAY[
            'accepted'::text,
            'delivered'::text,
            'bounced'::text,
            'complained'::text,
            'delivery_delayed'::text
          ]
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.email_sends.provider_status IS
  '086: estado Resend. accepted ≠ delivered. delivered solo con webhook/confirmación.';

-- Ampliar status outbox con pending_send (alias queued) — mantener queued.
-- Sin cambio de CHECK (queued cubre pendiente).

-- -----------------------------------------------------------------------------
-- Adjuntos de borrador (persisten al guardar)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_draft_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.email_drafts (id) ON DELETE CASCADE,
  file_name text NOT NULL,
  content_type text NOT NULL,
  byte_size integer NOT NULL,
  storage_path text NOT NULL,
  sha256 text NOT NULL,
  source_kind text NOT NULL DEFAULT 'upload',
  source_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_draft_attachments_size_chk CHECK (
    byte_size > 0 AND byte_size <= 5242880
  ),
  CONSTRAINT email_draft_attachments_name_len_chk CHECK (char_length(file_name) <= 200),
  CONSTRAINT email_draft_attachments_source_chk CHECK (
    source_kind = ANY (
      ARRAY[
        'upload'::text,
        'generated_quote'::text,
        'generated_contract'::text,
        'generated_invoice'::text,
        'generated_other'::text
      ]
    )
  )
);

CREATE INDEX IF NOT EXISTS email_draft_attachments_draft_idx
  ON public.email_draft_attachments (draft_id);

COMMENT ON TABLE public.email_draft_attachments IS
  '086: adjuntos de borrador. source_kind prepara documentos generados FF.';

ALTER TABLE public.email_draft_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_draft_attachments_select ON public.email_draft_attachments;
CREATE POLICY email_draft_attachments_select ON public.email_draft_attachments
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.emails.read'));

DROP POLICY IF EXISTS email_draft_attachments_insert ON public.email_draft_attachments;
CREATE POLICY email_draft_attachments_insert ON public.email_draft_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.emails.write')
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS email_draft_attachments_delete ON public.email_draft_attachments;
CREATE POLICY email_draft_attachments_delete ON public.email_draft_attachments
  FOR DELETE TO authenticated
  USING (public.ff_has_platform_permission('platform.emails.write'));

GRANT SELECT, INSERT, DELETE ON public.email_draft_attachments TO authenticated;
GRANT ALL ON public.email_draft_attachments TO service_role;

-- Ampliar mime permitidos en send_attachments (excel)
ALTER TABLE public.email_send_attachments
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS source_ref jsonb NOT NULL DEFAULT '{}'::jsonb;

-- -----------------------------------------------------------------------------
-- Storage bucket + policies
-- -----------------------------------------------------------------------------
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
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/msword'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS email_attachments_storage_select ON storage.objects;
CREATE POLICY email_attachments_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'email-attachments'
    AND public.ff_has_platform_permission('platform.emails.read')
  );

DROP POLICY IF EXISTS email_attachments_storage_insert ON storage.objects;
CREATE POLICY email_attachments_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'email-attachments'
    AND public.ff_has_platform_permission('platform.emails.write')
  );

DROP POLICY IF EXISTS email_attachments_storage_update ON storage.objects;
CREATE POLICY email_attachments_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'email-attachments'
    AND public.ff_has_platform_permission('platform.emails.write')
  )
  WITH CHECK (
    bucket_id = 'email-attachments'
    AND public.ff_has_platform_permission('platform.emails.write')
  );

DROP POLICY IF EXISTS email_attachments_storage_delete ON storage.objects;
CREATE POLICY email_attachments_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'email-attachments'
    AND public.ff_has_platform_permission('platform.emails.write')
  );

-- -----------------------------------------------------------------------------
-- Reemplazar RPCs 085 (evitar sobrecargas ambiguas en PostgREST)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.ff_corporate_email_claim_send_v1(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, boolean, integer, timestamptz
);
DROP FUNCTION IF EXISTS public.ff_corporate_email_finalize_send_v1(uuid, text, text, text);

-- Insertos de metadatos de envío: permitido con permiso send
DROP POLICY IF EXISTS email_send_attachments_insert ON public.email_send_attachments;
CREATE POLICY email_send_attachments_insert ON public.email_send_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.emails.send')
    AND created_by = (SELECT auth.uid())
  );
GRANT INSERT ON public.email_send_attachments TO authenticated;

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
  p_confirmation_ack_at timestamptz DEFAULT now(),
  p_from_key text DEFAULT 'pilar'
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
  v_from_key text := lower(btrim(coalesce(p_from_key, 'pilar')));
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
  IF v_from_key NOT IN (
    'pilar','contacto','info','soporte','pruebas','ventas','admin','privacidad'
  ) THEN
    RAISE EXCEPTION 'invalid_from_key' USING ERRCODE = '23514';
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
      'provider_status', v_existing.provider_status,
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
    attachment_count,
    from_key,
    provider_status
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
    coalesce(p_attachment_count, 0),
    v_from_key,
    NULL
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

-- finalize: permitir marcar provider_status
CREATE OR REPLACE FUNCTION public.ff_corporate_email_finalize_send_v1(
  p_send_id uuid,
  p_status text,
  p_provider_message_id text DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_provider_status text DEFAULT NULL
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
  v_pstatus text := nullif(lower(btrim(coalesce(p_provider_status, ''))), '');
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
  IF v_pstatus IS NOT NULL AND v_pstatus NOT IN (
    'accepted','delivered','bounced','complained','delivery_delayed'
  ) THEN
    RAISE EXCEPTION 'invalid_provider_status' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_row FROM public.email_sends WHERE id = p_send_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'send_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_row.status IN ('sent', 'failed', 'blocked', 'cancelled')
     AND coalesce(v_pstatus, '') = '' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'replay', true,
      'id', v_row.id,
      'status', v_row.status,
      'provider_message_id', v_row.provider_message_id,
      'provider_status', v_row.provider_status
    );
  END IF;

  UPDATE public.email_sends
  SET
    status = CASE
      WHEN v_row.status IN ('sent','failed','blocked','cancelled') THEN v_row.status
      ELSE v_status
    END,
    provider_message_id = coalesce(p_provider_message_id, provider_message_id),
    provider_status = coalesce(v_pstatus, provider_status),
    error = CASE
      WHEN v_status = 'failed' AND v_row.status = 'queued'
        THEN left(coalesce(p_error, 'error'), 2000)
      ELSE error
    END,
    sent_at = CASE
      WHEN v_status = 'sent' AND v_row.status = 'queued' THEN now()
      ELSE sent_at
    END,
    delivered_at = CASE
      WHEN v_pstatus = 'delivered' THEN coalesce(delivered_at, now())
      ELSE delivered_at
    END,
    bounced_at = CASE
      WHEN v_pstatus = 'bounced' THEN coalesce(bounced_at, now())
      ELSE bounced_at
    END,
    updated_at = now()
  WHERE id = p_send_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'replay', false,
    'id', v_row.id,
    'status', v_row.status,
    'provider_message_id', v_row.provider_message_id,
    'provider_status', v_row.provider_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ff_corporate_email_finalize_send_v1(uuid, text, text, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_corporate_email_finalize_send_v1(uuid, text, text, text, text)
  TO authenticated;

-- Recrear grant claim con nueva firma
REVOKE ALL ON FUNCTION public.ff_corporate_email_claim_send_v1(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, boolean, integer, timestamptz, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_corporate_email_claim_send_v1(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, boolean, integer, timestamptz, text
) TO authenticated;
