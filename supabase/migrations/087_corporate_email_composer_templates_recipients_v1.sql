-- =============================================================================
-- 087_corporate_email_composer_templates_recipients_v1.sql
-- Plantillas editables, CC/CCO, cuentas ampliadas.
-- Prerrequisito: 086.
-- NO APLICAR en producción sin autorización.
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.email_drafts') IS NULL THEN
    RAISE EXCEPTION '087 requires email_drafts (075+)';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Destinatarios CC / CCO (arrays; límites en app)
-- -----------------------------------------------------------------------------
ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS cc_emails text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS bcc_emails text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS template_id uuid NULL;

-- Permitir slug 'custom' para plantillas editables de usuario
ALTER TABLE public.email_drafts DROP CONSTRAINT IF EXISTS email_drafts_template_slug_chk;
ALTER TABLE public.email_drafts
  ADD CONSTRAINT email_drafts_template_slug_chk
  CHECK (
    template_slug = ANY (
      ARRAY[
        'blank'::text,
        'lanzadera'::text,
        'imprentas'::text,
        'demo'::text,
        'piloto'::text,
        'custom'::text
      ]
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_sends_template_slug_chk'
  ) THEN
    ALTER TABLE public.email_sends DROP CONSTRAINT email_sends_template_slug_chk;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_sends_template_slug_chk'
  ) THEN
    ALTER TABLE public.email_sends
      ADD CONSTRAINT email_sends_template_slug_chk
      CHECK (
        template_slug = ANY (
          ARRAY[
            'blank'::text,
            'lanzadera'::text,
            'imprentas'::text,
            'demo'::text,
            'piloto'::text,
            'custom'::text
          ]
        )
      );
  END IF;
END $$;

ALTER TABLE public.email_sends
  ADD COLUMN IF NOT EXISTS cc_emails text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS bcc_emails text[] NOT NULL DEFAULT '{}'::text[];

-- Ampliar from_key (cuentas corporativas gestionadas)
ALTER TABLE public.email_drafts DROP CONSTRAINT IF EXISTS email_drafts_from_key_chk;
ALTER TABLE public.email_drafts
  ADD CONSTRAINT email_drafts_from_key_chk
  CHECK (
    from_key = ANY (
      ARRAY[
        'pilar','contacto','info','soporte','pruebas','ventas','admin','privacidad',
        'demo','comercial','facturacion'
      ]::text[]
    )
  );

ALTER TABLE public.email_sends DROP CONSTRAINT IF EXISTS email_sends_from_key_chk;
ALTER TABLE public.email_sends
  ADD CONSTRAINT email_sends_from_key_chk
  CHECK (
    from_key = ANY (
      ARRAY[
        'pilar','contacto','info','soporte','pruebas','ventas','admin','privacidad',
        'demo','comercial','facturacion'
      ]::text[]
    )
  );

-- -----------------------------------------------------------------------------
-- Plantillas editables (no mutan al redactar un correo)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  subject text NOT NULL DEFAULT '',
  html_body text NOT NULL DEFAULT '',
  text_body text NOT NULL DEFAULT '',
  purpose text NOT NULL DEFAULT 'operational',
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  include_signature boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active',
  system_key text NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_templates_slug_uq UNIQUE (slug),
  CONSTRAINT email_templates_slug_len_chk CHECK (char_length(slug) BETWEEN 1 AND 80),
  CONSTRAINT email_templates_name_len_chk CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT email_templates_subject_len_chk CHECK (char_length(subject) <= 500),
  CONSTRAINT email_templates_purpose_chk CHECK (
    purpose = ANY (ARRAY['operational'::text, 'commercial'::text])
  ),
  CONSTRAINT email_templates_status_chk CHECK (
    status = ANY (ARRAY['active'::text, 'archived'::text, 'disabled'::text])
  )
);

CREATE INDEX IF NOT EXISTS email_templates_status_idx
  ON public.email_templates (status, updated_at DESC);

DROP TRIGGER IF EXISTS email_templates_set_updated_at ON public.email_templates;
CREATE TRIGGER email_templates_set_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.ff_set_updated_at();

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_templates_select ON public.email_templates;
CREATE POLICY email_templates_select ON public.email_templates
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.emails.read'));

DROP POLICY IF EXISTS email_templates_insert ON public.email_templates;
CREATE POLICY email_templates_insert ON public.email_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.emails.write')
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS email_templates_update ON public.email_templates;
CREATE POLICY email_templates_update ON public.email_templates
  FOR UPDATE TO authenticated
  USING (public.ff_has_platform_permission('platform.emails.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.emails.write'));

DROP POLICY IF EXISTS email_templates_delete ON public.email_templates;
CREATE POLICY email_templates_delete ON public.email_templates
  FOR DELETE TO authenticated
  USING (public.ff_has_platform_permission('platform.emails.write'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_drafts
  DROP CONSTRAINT IF EXISTS email_drafts_template_id_fkey;
ALTER TABLE public.email_drafts
  ADD CONSTRAINT email_drafts_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.email_templates (id) ON DELETE SET NULL;

COMMENT ON TABLE public.email_templates IS
  '087: plantillas editables. Usar en composer copia contenido; no muta la plantilla.';

-- -----------------------------------------------------------------------------
-- Claim RPC: incluir cc/bcc
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.ff_corporate_email_claim_send_v1(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, boolean, integer, timestamptz, text
);

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
  p_from_key text DEFAULT 'pilar',
  p_cc_emails text[] DEFAULT '{}'::text[],
  p_bcc_emails text[] DEFAULT '{}'::text[]
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
  v_cc text[] := coalesce(p_cc_emails, '{}'::text[]);
  v_bcc text[] := coalesce(p_bcc_emails, '{}'::text[]);
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
  IF cardinality(v_cc) + cardinality(v_bcc) + 1 > 5 THEN
    RAISE EXCEPTION 'too_many_recipients' USING ERRCODE = '23514';
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
    IF EXISTS (
      SELECT 1
      FROM unnest(v_cc || v_bcc) AS addr(email)
      JOIN public.email_suppression_list s ON s.email = lower(btrim(addr.email))
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
    idempotency_key, draft_id, template_slug, subject, html_body, text_body,
    recipient_email, recipient_name, from_address, reply_to, status, provider,
    payload_hash, authorized_by, authorized_at, created_by, purpose, legal_basis,
    confirmation_ack_at, dry_run, attachment_count, from_key, provider_status,
    cc_emails, bcc_emails
  ) VALUES (
    btrim(p_idempotency_key), p_draft_id,
    coalesce(nullif(btrim(p_template_slug), ''), 'blank'),
    p_subject, p_html_body, p_text_body, v_email,
    nullif(btrim(coalesce(p_recipient_name, '')), ''),
    p_from_address, nullif(btrim(coalesce(p_reply_to, '')), ''),
    'queued', 'resend', p_payload_hash, v_uid,
    coalesce(p_confirmation_ack_at, now()), v_uid, v_purpose,
    nullif(btrim(coalesce(p_legal_basis, '')), ''),
    coalesce(p_confirmation_ack_at, now()), coalesce(p_dry_run, false),
    coalesce(p_attachment_count, 0), v_from_key, NULL, v_cc, v_bcc
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

REVOKE ALL ON FUNCTION public.ff_corporate_email_claim_send_v1(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, boolean, integer, timestamptz, text, text[], text[]
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_corporate_email_claim_send_v1(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, boolean, integer, timestamptz, text, text[], text[]
) TO authenticated;
