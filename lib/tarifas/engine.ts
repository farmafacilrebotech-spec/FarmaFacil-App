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

/** Redondeo comercial a euro entero (para referencias de prepago anual). */
export function roundCentsToEuro(cents: number): number {
  return Math.round(cents / 100) * 100;
}

export function formatCentsEur(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centsToEuros(cents));
}

export function formatCentsEurWhole(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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

/**
 * Incremento sobre precio de venta (p. ej. recargo de equivalencia).
 * No altera tarifas base, descuentos ni costes.
 */
export function applySaleSurchargeBps(
  saleCents: number,
  surchargeBps: BasisPoints
): number {
  if (!Number.isFinite(surchargeBps) || surchargeBps <= 0) {
    return Math.round(saleCents);
  }
  return Math.round(saleCents) + applyBps(Math.round(saleCents), surchargeBps);
}

export type CommercialPlanId =
  | 'pilot'
  | 'general'
  | 'personalized'
  | 'ai_personalized';

export type BillingInterval = 'monthly' | 'annual';

/** Modo de cuota SaaS según cohorte / año de facturación. */
export type SaasCohortPricing =
  | 'normal'
  | 'launch_2027'
  | 'cohort_2027_in_2028';

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

/**
 * Supuestos comerciales y de aprovisionamiento (sesión / memoria).
 * Cantidades de inventario se expresan en unidades o meses, no en %.
 */
export type CommercialAssumptions = {
  /** Descuento lanzamiento 2027 sobre cuota SaaS (bps). */
  launchDiscount2027Bps: BasisPoints;
  /** Descuento 2028 para cohorte que firmó en 2027 (bps). */
  launchCohort2028DiscountBps: BasisPoints;
  /** Plazas máximas con dto. de lanzamiento 2027. */
  launchSlots2027: number;
  /** Previsión de altas 2027 (independiente del tope de plazas). */
  forecastSignups2027: number;
  /** Alta de aplicación por farmacia (pago único). */
  appSignupFeeCents: number;
  /** Seguro por kiosko (€/año). */
  kioskInsuranceAnnualCents: number;
  /** Kioskos en la inversión inicial (unidades). */
  initialKioskInventoryUnits: number;
  /** Compras posteriores: tamaño de lote (unidades). */
  kioskPurchaseBatchUnits: number;
  /** Plazo de entrega tras pedido (meses). */
  kioskDeliveryMonths: number;
  /** Adopción prevista de prepago anual (0 = no validado). */
  annualPrepayAdoptionBps: BasisPoints;
  /** Bajas mensuales (churn). */
  monthlyChurnBps: BasisPoints;
  /** Equivalente anual aproximado del churn (solo visualización). */
  approximateAnnualChurnBps: BasisPoints;
  /**
   * Recargo de equivalencia / subida de precio de venta (editable).
   * 0 por defecto; p. ej. 400 = 4 %. No se aplica al alquiler ni a costes.
   */
  equivalenceSurchargeBps: BasisPoints;
  /** Hipótesis de aprovisionamiento (no son garantías). */
  kioskProvisioningHypotheses: string[];
};

export type CommercialTariffConfig = {
  vatBps: number;
  saasAnnualDiscountBps: number;
  /**
   * Dto. anual sobre alquiler kiosko. Por defecto 0: el alquiler se cobra
   * mensualmente y no entra en el prepago/descuento SaaS.
   */
  kioskLicenseAnnualDiscountBps: number;
  /** Personalización de kiosko por farmacia (concepto comercial de venta). */
  kioskHardwareUnitCents: number;
  /** Alquiler del kiosko (€/mes). Fuera de descuentos SaaS. */
  kioskLicenseMonthlyCents: number;
  /**
   * Coste interno hardware. Null = no autorizado / no incluido en payload
   * (Support u otros sin commercial_tariffs.write). Nunca enviar el valor real
   * a clientes sin permiso write.
   */
  kioskInternalCostCents: number | null;
  defaultOnsiteInstallCents: number;
  plans: CommercialPlanDefinition[];
  assumptions: CommercialAssumptions;
};

/** Configuración pública sin costes internos (safe para Support / read). */
export function withoutInternalCosts(
  config: CommercialTariffConfig
): CommercialTariffConfig {
  return { ...config, kioskInternalCostCents: null };
}

export const DEFAULT_COMMERCIAL_ASSUMPTIONS: CommercialAssumptions = {
  launchDiscount2027Bps: 6000,
  launchCohort2028DiscountBps: 3000,
  launchSlots2027: 20,
  forecastSignups2027: 15,
  appSignupFeeCents: eurosToCents(190),
  kioskInsuranceAnnualCents: eurosToCents(100),
  initialKioskInventoryUnits: 11,
  kioskPurchaseBatchUnits: 10,
  kioskDeliveryMonths: 2,
  annualPrepayAdoptionBps: 0,
  monthlyChurnBps: 200,
  approximateAnnualChurnBps: 2150,
  equivalenceSurchargeBps: 0,
  kioskProvisioningHypotheses: [
    'Los kioskos se recuperan al cancelar y pueden reutilizarse (hipótesis de trabajo).',
    'Se asegura todo el inventario propiedad de FarmaFácil, instalado y almacenado (hipótesis).',
    'Los lotes se pagan al recibirlos (hipótesis de tesorería).',
  ],
};

export const DEFAULT_COMMERCIAL_TARIFF_CONFIG: CommercialTariffConfig = {
  vatBps: 2100,
  saasAnnualDiscountBps: 1500,
  kioskLicenseAnnualDiscountBps: 0,
  kioskHardwareUnitCents: eurosToCents(1090),
  kioskLicenseMonthlyCents: eurosToCents(49),
  kioskInternalCostCents: eurosToCents(680),
  defaultOnsiteInstallCents: eurosToCents(0),
  assumptions: { ...DEFAULT_COMMERCIAL_ASSUMPTIONS },
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
      monthlyCents: eurosToCents(97.5),
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
      monthlyCents: eurosToCents(172.5),
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
      name: 'IA',
      tagline:
        'Todo lo Personalizado + asistente ligado al catálogo · kiosko opcional (alquiler aparte)',
      monthlyCents: eurosToCents(247.5),
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

export function cohortDiscountBps(
  assumptions: CommercialAssumptions,
  cohort: SaasCohortPricing
): BasisPoints {
  if (cohort === 'launch_2027') return assumptions.launchDiscount2027Bps;
  if (cohort === 'cohort_2027_in_2028') {
    return assumptions.launchCohort2028DiscountBps;
  }
  return 0;
}

/**
 * Cuota SaaS mensual según tarifa base y cohorte (sin recargo de equivalencia).
 * El alquiler de kiosko no entra en esta base.
 */
export function saasMonthlyCentsForCohort(
  baseMonthlyCents: number,
  assumptions: CommercialAssumptions,
  cohort: SaasCohortPricing = 'normal'
): number {
  if (baseMonthlyCents <= 0) return 0;
  const discount = cohortDiscountBps(assumptions, cohort);
  return discount > 0
    ? applyDiscountBps(baseMonthlyCents, discount)
    : Math.round(baseMonthlyCents);
}

/**
 * Precio de venta SaaS mensual (tras dto. de cohorte y recargo de equivalencia).
 */
export function saasMonthlySaleCents(
  config: CommercialTariffConfig,
  planId: CommercialPlanId,
  cohort: SaasCohortPricing = 'normal'
): number {
  const plan = getPlan(config, planId);
  const discounted = saasMonthlyCentsForCohort(
    plan.monthlyCents,
    config.assumptions,
    cohort
  );
  return applySaleSurchargeBps(
    discounted,
    config.assumptions.equivalenceSurchargeBps
  );
}

export function planAnnualCents(
  config: CommercialTariffConfig,
  id: CommercialPlanId,
  cohort: SaasCohortPricing = 'normal'
): number {
  const plan = getPlan(config, id);
  if (plan.monthlyCents === 0) return 0;
  const monthly = saasMonthlyCentsForCohort(
    plan.monthlyCents,
    config.assumptions,
    cohort
  );
  const annual = annualFromMonthly(monthly, config.saasAnnualDiscountBps);
  return applySaleSurchargeBps(
    annual,
    config.assumptions.equivalenceSurchargeBps
  );
}

/** Referencia de prepago anual redondeada al euro (solo visualización). */
export function planAnnualReferenceCents(
  config: CommercialTariffConfig,
  id: CommercialPlanId
): number {
  const plan = getPlan(config, id);
  if (plan.monthlyCents === 0) return 0;
  const exact = annualFromMonthly(
    plan.monthlyCents,
    config.saasAnnualDiscountBps
  );
  return roundCentsToEuro(exact);
}

export function kioskLicenseAnnualCents(
  config: CommercialTariffConfig
): number {
  // Alquiler: cobro mensual × 12; dto. anual de licencia = 0 en supuestos actuales.
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
      general: '97,50 €',
      personalized: '172,50 €',
      ai_personalized: '247,50 €',
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
    label: 'Kiosko físico opcional (alquiler aparte)',
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
  /**
   * @deprecated La instalación presencial ya no es un importe: usar
   * `onsiteInstallIncluded`. Cualquier valor se ignora (forzado a 0).
   */
  onsiteInstallCents?: number;
  /**
   * Extra contractual sin importe: «Incluida» / «No incluida».
   * No altera pago inicial, cuotas, descuentos ni IVA.
   */
  onsiteInstallIncluded?: boolean;
  /**
   * @deprecated Eliminado del presupuesto comercial. Se ignora (0).
   */
  additionalServicesCents?: number;
  /**
   * @deprecated Eliminado del presupuesto comercial. Se ignora (0).
   */
  oneTimeDiscountCents?: number;
  /**
   * @deprecated Eliminado del presupuesto comercial. Se ignora (0).
   */
  recurringExtraDiscountCents?: number;
  /** Cohorte / año de cuota SaaS. Por defecto tarifa normal. */
  cohortPricing?: SaasCohortPricing;
  /** Incluir alta de aplicación (190 €). Default true fuera de piloto. */
  includeAppSignupFee?: boolean;
};

export type SimulatorBreakdown = {
  planId: CommercialPlanId;
  interval: BillingInterval;
  kioskCount: number;
  isPilot: boolean;
  cohortPricing: SaasCohortPricing;
  /** Alta de la aplicación (pago único). */
  appSignupFeeCents: number;
  hardwareCents: number;
  /** Siempre 0: la instalación no aporta importe. */
  onsiteInstallCents: number;
  /** Indicador contractual sin efecto económico. */
  onsiteInstallIncluded: boolean;
  /** Siempre 0 (campo retirado; legado ignorado). */
  additionalServicesCents: number;
  /** Siempre 0 (campo retirado; legado ignorado). */
  oneTimeDiscountCents: number;
  oneTimeNetCents: number;
  oneTimeVatCents: number;
  oneTimeGrossCents: number;
  planRecurringCents: number;
  kioskLicenseRecurringCents: number;
  /** Siempre 0 (campo retirado; legado ignorado). */
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
  equivalenceSurchargeBps: BasisPoints;
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
    // Campos retirados / sin importe: siempre 0 aunque lleguen valores antiguos.
    onsiteInstallCents: 0,
    onsiteInstallIncluded: isPilot
      ? false
      : Boolean(input.onsiteInstallIncluded),
    additionalServicesCents: 0,
    oneTimeDiscountCents: 0,
    recurringExtraDiscountCents: 0,
    cohortPricing: isPilot ? 'normal' : input.cohortPricing ?? 'normal',
    includeAppSignupFee: isPilot
      ? false
      : input.includeAppSignupFee !== false,
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
  const surchargeBps = config.assumptions.equivalenceSurchargeBps;
  const cohort = input.cohortPricing ?? 'normal';

  const hardwareUnitRaw =
    input.hardwareUnitCents ?? config.kioskHardwareUnitCents;
  const licenseMonthly =
    input.licenseMonthlyCents ?? config.kioskLicenseMonthlyCents;

  // Personalización kiosko: precio de venta (puede llevar recargo); coste aparte.
  const hardwareUnitSale = isPilot
    ? 0
    : applySaleSurchargeBps(hardwareUnitRaw, surchargeBps);
  const hardwareCents = isPilot ? 0 : input.kioskCount * hardwareUnitSale;

  const appSignupFeeCents =
    !isPilot && input.includeAppSignupFee
      ? applySaleSurchargeBps(
          config.assumptions.appSignupFeeCents,
          surchargeBps
        )
      : 0;

  // Instalación presencial: solo indicador contractual (sin importe).
  const onsiteInstallIncluded = Boolean(input.onsiteInstallIncluded);
  const onsiteInstallCents = 0;
  // Campos retirados: ignorados aunque el caller envíe valores legacy.
  const additionalServicesCents = 0;
  const oneTimeDiscountCents = 0;
  const recurringExtraDiscountCents = 0;

  const oneTimeNetCents = hardwareCents + appSignupFeeCents;
  const oneTimeVatCents = applyBps(oneTimeNetCents, vatBps);
  const oneTimeGrossCents = oneTimeNetCents + oneTimeVatCents;

  let planRecurringCents = 0;
  let kioskLicenseRecurringCents = 0;

  if (!isPilot) {
    const saasMonthly = saasMonthlyCentsForCohort(
      plan.monthlyCents,
      config.assumptions,
      cohort
    );
    if (input.interval === 'monthly') {
      planRecurringCents = applySaleSurchargeBps(saasMonthly, surchargeBps);
      // Alquiler: fuera de descuentos SaaS y del recargo de equivalencia.
      kioskLicenseRecurringCents = input.kioskCount * licenseMonthly;
    } else {
      const saasAnnual = annualFromMonthly(
        saasMonthly,
        config.saasAnnualDiscountBps
      );
      planRecurringCents = applySaleSurchargeBps(saasAnnual, surchargeBps);
      kioskLicenseRecurringCents =
        input.kioskCount *
        annualFromMonthly(
          licenseMonthly,
          config.kioskLicenseAnnualDiscountBps
        );
    }
  }

  const recurringNetCents = planRecurringCents + kioskLicenseRecurringCents;
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

  // Alta (pago único) entra en pago inicial / año 1; no en cuotas posteriores.
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
    cohortPricing: cohort,
    appSignupFeeCents,
    hardwareCents,
    onsiteInstallCents,
    onsiteInstallIncluded,
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
    equivalenceSurchargeBps: surchargeBps,
  };
}
