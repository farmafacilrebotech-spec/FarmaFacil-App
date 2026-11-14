-- 090: Enviados como buzón (papelera/ocultar), snapshot de firma, propósitos
-- institucional/aprovisionamiento, borradores consumidos tras envío.
-- Impacto: email_sends, email_drafts, email_templates + claim RPC.
-- Rollback: ver sección final (comentada).

BEGIN;

-- -----------------------------------------------------------------------------
-- Propósitos: institutional + procurement
-- -----------------------------------------------------------------------------
ALTER TABLE public.email_sends DROP CONSTRAINT IF EXISTS email_sends_purpose_chk;
ALTER TABLE public.email_sends
  ADD CONSTRAINT email_sends_purpose_chk CHECK (
    purpose = ANY (
      ARRAY[
        'operational'::text,
        'commercial'::text,
        'institutional'::text,
        'procurement'::text
      ]
    )
  );

ALTER TABLE public.email_drafts DROP CONSTRAINT IF EXISTS email_drafts_purpose_chk;
ALTER TABLE public.email_drafts
  ADD CONSTRAINT email_drafts_purpose_chk CHECK (
    purpose = ANY (
      ARRAY[
        'operational'::text,
        'commercial'::text,
        'institutional'::text,
        'procurement'::text
      ]
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'email_templates'
  ) THEN
    ALTER TABLE public.email_templates DROP CONSTRAINT IF EXISTS email_templates_purpose_chk;
    ALTER TABLE public.email_templates
      ADD CONSTRAINT email_templates_purpose_chk CHECK (
        purpose = ANY (
          ARRAY[
            'operational'::text,
            'commercial'::text,
            'institutional'::text,
            'procurement'::text
          ]
        )
      );
  END IF;
END $$;

COMMENT ON CONSTRAINT email_sends_purpose_chk ON public.email_sends IS
  '090: operational | commercial | institutional | procurement. Solo commercial exige gates publicitarios.';

-- Reclasificar plantillas sistema (sin abrir puerta a publicidad)
UPDATE public.email_templates
SET purpose = 'institutional', updated_at = now()
WHERE purpose = 'commercial'
  AND (
    slug IN ('lanzadera', 'system-lanzadera')
    OR system_key = 'lanzadera'
  );

UPDATE public.email_templates
SET purpose = 'procurement', updated_at = now()
WHERE purpose = 'commercial'
  AND (
    slug IN ('imprentas', 'system-imprentas')
    OR system_key = 'imprentas'
  );

-- -----------------------------------------------------------------------------
-- Snapshot de firma en enviados (html_body ya es el HTML final del claim)
-- -----------------------------------------------------------------------------
ALTER TABLE public.email_sends
  ADD COLUMN IF NOT EXISTS signature_included boolean NOT NULL DEFAULT false;

ALTER TABLE public.email_sends
  ADD COLUMN IF NOT EXISTS signature_label text NULL;

ALTER TABLE public.email_sends
  ADD COLUMN IF NOT EXISTS final_html_available boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.email_sends.html_body IS
  '090: snapshot inmutable del HTML final entregado al proveedor (incluye firma si aplica). No reconstruir.';
COMMENT ON COLUMN public.email_sends.signature_included IS
  '090: true si el snapshot incluye firma (aplicada o embebida).';
COMMENT ON COLUMN public.email_sends.signature_label IS
  '090: nombre de firma o «Incorporada en la plantilla».';
COMMENT ON COLUMN public.email_sends.final_html_available IS
  '090: false solo para filas legacy sin HTML final utilizable.';

-- Legacy: sin cuerpo útil → marcar no disponible (no inventar contenido)
UPDATE public.email_sends
SET final_html_available = false
WHERE final_html_available = true
  AND (html_body IS NULL OR btrim(html_body) = '');

-- -----------------------------------------------------------------------------
-- Papelera de enviados (UI) — no borra auditoría
-- -----------------------------------------------------------------------------
ALTER TABLE public.email_sends
  ADD COLUMN IF NOT EXISTS trashed_at timestamptz NULL;

ALTER TABLE public.email_sends
  ADD COLUMN IF NOT EXISTS user_hidden_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS email_sends_trashed_at_idx
  ON public.email_sends (trashed_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS email_sends_user_hidden_at_idx
  ON public.email_sends (user_hidden_at DESC NULLS LAST)
  WHERE user_hidden_at IS NOT NULL;

COMMENT ON COLUMN public.email_sends.trashed_at IS
  '090: movido a Papelera (UI). El registro de auditoría permanece.';
COMMENT ON COLUMN public.email_sends.user_hidden_at IS
  '090: oculto de la vista del usuario tras eliminar de Papelera. No elimina evidencias.';

-- -----------------------------------------------------------------------------
-- Borrador consumido tras envío correcto (desaparece de Borradores/Papelera)
-- -----------------------------------------------------------------------------
ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz NULL;

ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS consumed_by_send_id uuid NULL
    REFERENCES public.email_sends (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS email_drafts_consumed_at_idx
  ON public.email_drafts (consumed_at DESC NULLS LAST);

COMMENT ON COLUMN public.email_drafts.consumed_at IS
  '090: borrador asociado a un envío correcto; no listar en Borradores ni Papelera.';

-- -----------------------------------------------------------------------------
-- Claim RPC: propósitos nuevos + metadatos de firma
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.ff_corporate_email_claim_send_v1(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, boolean, integer, timestamptz, text, text[], text[]
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
    cc_emails, bcc_emails, signature_included, signature_label, final_html_available
  ) VALUES (
    btrim(p_idempotency_key), p_draft_id,
    coalesce(nullif(btrim(p_template_slug), ''), 'blank'),
    p_subject, v_html, p_text_body, v_email,
    nullif(btrim(coalesce(p_recipient_name, '')), ''),
    p_from_address, nullif(btrim(coalesce(p_reply_to, '')), ''),
    'queued', 'resend', p_payload_hash, v_uid,
    coalesce(p_confirmation_ack_at, now()), v_uid, v_purpose,
    nullif(btrim(coalesce(p_legal_basis, '')), ''),
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

REVOKE ALL ON FUNCTION public.ff_corporate_email_claim_send_v1(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, boolean, integer, timestamptz, text, text[], text[], boolean, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_corporate_email_claim_send_v1(
  text, uuid, text, text, text, text, text, text, text, text, text, text, text, boolean, integer, timestamptz, text, text[], text[], boolean, text
) TO authenticated;

COMMENT ON FUNCTION public.ff_corporate_email_claim_send_v1 IS
  '090: claim outbox con cc/bcc, propósitos institutional/procurement y snapshot de firma.';

COMMIT;

-- -----------------------------------------------------------------------------
-- Rollback (manual):
-- ALTER TABLE email_sends DROP COLUMN IF EXISTS signature_included, signature_label,
--   final_html_available, trashed_at, user_hidden_at;
-- ALTER TABLE email_drafts DROP COLUMN IF EXISTS consumed_at, consumed_by_send_id;
-- Restaurar claim 087 y CHECKs purpose a operational|commercial.
-- -----------------------------------------------------------------------------
