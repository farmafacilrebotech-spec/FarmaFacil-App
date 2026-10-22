-- =============================================================================
-- 047_commercial_tariffs_catalog_v1.sql
-- Catálogo comercial FarmaFácil (capa separada de plans starter|pro|…).
--
-- Incluye:
--   - commercial_plan_skus
--   - commercial_tariff_versions (inmutable; costes internos dentro del snapshot)
--   - commercial_plan_price_versions
--   - permisos platform.commercial_tariffs.*
--   - seed versión v1 alineada con precios Fase 2
--
-- NO modifica plans, subscriptions, entitlements ni farmacias existentes.
-- NO APLICAR sin autorización expresa.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
INSERT INTO public.platform_permissions (key, module_key, description)
VALUES
  (
    'platform.commercial_tariffs.read',
    'commercial',
    'Consultar tarifas y versiones comerciales'
  ),
  (
    'platform.commercial_tariffs.write',
    'commercial',
    'Crear versiones de tarifas y costes internos'
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
    'platform.commercial_tariffs.read',
    'platform.commercial_tariffs.write'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.platform_role_permissions (platform_role_id, platform_permission_id)
SELECT r.id, p.id
FROM public.platform_roles r
INNER JOIN public.platform_permissions p
  ON p.key = 'platform.commercial_tariffs.read'
WHERE r.key = 'PLATFORM_SUPPORT'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- SKUs comerciales (no equivalen automáticamente a plans.key)
-- -----------------------------------------------------------------------------
CREATE TABLE public.commercial_plan_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  name text NOT NULL,
  tagline text,
  is_pilot boolean NOT NULL DEFAULT false,
  allows_kiosk boolean NOT NULL DEFAULT true,
  includes_generic_assistant boolean NOT NULL DEFAULT true,
  includes_personalized_assistant boolean NOT NULL DEFAULT false,
  includes_own_catalog boolean NOT NULL DEFAULT false,
  includes_client_account boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_plan_skus_key_format_chk CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT commercial_plan_skus_key_key UNIQUE (key),
  CONSTRAINT commercial_plan_skus_name_not_blank_chk CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE public.commercial_plan_skus IS
  'SKUs comerciales (piloto/general/…). Independientes de plans.key internos.';

CREATE TRIGGER commercial_plan_skus_set_updated_at
  BEFORE UPDATE ON public.commercial_plan_skus
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

-- -----------------------------------------------------------------------------
-- Versiones de tarifa (inmutables tras insert; costes internos incluidos)
-- -----------------------------------------------------------------------------
CREATE TABLE public.commercial_tariff_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_label text NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  -- Impuestos / descuentos en basis points (2100 = 21 %, 1500 = 15 %)
  vat_bps integer NOT NULL,
  saas_annual_discount_bps integer NOT NULL,
  kiosk_license_annual_discount_bps integer NOT NULL,
  -- Importes en céntimos
  kiosk_hardware_unit_cents bigint NOT NULL,
  kiosk_license_monthly_cents bigint NOT NULL,
  -- Costes internos (solo SuperAdmin; no exponer en presupuestos comerciales)
  kiosk_internal_cost_cents bigint NOT NULL,
  kiosk_cost_personalization_cents bigint NOT NULL DEFAULT 0,
  kiosk_cost_shipping_cents bigint NOT NULL DEFAULT 0,
  kiosk_cost_configuration_cents bigint NOT NULL DEFAULT 0,
  kiosk_cost_other_cents bigint NOT NULL DEFAULT 0,
  default_onsite_install_cents bigint NOT NULL DEFAULT 0,
  -- Snapshot completo de la configuración (fuente de verdad histórica)
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_tariff_versions_vat_bps_chk CHECK (vat_bps >= 0 AND vat_bps <= 10000),
  CONSTRAINT commercial_tariff_versions_saas_dto_chk
    CHECK (saas_annual_discount_bps >= 0 AND saas_annual_discount_bps <= 10000),
  CONSTRAINT commercial_tariff_versions_kiosk_dto_chk
    CHECK (
      kiosk_license_annual_discount_bps >= 0
      AND kiosk_license_annual_discount_bps <= 10000
    ),
  CONSTRAINT commercial_tariff_versions_money_nonneg_chk CHECK (
    kiosk_hardware_unit_cents >= 0
    AND kiosk_license_monthly_cents >= 0
    AND kiosk_internal_cost_cents >= 0
    AND kiosk_cost_personalization_cents >= 0
    AND kiosk_cost_shipping_cents >= 0
    AND kiosk_cost_configuration_cents >= 0
    AND kiosk_cost_other_cents >= 0
    AND default_onsite_install_cents >= 0
  ),
  CONSTRAINT commercial_tariff_versions_snapshot_object_chk
    CHECK (jsonb_typeof(snapshot) = 'object'),
  CONSTRAINT commercial_tariff_versions_label_not_blank_chk
    CHECK (length(trim(version_label)) > 0)
);

COMMENT ON TABLE public.commercial_tariff_versions IS
  'Versiones inmutables de tarifa. Costes internos incluidos; no UPDATE de importes.';
COMMENT ON COLUMN public.commercial_tariff_versions.kiosk_internal_cost_cents IS
  'Coste estimado hardware (interno SuperAdmin). No incluir en PDF comercial.';

-- Como máximo una versión current (partial unique)
CREATE UNIQUE INDEX commercial_tariff_versions_one_current_uidx
  ON public.commercial_tariff_versions ((true))
  WHERE is_current = true;

CREATE INDEX commercial_tariff_versions_created_at_idx
  ON public.commercial_tariff_versions (created_at DESC);

CREATE TABLE public.commercial_plan_price_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tariff_version_id uuid NOT NULL
    REFERENCES public.commercial_tariff_versions (id) ON DELETE CASCADE,
  sku_id uuid NOT NULL
    REFERENCES public.commercial_plan_skus (id) ON DELETE RESTRICT,
  monthly_cents bigint NOT NULL,
  annual_cents bigint NOT NULL,
  trial_days integer,
  extension_days integer,
  CONSTRAINT commercial_plan_price_versions_money_nonneg_chk CHECK (
    monthly_cents >= 0 AND annual_cents >= 0
  ),
  CONSTRAINT commercial_plan_price_versions_trial_chk CHECK (
    trial_days IS NULL OR trial_days > 0
  ),
  CONSTRAINT commercial_plan_price_versions_ext_chk CHECK (
    extension_days IS NULL OR extension_days > 0
  ),
  CONSTRAINT commercial_plan_price_versions_tariff_sku_uid
    UNIQUE (tariff_version_id, sku_id)
);

COMMENT ON TABLE public.commercial_plan_price_versions IS
  'Precios por SKU dentro de una versión de tarifa (céntimos).';

-- -----------------------------------------------------------------------------
-- Seed SKUs + versión v1 (precios Fase 2)
-- -----------------------------------------------------------------------------
INSERT INTO public.commercial_plan_skus (
  key, name, tagline, is_pilot, allows_kiosk,
  includes_generic_assistant, includes_personalized_assistant,
  includes_own_catalog, includes_client_account, sort_order
)
VALUES
  (
    'pilot',
    'Piloto gratuito',
    '15 días · ampliación excepcional +15 días',
    true, false, true, false, false, false, 10
  ),
  (
    'general',
    'General',
    'QR, catálogo genérico y asistente genérico',
    false, true, true, false, false, false, 20
  ),
  (
    'personalized',
    'Personalizado',
    'Catálogo propio, precios y cuenta de cliente',
    false, true, true, false, true, true, 30
  ),
  (
    'ai_personalized',
    'Con Asistente IA personalizado',
    'Personalizado + asistente ligado al catálogo',
    false, true, true, true, true, true, 40
  )
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  is_pilot = EXCLUDED.is_pilot,
  allows_kiosk = EXCLUDED.allows_kiosk,
  includes_generic_assistant = EXCLUDED.includes_generic_assistant,
  includes_personalized_assistant = EXCLUDED.includes_personalized_assistant,
  includes_own_catalog = EXCLUDED.includes_own_catalog,
  includes_client_account = EXCLUDED.includes_client_account,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

DO $$
DECLARE
  v_version_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.commercial_tariff_versions WHERE is_current) THEN
    RETURN;
  END IF;

  INSERT INTO public.commercial_tariff_versions (
    version_label,
    is_current,
    vat_bps,
    saas_annual_discount_bps,
    kiosk_license_annual_discount_bps,
    kiosk_hardware_unit_cents,
    kiosk_license_monthly_cents,
    kiosk_internal_cost_cents,
    snapshot,
    notes
  )
  VALUES (
    'v1-fase2',
    true,
    2100,
    1500,
    1500,
    129000,
    1900,
    80000,
    jsonb_build_object(
      'source', 'fase2_defaults',
      'vat_bps', 2100,
      'saas_annual_discount_bps', 1500,
      'kiosk_license_annual_discount_bps', 1500,
      'kiosk_hardware_unit_cents', 129000,
      'kiosk_license_monthly_cents', 1900,
      'kiosk_internal_cost_cents', 80000,
      'plans', jsonb_build_array(
        jsonb_build_object('key', 'pilot', 'monthly_cents', 0, 'annual_cents', 0, 'trial_days', 15, 'extension_days', 15),
        jsonb_build_object('key', 'general', 'monthly_cents', 3900, 'annual_cents', 39780),
        jsonb_build_object('key', 'personalized', 'monthly_cents', 6900, 'annual_cents', 70380),
        jsonb_build_object('key', 'ai_personalized', 'monthly_cents', 9900, 'annual_cents', 100980)
      )
    ),
    'Seed inicial alineado con simulador Fase 2. Costes internos solo SuperAdmin.'
  )
  RETURNING id INTO v_version_id;

  INSERT INTO public.commercial_plan_price_versions (
    tariff_version_id, sku_id, monthly_cents, annual_cents, trial_days, extension_days
  )
  SELECT
    v_version_id,
    s.id,
    CASE s.key
      WHEN 'pilot' THEN 0
      WHEN 'general' THEN 3900
      WHEN 'personalized' THEN 6900
      WHEN 'ai_personalized' THEN 9900
    END,
    CASE s.key
      WHEN 'pilot' THEN 0
      WHEN 'general' THEN 39780
      WHEN 'personalized' THEN 70380
      WHEN 'ai_personalized' THEN 100980
    END,
    CASE WHEN s.key = 'pilot' THEN 15 ELSE NULL END,
    CASE WHEN s.key = 'pilot' THEN 15 ELSE NULL END
  FROM public.commercial_plan_skus s
  WHERE s.key IN ('pilot', 'general', 'personalized', 'ai_personalized');
END;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.commercial_plan_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_tariff_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_plan_price_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY commercial_plan_skus_select ON public.commercial_plan_skus
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.commercial_tariffs.read')
    OR public.ff_has_platform_permission('platform.commercial_tariffs.write')
  );

CREATE POLICY commercial_plan_skus_write ON public.commercial_plan_skus
  FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.commercial_tariffs.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.commercial_tariffs.write'));

CREATE POLICY commercial_tariff_versions_select ON public.commercial_tariff_versions
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.commercial_tariffs.read')
    OR public.ff_has_platform_permission('platform.commercial_tariffs.write')
  );

-- INSERT permitido; UPDATE/DELETE de importes se bloquea en RPC/trigger (050).
CREATE POLICY commercial_tariff_versions_insert ON public.commercial_tariff_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.ff_has_platform_permission('platform.commercial_tariffs.write'));

CREATE POLICY commercial_tariff_versions_update_meta ON public.commercial_tariff_versions
  FOR UPDATE TO authenticated
  USING (public.ff_has_platform_permission('platform.commercial_tariffs.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.commercial_tariffs.write'));

CREATE POLICY commercial_plan_price_versions_select ON public.commercial_plan_price_versions
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.commercial_tariffs.read')
    OR public.ff_has_platform_permission('platform.commercial_tariffs.write')
  );

CREATE POLICY commercial_plan_price_versions_insert ON public.commercial_plan_price_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.ff_has_platform_permission('platform.commercial_tariffs.write'));

GRANT SELECT, INSERT, UPDATE ON public.commercial_plan_skus TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.commercial_tariff_versions TO authenticated;
GRANT SELECT, INSERT ON public.commercial_plan_price_versions TO authenticated;

-- DOWN (desarrollo):
-- DROP POLICY IF EXISTS commercial_plan_price_versions_insert ON public.commercial_plan_price_versions;
-- DROP POLICY IF EXISTS commercial_plan_price_versions_select ON public.commercial_plan_price_versions;
-- DROP POLICY IF EXISTS commercial_tariff_versions_update_meta ON public.commercial_tariff_versions;
-- DROP POLICY IF EXISTS commercial_tariff_versions_insert ON public.commercial_tariff_versions;
-- DROP POLICY IF EXISTS commercial_tariff_versions_select ON public.commercial_tariff_versions;
-- DROP POLICY IF EXISTS commercial_plan_skus_write ON public.commercial_plan_skus;
-- DROP POLICY IF EXISTS commercial_plan_skus_select ON public.commercial_plan_skus;
-- DROP TABLE IF EXISTS public.commercial_plan_price_versions;
-- DROP TABLE IF EXISTS public.commercial_tariff_versions;
-- DROP TABLE IF EXISTS public.commercial_plan_skus;
-- DELETE FROM public.platform_permissions WHERE key LIKE 'platform.commercial_tariffs.%';
