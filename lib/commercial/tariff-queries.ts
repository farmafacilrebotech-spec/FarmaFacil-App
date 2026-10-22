import { createClient } from '@/lib/supabase/server';
import { hasPlatformPermission } from '@/lib/auth/platform';
import {
  DEFAULT_COMMERCIAL_TARIFF_CONFIG,
  withoutInternalCosts,
  type CommercialTariffConfig,
} from '@/lib/tarifas';

export type TariffConfigLoadResult = {
  config: CommercialTariffConfig;
  canViewInternalCosts: boolean;
  source: 'defaults' | 'commercial_rpc' | 'internal_rpc';
};

/**
 * Carga tarifas para /tarifas.
 * - Sin write: solo RPC comercial 052 (sin costes) + defaults de planes;
 *   kioskInternalCostCents siempre null en el payload.
 * - Con write: puede enriquecer coste interno vía RPC internal.
 * Nunca hace SELECT * a commercial_tariff_versions desde el cliente.
 */
export async function loadTariffConfigForSession(): Promise<TariffConfigLoadResult> {
  const [write, read] = await Promise.all([
    hasPlatformPermission('platform.commercial_tariffs.write'),
    hasPlatformPermission('platform.commercial_tariffs.read'),
  ]);

  if (!write.ok && !read.ok) {
    return {
      config: withoutInternalCosts(DEFAULT_COMMERCIAL_TARIFF_CONFIG),
      canViewInternalCosts: false,
      source: 'defaults',
    };
  }

  const supabase = createClient();

  if (write.ok) {
    const { data, error } = await supabase.rpc(
      'ff_list_commercial_tariff_versions_internal_v1'
    );
    if (error) {
      console.error('[tariffs] internal list', error.code, error.message);
      // Fallback seguro: sin costes en payload hasta poder cargar
      return {
        config: withoutInternalCosts(DEFAULT_COMMERCIAL_TARIFF_CONFIG),
        canViewInternalCosts: true,
        source: 'defaults',
      };
    }
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    const current =
      rows.find((r) => (r as { is_current?: boolean }).is_current) ?? rows[0];
    if (!current || typeof current !== 'object') {
      return {
        config: DEFAULT_COMMERCIAL_TARIFF_CONFIG,
        canViewInternalCosts: true,
        source: 'defaults',
      };
    }
    const row = current as Record<string, unknown>;
    return {
      config: {
        ...DEFAULT_COMMERCIAL_TARIFF_CONFIG,
        vatBps: Number(row.vat_bps ?? DEFAULT_COMMERCIAL_TARIFF_CONFIG.vatBps),
        saasAnnualDiscountBps: Number(
          row.saas_annual_discount_bps ??
            DEFAULT_COMMERCIAL_TARIFF_CONFIG.saasAnnualDiscountBps
        ),
        kioskLicenseAnnualDiscountBps: Number(
          row.kiosk_license_annual_discount_bps ??
            DEFAULT_COMMERCIAL_TARIFF_CONFIG.kioskLicenseAnnualDiscountBps
        ),
        kioskHardwareUnitCents: Number(
          row.kiosk_hardware_unit_cents ??
            DEFAULT_COMMERCIAL_TARIFF_CONFIG.kioskHardwareUnitCents
        ),
        kioskLicenseMonthlyCents: Number(
          row.kiosk_license_monthly_cents ??
            DEFAULT_COMMERCIAL_TARIFF_CONFIG.kioskLicenseMonthlyCents
        ),
        kioskInternalCostCents: Number(
          row.kiosk_internal_cost_cents ??
            DEFAULT_COMMERCIAL_TARIFF_CONFIG.kioskInternalCostCents
        ),
        defaultOnsiteInstallCents: Number(
          row.default_onsite_install_cents ??
            DEFAULT_COMMERCIAL_TARIFF_CONFIG.defaultOnsiteInstallCents
        ),
      },
      canViewInternalCosts: true,
      source: 'internal_rpc',
    };
  }

  // Solo read (p.ej. Support): RPC comercial sin costes.
  const { data, error } = await supabase.rpc(
    'ff_list_commercial_tariff_versions_commercial_v1'
  );
  if (error) {
    console.error('[tariffs] commercial list', error.code, error.message);
    return {
      config: withoutInternalCosts(DEFAULT_COMMERCIAL_TARIFF_CONFIG),
      canViewInternalCosts: false,
      source: 'defaults',
    };
  }
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const current =
    rows.find((r) => (r as { is_current?: boolean }).is_current) ?? rows[0];
  if (!current || typeof current !== 'object') {
    return {
      config: withoutInternalCosts(DEFAULT_COMMERCIAL_TARIFF_CONFIG),
      canViewInternalCosts: false,
      source: 'defaults',
    };
  }
  const row = current as Record<string, unknown>;
  // Defensa: aunque la RPC filtrara mal, no propagar claves de coste.
  const safe = withoutInternalCosts({
    ...DEFAULT_COMMERCIAL_TARIFF_CONFIG,
    vatBps: Number(row.vat_bps ?? DEFAULT_COMMERCIAL_TARIFF_CONFIG.vatBps),
    saasAnnualDiscountBps: Number(
      row.saas_annual_discount_bps ??
        DEFAULT_COMMERCIAL_TARIFF_CONFIG.saasAnnualDiscountBps
    ),
    kioskLicenseAnnualDiscountBps: Number(
      row.kiosk_license_annual_discount_bps ??
        DEFAULT_COMMERCIAL_TARIFF_CONFIG.kioskLicenseAnnualDiscountBps
    ),
    kioskHardwareUnitCents: Number(
      row.kiosk_hardware_unit_cents ??
        DEFAULT_COMMERCIAL_TARIFF_CONFIG.kioskHardwareUnitCents
    ),
    kioskLicenseMonthlyCents: Number(
      row.kiosk_license_monthly_cents ??
        DEFAULT_COMMERCIAL_TARIFF_CONFIG.kioskLicenseMonthlyCents
    ),
    kioskInternalCostCents: null,
    defaultOnsiteInstallCents: Number(
      row.default_onsite_install_cents ??
        DEFAULT_COMMERCIAL_TARIFF_CONFIG.defaultOnsiteInstallCents
    ),
  });

  return {
    config: safe,
    canViewInternalCosts: false,
    source: 'commercial_rpc',
  };
}
