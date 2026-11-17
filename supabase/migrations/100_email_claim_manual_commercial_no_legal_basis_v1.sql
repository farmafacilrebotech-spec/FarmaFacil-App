-- 100: EMAIL-10 — envío manual 1:1 comercial sin exigir legal_basis.
-- La base jurídica sigue siendo opcional (trazabilidad). No se inventa consentimiento.
-- Se mantiene el bloqueo por lista de oposición/bajas en purpose=commercial
-- (la app también bloquea suppressed en todos los propósitos).

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
  p_bcc_emails text[] DEFAULT '{}'::text[],
  p_signature_included boolean DEFAULT false,
  p_signature_label text DEFAULT NULL
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
  v_html text := coalesce(p_html_body, '');
  v_legal text := nullif(btrim(coalesce(p_legal_basis, '')), '');
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
  IF v_purpose NOT IN ('operational', 'commercial', 'institutional', 'procurement') THEN
    RAISE EXCEPTION 'invalid_purpose' USING ERRCODE = '23514';
  END IF;
  IF cardinality(v_cc) + cardinality(v_bcc) + 1 > 5 THEN
    RAISE EXCEPTION 'too_many_recipients' USING ERRCODE = '23514';
  END IF;

  -- Oposición/bajas: bloquear en cualquier propósito (1:1 incluido).
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

  -- legal_basis opcional siempre (no inventar consentimiento en envío manual).
  IF v_legal IS NOT NULL AND v_legal NOT IN (
    'consent',
    'legitimate_interest_documented',
    'contractual'
  ) THEN
    RAISE EXCEPTION 'invalid_legal_basis' USING ERRCODE = '23514';
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
    cc_emails, bcc_emails, signature_included, signature_label, final_html_available
  ) VALUES (
    btrim(p_idempotency_key), p_draft_id,
    coalesce(nullif(btrim(p_template_slug), ''), 'blank'),
    p_subject, v_html, p_text_body, v_email,
    nullif(btrim(coalesce(p_recipient_name, '')), ''),
    p_from_address, nullif(btrim(coalesce(p_reply_to, '')), ''),
    'queued', 'resend', p_payload_hash, v_uid,
    coalesce(p_confirmation_ack_at, now()), v_uid, v_purpose,
    v_legal,
    coalesce(p_confirmation_ack_at, now()), coalesce(p_dry_run, false),
    coalesce(p_attachment_count, 0), v_from_key, NULL, v_cc, v_bcc,
    coalesce(p_signature_included, false),
    nullif(btrim(coalesce(p_signature_label, '')), ''),
    length(btrim(v_html)) > 0
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
  '100/EMAIL-10: claim outbox 1:1. legal_basis opcional; no exige consentimiento comercial registrado. Bloquea suppressed.';
