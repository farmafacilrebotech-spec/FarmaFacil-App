-- =============================================================================
-- 103_platform_issuer_profile_v1.sql
-- Perfil emisor corporativo (SuperAdmin). Sin inventar NIF/IBAN.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.platform_issuer_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_name text NOT NULL DEFAULT 'FarmaFácil',
  legal_name text,
  tax_id text,
  fiscal_address text,
  phone text,
  billing_email text,
  web text,
  bank_iban text,
  bank_holder text,
  logo_path text,
  is_current boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_issuer_profile_one_current_uidx
  ON public.platform_issuer_profile ((is_current))
  WHERE is_current = true;

CREATE TABLE IF NOT EXISTS public.platform_issuer_profile_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.platform_issuer_profile (id) ON DELETE SET NULL,
  changed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  before_row jsonb,
  after_row jsonb
);

ALTER TABLE public.platform_issuer_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_issuer_profile_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_issuer_profile_sa_select
  ON public.platform_issuer_profile FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.settings.manage')
    OR public.ff_has_platform_permission('platform.pharmacies.read'));

CREATE POLICY platform_issuer_profile_sa_write
  ON public.platform_issuer_profile FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.settings.manage'))
  WITH CHECK (public.ff_has_platform_permission('platform.settings.manage'));

CREATE POLICY platform_issuer_audit_sa_select
  ON public.platform_issuer_profile_audit FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.settings.manage'));

GRANT SELECT ON public.platform_issuer_profile TO authenticated;
GRANT INSERT, UPDATE ON public.platform_issuer_profile TO authenticated;
GRANT SELECT, INSERT ON public.platform_issuer_profile_audit TO authenticated;

-- Semilla: solo datos no sensibles verificados (sin NIF/IBAN/domicilio inventados)
INSERT INTO public.platform_issuer_profile (
  commercial_name, legal_name, billing_email, web, phone, tax_id, fiscal_address, bank_iban, notes
)
SELECT
  'FarmaFácil',
  'Pilar Reyes Bononat',
  'facturacion@farmafacil.solutions',
  'https://www.farmafacil.solutions',
  NULL,
  NULL,
  NULL,
  NULL,
  'Perfil provisional persona física. NIF/domicilio/IBAN pendientes de verificación. Sociedad en enero.'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_issuer_profile WHERE is_current);
