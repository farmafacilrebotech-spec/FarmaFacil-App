/**
 * Motor comercial FarmaFácil (Fase 2 — UI / memoria).
 * Archivo único (sin imports relativos) para convivir node:test + tsc.
 * Independiente de starter|pro|business|enterprise. No toca Supabase.
 */

/** Puntos base: 10000 = 100 %, 2100 = 21 %, 1500 = 15 %. */
export type BasisPoints = number;

export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

export function centsToEuros(cents: number): number {
  return cents / 100;
}

export function applyBps(cents: number, bps: BasisPoints): number {
  return Math.round((cents * bps) / 10000);
}

export function applyDiscountBps(
  cents: number,
  discountBps: BasisPoints
): number {
  const remaining = 10000 - discountBps;
  return Math.round((cents * remaining) / 10000);
}

export function annualFromMonthly(
  monthlyCents: number,
  annualDiscountBps: BasisPoints
): number {
  return applyDiscountBps(monthlyCents * 12, annualDiscountBps);
}

export function formatCentsEur(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centsToEuros(cents));
}

export function formatBpsPercent(bps: BasisPoints): string {
  const pct = bps / 100;
  return `${pct.toLocaleString('es-ES', {
    minimumFractionDigits: Number.isInteger(pct) ? 0 : 1,
    maximumFractionDigits: 2,
  })} %`;
}

export function grossMarginPercent(
  saleCents: number,
  costCents: number
): number | null {
  if (saleCents <= 0) return null;
  return ((saleCents - costCents) / saleCents) * 100;
}

export type CommercialPlanId =
  | 'pilot'
  | 'general'
  | 'personalized'
  | 'ai_personalized';

export type BillingInterval = 'monthly' | 'annual';

export type FeatureMatrixKey =
  | 'monthlyPrice'
  | 'duration'
  | 'pharmacyQr'
  | 'genericCatalog'
  | 'ownCatalog'
  | 'genericAssistant'
  | 'catalogAssistant'
  | 'orders'
  | 'namePhone'
  | 'clientAccount'
  | 'clientHistory'
  | 'physicalKioskOptional';

export type FeatureCell = string | boolean;

export type CommercialPlanDefinition = {
  id: CommercialPlanId;
  name: string;
  tagline: string;
  monthlyCents: number;
  trialDays: number | null;
  extensionDays: number | null;
  allowsKiosk: boolean;
  includesGenericAssistant: boolean;
  includesPersonalizedAssistant: boolean;
  includesOwnCatalog: boolean;
  includesClientAccount: boolean;
  active: boolean;
};

export type CommercialTariffConfig = {
  vatBps: number;
  saasAnnualDiscountBps: number;
  kioskLicenseAnnualDiscountBps: number;
  kioskHardwareUnitCents: number;
  kioskLicenseMonthlyCents: number;
  /**
   * Coste interno hardware. Null = no autorizado / no incluido en payload
   * (Support u otros sin commercial_tariffs.write). Nunca enviar el valor real
   * a clientes sin permiso write.
   */
  kioskInternalCostCents: number | null;
  defaultOnsiteInstallCents: number;
  plans: CommercialPlanDefinition[];
};

/** Configuración pública sin costes internos (safe para Support / read). */
export function withoutInternalCosts(
  config: CommercialTariffConfig
): CommercialTariffConfig {
  return { ...config, kioskInternalCostCents: null };
}

export const DEFAULT_COMMERCIAL_TARIFF_CONFIG: CommercialTariffConfig = {
  vatBps: 2100,
  saasAnnualDiscountBps: 1500,
  kioskLicenseAnnualDiscountBps: 1500,
  kioskHardwareUnitCents: eurosToCents(1290),
  kioskLicenseMonthlyCents: eurosToCents(19),
  kioskInternalCostCents: eurosToCents(800),
  defaultOnsiteInstallCents: eurosToCents(0),
  plans: [
    {
      id: 'pilot',
      name: 'Piloto gratuito',
      tagline: '15 días naturales · ampliación excepcional +15 días',
      monthlyCents: 0,
      trialDays: 15,
      extensionDays: 15,
      allowsKiosk: false,
      includesGenericAssistant: true,
      includesPersonalizedAssistant: false,
      includesOwnCatalog: false,
      includesClientAccount: false,
      active: true,
    },
    {
      id: 'general',
      name: 'General',
      tagline: 'QR, catálogo genérico y asistente genérico',
      monthlyCents: eurosToCents(39),
      trialDays: null,
      extensionDays: null,
      allowsKiosk: true,
      includesGenericAssistant: true,
      includesPersonalizedAssistant: false,
      includesOwnCatalog: false,
      includesClientAccount: false,
      active: true,
    },
    {
      id: 'personalized',
      name: 'Personalizado',
      tagline: 'Catálogo propio, precios y cuenta de cliente',
      monthlyCents: eurosToCents(69),
      trialDays: null,
      extensionDays: null,
      allowsKiosk: true,
      includesGenericAssistant: true,
      includesPersonalizedAssistant: false,
      includesOwnCatalog: true,
      includesClientAccount: true,
      active: true,
    },
    {
      id: 'ai_personalized',
      name: 'Con Asistente IA personalizado',
      tagline: 'Todo lo Personalizado + asistente ligado al catálogo',
      monthlyCents: eurosToCents(99),
      trialDays: null,
      extensionDays: null,
      allowsKiosk: true,
      includesGenericAssistant: true,
      includesPersonalizedAssistant: true,
      includesOwnCatalog: true,
      includesClientAccount: true,
      active: true,
    },
  ],
};

export function getPlan(
  config: CommercialTariffConfig,
  id: CommercialPlanId
): CommercialPlanDefinition {
  const plan = config.plans.find((p) => p.id === id);
  if (!plan) {
    throw new Error(`Plan comercial desconocido: ${id}`);
  }
  return plan;
}

export function planAnnualCents(
  config: CommercialTariffConfig,
  id: CommercialPlanId
): number {
  const plan = getPlan(config, id);
  if (plan.monthlyCents === 0) return 0;
  return annualFromMonthly(plan.monthlyCents, config.saasAnnualDiscountBps);
}

export function kioskLicenseAnnualCents(
  config: CommercialTariffConfig
): number {
  return annualFromMonthly(
    config.kioskLicenseMonthlyCents,
    config.kioskLicenseAnnualDiscountBps
  );
}

export const FEATURE_COMPARISON_ROWS: Array<{
  key: FeatureMatrixKey;
  label: string;
  values: Record<CommercialPlanId, FeatureCell>;
}> = [
  {
    key: 'monthlyPrice',
    label: 'Precio mensual',
    values: {
      pilot: 'Gratis',
      general: '39 €',
      personalized: '69 €',
      ai_personalized: '99 €',
    },
  },
  {
    key: 'duration',
    label: 'Duración',
    values: {
      pilot: '15 días',
      general: 'Suscripción',
      personalized: 'Suscripción',
      ai_personalized: 'Suscripción',
    },
  },
  {
    key: 'pharmacyQr',
    label: 'QR de farmacia',
    values: {
      pilot: true,
      general: true,
      personalized: true,
      ai_personalized: true,
    },
  },
  {
    key: 'genericCatalog',
    label: 'Catálogo genérico',
    values: {
      pilot: true,
      general: true,
      personalized: false,
      ai_personalized: false,
    },
  },
  {
    key: 'ownCatalog',
    label: 'Catálogo propio',
    values: {
      pilot: false,
      general: false,
      personalized: true,
      ai_personalized: true,
    },
  },
  {
    key: 'genericAssistant',
    label: 'Asistente genérico',
    values: {
      pilot: true,
      general: true,
      personalized: true,
      ai_personalized: true,
    },
  },
  {
    key: 'catalogAssistant',
    label: 'Asistente conectado a catálogo propio',
    values: {
      pilot: false,
      general: false,
      personalized: false,
      ai_personalized: true,
    },
  },
  {
    key: 'orders',
    label: 'Solicitudes / pedidos',
    values: {
      pilot: true,
      general: true,
      personalized: true,
      ai_personalized: true,
    },
  },
  {
    key: 'namePhone',
    label: 'Nombre y teléfono del cliente',
    values: {
      pilot: true,
      general: true,
      personalized: true,
      ai_personalized: true,
    },
  },
  {
    key: 'clientAccount',
    label: 'Cuenta de cliente',
    values: {
      pilot: false,
      general: false,
      personalized: true,
      ai_personalized: true,
    },
  },
  {
    key: 'clientHistory',
    label: 'Historial del cliente',
    values: {
      pilot: false,
      general: false,
      personalized: true,
      ai_personalized: true,
    },
  },
  {
    key: 'physicalKioskOptional',
    label: 'Kiosko físico opcional',
    values: {
      pilot: false,
      general: true,
      personalized: true,
      ai_personalized: true,
    },
  },
];

export const INTERNAL_PLAN_KEYS_UNMAPPED = [
  'starter',
  'pro',
  'business',
  'enterprise',
] as const;

export type SimulatorInput = {
  planId: CommercialPlanId;
  interval: BillingInterval;
  kioskCount: number;
  hardwareUnitCents?: number;
  licenseMonthlyCents?: number;
  onsiteInstallCents: number;
  additionalServicesCents: number;
  oneTimeDiscountCents: number;
  recurringExtraDiscountCents: number;
};

export type SimulatorBreakdown = {
  planId: CommercialPlanId;
  interval: BillingInterval;
  kioskCount: number;
  isPilot: boolean;
  hardwareCents: number;
  onsiteInstallCents: number;
  additionalServicesCents: number;
  oneTimeDiscountCents: number;
  oneTimeNetCents: number;
  oneTimeVatCents: number;
  oneTimeGrossCents: number;
  planRecurringCents: number;
  kioskLicenseRecurringCents: number;
  recurringExtraDiscountCents: number;
  recurringNetCents: number;
  recurringVatCents: number;
  recurringGrossCents: number;
  firstYearSubscriptionCents: number;
  firstYearNetCents: number;
  firstYearVatCents: number;
  firstYearGrossCents: number;
  laterYearsRecurringNetCents: number;
  hardwareSaleCents: number;
  hardwareCostCents: number;
  hardwareProfitCents: number;
  hardwareMarginPercent: number | null;
};

function clampNonNeg(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

export function normalizeSimulatorInput(
  config: CommercialTariffConfig,
  input: SimulatorInput
): SimulatorInput {
  const plan = getPlan(config, input.planId);
  const isPilot = plan.id === 'pilot';
  const kioskCount = isPilot
    ? 0
    : Math.max(0, Math.floor(input.kioskCount || 0));

  return {
    planId: input.planId,
    interval: isPilot ? 'monthly' : input.interval,
    kioskCount,
    hardwareUnitCents: clampNonNeg(
      input.hardwareUnitCents ?? config.kioskHardwareUnitCents
    ),
    licenseMonthlyCents: clampNonNeg(
      input.licenseMonthlyCents ?? config.kioskLicenseMonthlyCents
    ),
    onsiteInstallCents: isPilot ? 0 : clampNonNeg(input.onsiteInstallCents),
    additionalServicesCents: isPilot
      ? 0
      : clampNonNeg(input.additionalServicesCents),
    oneTimeDiscountCents: isPilot ? 0 : clampNonNeg(input.oneTimeDiscountCents),
    recurringExtraDiscountCents: isPilot
      ? 0
      : clampNonNeg(input.recurringExtraDiscountCents),
  };
}

export function calculateQuote(
  config: CommercialTariffConfig,
  rawInput: SimulatorInput
): SimulatorBreakdown {
  const input = normalizeSimulatorInput(config, rawInput);
  const plan = getPlan(config, input.planId);
  const isPilot = plan.id === 'pilot';
  const vatBps = config.vatBps;

  const hardwareUnit = input.hardwareUnitCents ?? config.kioskHardwareUnitCents;
  const licenseMonthly =
    input.licenseMonthlyCents ?? config.kioskLicenseMonthlyCents;

  const hardwareCents = isPilot ? 0 : input.kioskCount * hardwareUnit;
  const onsiteInstallCents = input.onsiteInstallCents;
  const additionalServicesCents = input.additionalServicesCents;
  const oneTimeDiscountCents = Math.min(
    input.oneTimeDiscountCents,
    hardwareCents + onsiteInstallCents + additionalServicesCents
  );

  const oneTimeBeforeDiscount =
    hardwareCents + onsiteInstallCents + additionalServicesCents;
  const oneTimeNetCents = Math.max(
    0,
    oneTimeBeforeDiscount - oneTimeDiscountCents
  );
  const oneTimeVatCents = applyBps(oneTimeNetCents, vatBps);
  const oneTimeGrossCents = oneTimeNetCents + oneTimeVatCents;

  let planRecurringCents = 0;
  let kioskLicenseRecurringCents = 0;

  if (!isPilot) {
    if (input.interval === 'monthly') {
      planRecurringCents = plan.monthlyCents;
      kioskLicenseRecurringCents = input.kioskCount * licenseMonthly;
    } else {
      planRecurringCents = annualFromMonthly(
        plan.monthlyCents,
        config.saasAnnualDiscountBps
      );
      kioskLicenseRecurringCents =
        input.kioskCount *
        annualFromMonthly(
          licenseMonthly,
          config.kioskLicenseAnnualDiscountBps
        );
    }
  }

  const recurringBeforeExtra = planRecurringCents + kioskLicenseRecurringCents;
  const recurringExtraDiscountCents = Math.min(
    input.recurringExtraDiscountCents,
    recurringBeforeExtra
  );
  const recurringNetCents = Math.max(
    0,
    recurringBeforeExtra - recurringExtraDiscountCents
  );
  const recurringVatCents = applyBps(recurringNetCents, vatBps);
  const recurringGrossCents = recurringNetCents + recurringVatCents;

  let firstYearSubscriptionCents = 0;
  if (!isPilot) {
    if (input.interval === 'monthly') {
      firstYearSubscriptionCents = recurringNetCents * 12;
    } else {
      firstYearSubscriptionCents = recurringNetCents;
    }
  }

  const firstYearNetCents = oneTimeNetCents + firstYearSubscriptionCents;
  const firstYearVatCents = applyBps(firstYearNetCents, vatBps);
  const firstYearGrossCents = firstYearNetCents + firstYearVatCents;

  const laterYearsRecurringNetCents = isPilot
    ? 0
    : input.interval === 'monthly'
      ? recurringNetCents * 12
      : recurringNetCents;

  const hardwareSaleCents = hardwareCents;
  const internalUnit = config.kioskInternalCostCents;
  const hasInternalCost =
    !isPilot && internalUnit != null && Number.isFinite(internalUnit);
  const hardwareCostCents = hasInternalCost
    ? input.kioskCount * (internalUnit as number)
    : 0;
  const hardwareProfitCents = hasInternalCost
    ? hardwareSaleCents - hardwareCostCents
    : 0;
  const hardwareMarginPercent = hasInternalCost
    ? grossMarginPercent(hardwareSaleCents, hardwareCostCents)
    : null;

  return {
    planId: input.planId,
    interval: input.interval,
    kioskCount: input.kioskCount,
    isPilot,
    hardwareCents,
    onsiteInstallCents,
    additionalServicesCents,
    oneTimeDiscountCents,
    oneTimeNetCents,
    oneTimeVatCents,
    oneTimeGrossCents,
    planRecurringCents,
    kioskLicenseRecurringCents,
    recurringExtraDiscountCents,
    recurringNetCents,
    recurringVatCents,
    recurringGrossCents,
    firstYearSubscriptionCents,
    firstYearNetCents,
    firstYearVatCents,
    firstYearGrossCents,
    laterYearsRecurringNetCents,
    hardwareSaleCents,
    hardwareCostCents,
    hardwareProfitCents,
    hardwareMarginPercent,
  };
}
