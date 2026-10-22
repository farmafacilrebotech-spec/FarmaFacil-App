-- =============================================================================
-- 048_commercial_quotes_v1.sql
-- Presupuestos comerciales con snapshot inmutable.
-- Depende de: 047_commercial_tariffs_catalog_v1.sql
-- NO APLICAR sin autorización expresa.
-- =============================================================================

INSERT INTO public.platform_permissions (key, module_key, description)
VALUES
  (
    'platform.commercial_quotes.manage',
    'commercial',
    'Crear y gestionar presupuestos comerciales (snapshot)'
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
  AND p.key = 'platform.commercial_quotes.manage'
ON CONFLICT DO NOTHING;

CREATE TABLE public.commercial_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code text,
  status text NOT NULL DEFAULT 'draft',
  -- Cliente potencial (texto) y/o farmacia existente
  prospect_name text,
  pharmacy_id uuid REFERENCES public.pharmacies (id) ON DELETE SET NULL,
  commercial_sku_key text NOT NULL,
  billing_interval text NOT NULL DEFAULT 'monthly',
  kiosk_count integer NOT NULL DEFAULT 0,
  tariff_version_id uuid NOT NULL
    REFERENCES public.commercial_tariff_versions (id) ON DELETE RESTRICT,
  -- Instantánea inmutable de tarifas + inputs + breakdown (céntimos)
  snapshot jsonb NOT NULL,
  -- Totales denormalizados (congelados; no recalcular)
  one_time_net_cents bigint NOT NULL,
  one_time_vat_cents bigint NOT NULL,
  one_time_gross_cents bigint NOT NULL,
  recurring_net_cents bigint NOT NULL,
  recurring_vat_cents bigint NOT NULL,
  recurring_gross_cents bigint NOT NULL,
  first_year_net_cents bigint NOT NULL,
  first_year_vat_cents bigint NOT NULL,
  first_year_gross_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  valid_until date,
  notes text,
  internal_notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_quotes_status_chk CHECK (
    status = ANY (ARRAY['draft', 'sent', 'accepted', 'rejected', 'expired'])
  ),
  CONSTRAINT commercial_quotes_interval_chk CHECK (
    billing_interval = ANY (ARRAY['monthly', 'annual'])
  ),
  CONSTRAINT commercial_quotes_kiosk_count_chk CHECK (kiosk_count >= 0),
  CONSTRAINT commercial_quotes_snapshot_object_chk
    CHECK (jsonb_typeof(snapshot) = 'object'),
  CONSTRAINT commercial_quotes_money_nonneg_chk CHECK (
    one_time_net_cents >= 0
    AND one_time_vat_cents >= 0
    AND one_time_gross_cents >= 0
    AND recurring_net_cents >= 0
    AND recurring_vat_cents >= 0
    AND recurring_gross_cents >= 0
    AND first_year_net_cents >= 0
    AND first_year_vat_cents >= 0
    AND first_year_gross_cents >= 0
  ),
  CONSTRAINT commercial_quotes_currency_chk CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT commercial_quotes_prospect_or_pharmacy_chk CHECK (
    pharmacy_id IS NOT NULL
    OR (prospect_name IS NOT NULL AND length(trim(prospect_name)) > 0)
  )
);

COMMENT ON TABLE public.commercial_quotes IS
  'Presupuestos comerciales. Importes y snapshot inmutables tras el alta.';
COMMENT ON COLUMN public.commercial_quotes.snapshot IS
  'Copia congelada de tarifas, inputs, IVA, hardware, licencias y condiciones.';
COMMENT ON COLUMN public.commercial_quotes.internal_notes IS
  'Notas internas SuperAdmin; no destinadas al PDF comercial.';

CREATE INDEX commercial_quotes_pharmacy_id_idx
  ON public.commercial_quotes (pharmacy_id)
  WHERE pharmacy_id IS NOT NULL;
CREATE INDEX commercial_quotes_status_created_idx
  ON public.commercial_quotes (status, created_at DESC);
CREATE INDEX commercial_quotes_tariff_version_idx
  ON public.commercial_quotes (tariff_version_id);

CREATE TRIGGER commercial_quotes_set_updated_at
  BEFORE UPDATE ON public.commercial_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

-- Impide mutar columnas monetarias / snapshot / tarifa tras INSERT
CREATE OR REPLACE FUNCTION public.ff_commercial_quotes_protect_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.tariff_version_id IS DISTINCT FROM OLD.tariff_version_id
     OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
     OR NEW.commercial_sku_key IS DISTINCT FROM OLD.commercial_sku_key
     OR NEW.billing_interval IS DISTINCT FROM OLD.billing_interval
     OR NEW.kiosk_count IS DISTINCT FROM OLD.kiosk_count
     OR NEW.one_time_net_cents IS DISTINCT FROM OLD.one_time_net_cents
     OR NEW.one_time_vat_cents IS DISTINCT FROM OLD.one_time_vat_cents
     OR NEW.one_time_gross_cents IS DISTINCT FROM OLD.one_time_gross_cents
     OR NEW.recurring_net_cents IS DISTINCT FROM OLD.recurring_net_cents
     OR NEW.recurring_vat_cents IS DISTINCT FROM OLD.recurring_vat_cents
     OR NEW.recurring_gross_cents IS DISTINCT FROM OLD.recurring_gross_cents
     OR NEW.first_year_net_cents IS DISTINCT FROM OLD.first_year_net_cents
     OR NEW.first_year_vat_cents IS DISTINCT FROM OLD.first_year_vat_cents
     OR NEW.first_year_gross_cents IS DISTINCT FROM OLD.first_year_gross_cents
     OR NEW.currency IS DISTINCT FROM OLD.currency
  THEN
    RAISE EXCEPTION 'commercial_quote_immutable_amounts'
      USING ERRCODE = '23514',
            MESSAGE = 'Los importes y el snapshot del presupuesto son inmutables. Duplica el presupuesto para una nueva oferta.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER commercial_quotes_protect_immutable
  BEFORE UPDATE ON public.commercial_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_commercial_quotes_protect_immutable();

CREATE TABLE public.commercial_quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL
    REFERENCES public.commercial_quotes (id) ON DELETE CASCADE,
  line_type text NOT NULL,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_cents bigint NOT NULL,
  line_net_cents bigint NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT commercial_quote_lines_type_chk CHECK (
    line_type = ANY (
      ARRAY[
        'plan',
        'kiosk_hardware',
        'kiosk_license',
        'onsite_install',
        'additional_service',
        'one_time_discount',
        'recurring_discount',
        'other'
      ]
    )
  ),
  CONSTRAINT commercial_quote_lines_qty_chk CHECK (quantity >= 0),
  CONSTRAINT commercial_quote_lines_desc_not_blank_chk
    CHECK (length(trim(description)) > 0),
  CONSTRAINT commercial_quote_lines_metadata_object_chk
    CHECK (jsonb_typeof(metadata) = 'object')
);

COMMENT ON TABLE public.commercial_quote_lines IS
  'Líneas congeladas del presupuesto. Sin UPDATE de importes (solo DELETE+recreate vía duplicado).';

CREATE INDEX commercial_quote_lines_quote_id_idx
  ON public.commercial_quote_lines (quote_id, sort_order);

-- RLS
ALTER TABLE public.commercial_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_quote_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY commercial_quotes_all ON public.commercial_quotes
  FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.commercial_quotes.manage'))
  WITH CHECK (public.ff_has_platform_permission('platform.commercial_quotes.manage'));

CREATE POLICY commercial_quote_lines_all ON public.commercial_quote_lines
  FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.commercial_quotes.manage'))
  WITH CHECK (public.ff_has_platform_permission('platform.commercial_quotes.manage'));

GRANT SELECT, INSERT, UPDATE ON public.commercial_quotes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.commercial_quote_lines TO authenticated;

-- DOWN (desarrollo):
-- DROP TRIGGER IF EXISTS commercial_quotes_protect_immutable ON public.commercial_quotes;
-- DROP FUNCTION IF EXISTS public.ff_commercial_quotes_protect_immutable();
-- DROP TABLE IF EXISTS public.commercial_quote_lines;
-- DROP TABLE IF EXISTS public.commercial_quotes;
-- DELETE FROM public.platform_permissions WHERE key = 'platform.commercial_quotes.manage';
