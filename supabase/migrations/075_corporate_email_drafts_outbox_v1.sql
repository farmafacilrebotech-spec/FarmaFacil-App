-- =============================================================================
-- 075_corporate_email_drafts_outbox_v1.sql
-- Borradores + estructura de envíos corporativos (SuperAdmin).
--
-- Fase A: drafts CRUD. Envío real NO activado (sin RPC de send; tabla outbox
-- preparada para idempotencia/auditoría futura vía Resend).
--
-- NO APLICAR en producción ni staging sin autorización explícita.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permisos plataforma (solo SuperAdmin; no Support)
-- -----------------------------------------------------------------------------
INSERT INTO public.platform_permissions (key, module_key, description)
VALUES
  (
    'platform.emails.read',
    'emails',
    'Ver plantillas, borradores y registro de envíos corporativos'
  ),
  (
    'platform.emails.write',
    'emails',
    'Crear, editar y eliminar borradores de email corporativo'
  ),
  (
    'platform.emails.send',
    'emails',
    'Autorizar envío individual vía Resend (futuro; no usado en Fase A)'
  )
ON CONFLICT (key) DO UPDATE
SET
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description;

INSERT INTO public.platform_role_permissions (platform_role_id, platform_permission_id)
SELECT r.id, p.id
FROM public.platform_roles r
CROSS JOIN public.platform_permissions p
WHERE r.key = 'PLATFORM_SUPERADMIN'
  AND p.key IN (
    'platform.emails.read',
    'platform.emails.write',
    'platform.emails.send'
  )
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Borradores
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_slug text NOT NULL DEFAULT 'blank',
  subject text NOT NULL DEFAULT '',
  html_body text NOT NULL DEFAULT '',
  text_body text NOT NULL DEFAULT '',
  recipient_email text NOT NULL DEFAULT '',
  recipient_name text NULL,
  vars jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_override text NULL,
  reply_to_override text NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_drafts_template_slug_chk CHECK (
    template_slug IN (
      'blank',
      'lanzadera',
      'imprentas',
      'demo',
      'piloto'
    )
  ),
  CONSTRAINT email_drafts_subject_len_chk CHECK (char_length(subject) <= 500),
  CONSTRAINT email_drafts_recipient_len_chk CHECK (char_length(recipient_email) <= 320)
);

CREATE INDEX IF NOT EXISTS email_drafts_updated_at_idx
  ON public.email_drafts (updated_at DESC);

CREATE INDEX IF NOT EXISTS email_drafts_created_by_idx
  ON public.email_drafts (created_by);

COMMENT ON TABLE public.email_drafts IS
  '075: borradores SuperAdmin del hub /emails. Sin envío automático.';

DROP TRIGGER IF EXISTS email_drafts_set_updated_at ON public.email_drafts;
CREATE TRIGGER email_drafts_set_updated_at
  BEFORE UPDATE ON public.email_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_drafts_select ON public.email_drafts;
CREATE POLICY email_drafts_select ON public.email_drafts
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.emails.read'));

DROP POLICY IF EXISTS email_drafts_insert ON public.email_drafts;
CREATE POLICY email_drafts_insert ON public.email_drafts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ff_has_platform_permission('platform.emails.write')
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS email_drafts_update ON public.email_drafts;
CREATE POLICY email_drafts_update ON public.email_drafts
  FOR UPDATE TO authenticated
  USING (public.ff_has_platform_permission('platform.emails.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.emails.write'));

DROP POLICY IF EXISTS email_drafts_delete ON public.email_drafts;
CREATE POLICY email_drafts_delete ON public.email_drafts
  FOR DELETE TO authenticated
  USING (public.ff_has_platform_permission('platform.emails.write'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_drafts TO authenticated;
GRANT ALL ON public.email_drafts TO service_role;

-- -----------------------------------------------------------------------------
-- Outbox / auditoría de envíos (estructura futura; Fase A no escribe aquí)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  draft_id uuid NULL REFERENCES public.email_drafts (id) ON DELETE SET NULL,
  template_slug text NOT NULL DEFAULT 'blank',
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text NULL,
  from_address text NOT NULL,
  reply_to text NULL,
  status text NOT NULL DEFAULT 'queued',
  provider text NOT NULL DEFAULT 'resend',
  provider_message_id text NULL,
  payload_hash text NULL,
  error text NULL,
  authorized_by uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL,
  authorized_at timestamptz NULL,
  sent_at timestamptz NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_sends_idempotency_key_key UNIQUE (idempotency_key),
  CONSTRAINT email_sends_status_chk CHECK (
    status = ANY (
      ARRAY[
        'queued'::text,
        'sent'::text,
        'failed'::text,
        'cancelled'::text,
        'blocked'::text
      ]
    )
  ),
  CONSTRAINT email_sends_provider_chk CHECK (provider = 'resend')
);

CREATE INDEX IF NOT EXISTS email_sends_created_at_idx
  ON public.email_sends (created_at DESC);

CREATE INDEX IF NOT EXISTS email_sends_recipient_idx
  ON public.email_sends (recipient_email);

CREATE INDEX IF NOT EXISTS email_sends_status_idx
  ON public.email_sends (status);

COMMENT ON TABLE public.email_sends IS
  '075: outbox/auditoría Resend. Fase A no inserta filas; send queda bloqueado en app.';

DROP TRIGGER IF EXISTS email_sends_set_updated_at ON public.email_sends;
CREATE TRIGGER email_sends_set_updated_at
  BEFORE UPDATE ON public.email_sends
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_sends_select ON public.email_sends;
CREATE POLICY email_sends_select ON public.email_sends
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.emails.read'));

-- Escritura directa de outbox: solo service_role / futuro SECURITY DEFINER.
-- authenticated no inserta/update (evita envíos improvisados desde cliente).
REVOKE INSERT, UPDATE, DELETE ON public.email_sends FROM authenticated;
GRANT SELECT ON public.email_sends TO authenticated;
GRANT ALL ON public.email_sends TO service_role;

-- DOWN (desarrollo):
-- DROP TABLE IF EXISTS public.email_sends;
-- DROP TABLE IF EXISTS public.email_drafts;
-- DELETE FROM public.platform_role_permissions rp
--   USING public.platform_roles r, public.platform_permissions p
--   WHERE rp.platform_role_id = r.id AND rp.platform_permission_id = p.id
--     AND p.key LIKE 'platform.emails.%';
-- DELETE FROM public.platform_permissions WHERE key LIKE 'platform.emails.%';
