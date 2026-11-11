-- =============================================================================
-- 083_commercial_plans_activation_v1.sql
-- Activación de planes técnicos comerciales + tarifa lista (vs promo lanzamiento).
--
-- Diferencias vs draft 056:
--   1) Crea filas plans: general / personalizado / asistente_ia_personalizado
--      (056 reutilizaba starter/pro/business como technical_plan_key).
--   2) Actualiza ff_commercial_sku_effects_v1 para mapear a esas claves.
--   3) Publica versión de tarifa con precios LISTA 97,50 / 172,50 / 247,50 €
--      y documenta promo launch_2027 (39 / 69 / 99 €, 20 plazas, −60 %)
--      + prepago anual −15 % en snapshot. No confunde plan contratado con promo.
--   4) NO backfill / NO reescribe farmacias ni suscripciones existentes.
--   5) Asume 056 ya aplicado (tabla + RPC). Si faltara, aplicar antes el draft.
--
-- NO APLICAR EN PRODUCCIÓN sin autorización expresa.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Prerrequisitos
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.pharmacy_commercial_assignments') IS NULL THEN
    RAISE EXCEPTION '083 requires pharmacy_commercial_assignments (apply draft 056 first)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'ff_assign_commercial_plan_v1'
  ) THEN
    RAISE EXCEPTION '083 requires ff_assign_commercial_plan_v1 (apply draft 056 first)';
  END IF;
  IF to_regclass('public.commercial_plan_skus') IS NULL THEN
    RAISE EXCEPTION '083 requires commercial_plan_skus (047)';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1) Planes técnicos comerciales (sin tocar starter/pro/business/enterprise)
-- -----------------------------------------------------------------------------
INSERT INTO public.plans (key, name, description, is_active, sort_order)
VALUES
  (
    'general',
    'General',
    'Plan comercial General: QR, catálogo maestro genérico, pedidos. Sin asistente IA contracted.',
    true,
    15
  ),
  (
    'personalizado',
    'Personalizado',
    'Plan comercial Personalizado: catálogo propio, cuenta cliente, pedidos. Sin asistente IA contracted.',
    true,
    25
  ),
  (
    'asistente_ia_personalizado',
    'IA',
    'Plan comercial IA: Personalizado + asistente ligado al catálogo (addon contracted).',
    true,
    35
  )
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true,
  sort_order = EXCLUDED.sort_order,
  updated_at = pg_catalog.now();

-- Módulos/límites: espejo de starter/pro/business + orders (si existe el módulo).
INSERT INTO public.plan_modules (plan_id, module_id, default_limits)
SELECT
  dst.id AS plan_id,
  pm.module_id,
  pm.default_limits
FROM public.plans src
JOIN public.plan_modules pm ON pm.plan_id = src.id
JOIN public.plans dst ON dst.key = CASE src.key
  WHEN 'starter' THEN 'general'
  WHEN 'pro' THEN 'personalizado'
  WHEN 'business' THEN 'asistente_ia_personalizado'
END
WHERE src.key IN ('starter', 'pro', 'business')
ON CONFLICT (plan_id, module_id) DO UPDATE
SET default_limits = EXCLUDED.default_limits;

-- -----------------------------------------------------------------------------
-- 2) Mapa SKU comercial → plan técnico comercial (reemplaza espejo 056)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_commercial_sku_effects_v1(p_sku_key text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_key text := lower(btrim(coalesce(p_sku_key, '')));
BEGIN
  IF v_key = 'pilot' THEN
    RETURN jsonb_build_object(
      'catalog_mode', 'generic',
      'technical_plan_key', 'starter',
      'assistant_action', 'none',
      'profile', 'pilot_v1',
      'creates_paid_subscription', false,
      'attach_master', true,
      'is_pilot', true
    );
  ELSIF v_key = 'general' THEN
    RETURN jsonb_build_object(
      'catalog_mode', 'generic',
      'technical_plan_key', 'general',
      'assistant_action', 'none',
      'profile', 'general_v1',
      'creates_paid_subscription', true,
      'attach_master', true,
      'is_pilot', false
    );
  ELSIF v_key = 'personalized' THEN
    RETURN jsonb_build_object(
      'catalog_mode', 'own',
      'technical_plan_key', 'personalizado',
      'assistant_action', 'none',
      'profile', 'personalized_v1',
      'creates_paid_subscription', true,
      'attach_master', false,
      'is_pilot', false
    );
  ELSIF v_key = 'ai_personalized' THEN
    RETURN jsonb_build_object(
      'catalog_mode', 'own',
      'technical_plan_key', 'asistente_ia_personalizado',
      'assistant_action', 'activate_contracted',
      'profile', 'ai_personalized_v1',
      'creates_paid_subscription', true,
      'attach_master', false,
      'is_pilot', false
    );
  END IF;
  RAISE EXCEPTION 'unknown_commercial_sku: %', v_key USING ERRCODE = 'P0002';
END;
$$;

COMMENT ON FUNCTION public.ff_commercial_sku_effects_v1(text) IS
  '083: SKU comercial → efectos. technical_plan_key usa plans comerciales (general/personalizado/asistente_ia_personalizado); pilot sigue en starter.';

-- -----------------------------------------------------------------------------
-- 3) Tarifa LISTA (no promo). Promo launch_2027 solo en snapshot / motor UI.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_uid uuid;
  v_old uuid;
  v_new uuid;
  v_vat integer := 2100;
  v_annual_bps integer := 1500; -- 15 % prepago anual SaaS
BEGIN
  SELECT id INTO v_old
  FROM public.commercial_tariff_versions
  WHERE is_current
  ORDER BY created_at DESC
  LIMIT 1;

  -- Desmarcar current (si hay)
  UPDATE public.commercial_tariff_versions
  SET is_current = false
  WHERE is_current;

  INSERT INTO public.commercial_tariff_versions (
    version_label,
    is_current,
    vat_bps,
    saas_annual_discount_bps,
    kiosk_license_annual_discount_bps,
    kiosk_hardware_unit_cents,
    kiosk_license_monthly_cents,
    kiosk_internal_cost_cents,
    default_onsite_install_cents,
    notes,
    snapshot
  )
  VALUES (
    'v2-list-2027',
    true,
    v_vat,
    v_annual_bps,
    0,
    109000, -- 1.090 € personalización kiosko (concepto comercial)
    4900,   -- 49 €/mes alquiler
    68000,
    0,
    'Precios LISTA SaaS. Promo launch_2027 (39/69/99, max 20 plazas, −60 %) NO es el precio base del plan.',
    jsonb_build_object(
      'price_basis', 'list',
      'list_monthly_eur', jsonb_build_object(
        'general', 97.5,
        'personalized', 172.5,
        'ai_personalized', 247.5
      ),
      'saas_annual_discount_bps', v_annual_bps,
      'launch_2027', jsonb_build_object(
        'discount_bps', 6000,
        'max_slots', 20,
        'monthly_cents', jsonb_build_object(
          'general', 3900,
          'personalized', 6900,
          'ai_personalized', 9900
        ),
        'note', 'Tarifa promocional de cohorte; distinta del plan contratado. Enforcement de plazas: pendiente de RPC/contador (no en 083).'
      ),
      'cohort_2027_in_2028', jsonb_build_object(
        'discount_bps', 3000,
        'note', '−30 % sobre lista para cohorte que firmó en 2027, facturando en 2028.'
      ),
      'previous_tariff_id', v_old
    )
  )
  RETURNING id INTO v_new;

  INSERT INTO public.commercial_plan_price_versions (
    tariff_version_id, sku_id, monthly_cents, annual_cents, trial_days, extension_days
  )
  SELECT
    v_new,
    s.id,
    CASE s.key
      WHEN 'pilot' THEN 0
      WHEN 'general' THEN 9750
      WHEN 'personalized' THEN 17250
      WHEN 'ai_personalized' THEN 24750
    END,
    CASE s.key
      WHEN 'pilot' THEN 0
      -- annual = round_to_euro(monthly * 12 * 0.85)
      WHEN 'general' THEN 99500
      WHEN 'personalized' THEN 176000
      WHEN 'ai_personalized' THEN 252500
    END,
    CASE WHEN s.key = 'pilot' THEN 15 ELSE NULL END,
    CASE WHEN s.key = 'pilot' THEN 15 ELSE NULL END
  FROM public.commercial_plan_skus s
  WHERE s.key IN ('pilot', 'general', 'personalized', 'ai_personalized');
END $$;

-- -----------------------------------------------------------------------------
-- 4) Contador de plazas launch_2027 (sin consumir automáticamente)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_launch_cohort_counters (
  cohort_key text PRIMARY KEY,
  max_slots integer NOT NULL CHECK (max_slots > 0),
  used_slots integer NOT NULL DEFAULT 0 CHECK (used_slots >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT commercial_launch_cohort_counters_used_le_max_chk CHECK (used_slots <= max_slots)
);

COMMENT ON TABLE public.commercial_launch_cohort_counters IS
  'Plazas promocionales por cohorte. 083 inicializa launch_2027=20; el consumo lo hará una RPC de pricing futura (no auto).';

INSERT INTO public.commercial_launch_cohort_counters (cohort_key, max_slots, used_slots, notes)
VALUES (
  'launch_2027',
  20,
  0,
  'Dto. −60 % sobre lista → 39/69/99 €. No confundir con plan contratado.'
)
ON CONFLICT (cohort_key) DO NOTHING;

ALTER TABLE public.commercial_launch_cohort_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_launch_cohort_counters_select
  ON public.commercial_launch_cohort_counters;
CREATE POLICY commercial_launch_cohort_counters_select
  ON public.commercial_launch_cohort_counters
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.commercial_trials.manage')
    OR public.ff_has_platform_permission('platform.subscriptions.manage')
    OR public.ff_has_platform_permission('platform.pharmacies.read')
  );

DROP POLICY IF EXISTS commercial_launch_cohort_counters_write
  ON public.commercial_launch_cohort_counters;
CREATE POLICY commercial_launch_cohort_counters_write
  ON public.commercial_launch_cohort_counters
  FOR ALL TO authenticated
  USING (
    public.ff_has_platform_permission('platform.subscriptions.manage')
    AND public.ff_has_platform_permission('platform.pharmacies.write')
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.subscriptions.manage')
    AND public.ff_has_platform_permission('platform.pharmacies.write')
  );

GRANT SELECT ON public.commercial_launch_cohort_counters TO authenticated;
GRANT INSERT, UPDATE ON public.commercial_launch_cohort_counters TO authenticated;

-- -----------------------------------------------------------------------------
-- DOWN (manual, no destructivo de datos de farmacias):
--   UPDATE commercial_tariff_versions SET is_current=false WHERE version_label='v2-list-2027';
--   UPDATE commercial_tariff_versions SET is_current=true WHERE id = <previous>;
--   -- opcional: DELETE plans comerciales solo si ninguna farmacia/subscription los usa
--   DROP TABLE IF EXISTS public.commercial_launch_cohort_counters;
--   -- restaurar ff_commercial_sku_effects_v1 desde draft 056 si se desea rollback de mapa
-- =============================================================================
