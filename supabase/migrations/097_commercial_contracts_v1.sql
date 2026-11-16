-- Renumbered from dirty 069 for integration. Signature/definitive issuance remain gated by legal STATUS.json (ReBoTech pending).
-- =============================================================================
-- 069_commercial_contracts_v1.sql
-- Contratos legales derivados de presupuestos comerciales aceptados.
-- NO aplicar en producción sin autorización. No desplegar con este cambio.
--
-- Orden relativo: tras commercial_quotes (048+).
-- Si 064–068 aún no están en un entorno, mantener 069 al final de la cola.
-- =============================================================================

INSERT INTO public.platform_permissions (key, module_key, description)
VALUES
  (
    'platform.commercial_contracts.manage',
    'commercial',
    'Gestionar borradores de contrato, vista previa, PDF y envío (sin firmar ni activar servicio).'
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
  AND p.key = 'platform.commercial_contracts.manage'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.commercial_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.commercial_quotes (id) ON DELETE RESTRICT,
  pharmacy_id uuid REFERENCES public.pharmacies (id) ON DELETE SET NULL,
  template_key text NOT NULL
    CHECK (template_key = ANY (ARRAY['catalog', 'catalog-ai', 'full-kiosk'])),
  lifecycle_status text NOT NULL DEFAULT 'draft'
    CHECK (
      lifecycle_status = ANY (
        ARRAY[
          'draft',
          'preview_ready',
          'pdf_generated',
          'emailed',
          'awaiting_signature',
          'signed',
          'void'
        ]
      )
    ),
  legal_approval_snapshot text NOT NULL DEFAULT 'draft_pending_legal_review'
    CHECK (
      legal_approval_snapshot = ANY (
        ARRAY['draft_pending_legal_review', 'approved']
      )
    ),
  quote_reference_code text,
  pharmacy_signer_name text,
  pharmacy_signer_nif text,
  contact_email text,
  missing_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  filled_snapshot jsonb,
  pdf_storage_path text,
  email_sends jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Firma y activación son pasos explícitos e independientes de la aceptación del presupuesto.
  signed_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_contracts_quote_unique UNIQUE (quote_id)
);

COMMENT ON TABLE public.commercial_contracts IS
  'Borradores/documentos de contrato legal. Aceptar presupuesto NO firma ni activa servicio.';

COMMENT ON COLUMN public.commercial_contracts.signed_at IS
  'Solo se rellena con acción explícita de firma; nunca al aceptar el presupuesto.';

CREATE INDEX IF NOT EXISTS commercial_contracts_pharmacy_idx
  ON public.commercial_contracts (pharmacy_id);

CREATE INDEX IF NOT EXISTS commercial_contracts_status_idx
  ON public.commercial_contracts (lifecycle_status);

ALTER TABLE public.commercial_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_contracts_platform_select ON public.commercial_contracts;
CREATE POLICY commercial_contracts_platform_select
  ON public.commercial_contracts
  FOR SELECT
  TO authenticated
  USING (
    public.ff_has_platform_permission('platform.commercial_contracts.manage')
    OR public.ff_has_platform_permission('platform.commercial_quotes.manage')
  );

DROP POLICY IF EXISTS commercial_contracts_platform_write ON public.commercial_contracts;
CREATE POLICY commercial_contracts_platform_write
  ON public.commercial_contracts
  FOR ALL
  TO authenticated
  USING (public.ff_has_platform_permission('platform.commercial_contracts.manage'))
  WITH CHECK (public.ff_has_platform_permission('platform.commercial_contracts.manage'));

GRANT SELECT, INSERT, UPDATE ON public.commercial_contracts TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('commercial-contracts', 'commercial-contracts', false)
ON CONFLICT (id) DO NOTHING;
