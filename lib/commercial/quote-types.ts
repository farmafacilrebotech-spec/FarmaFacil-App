/**
 * Tipos del presupuesto comercial (tabla commercial_quotes / snapshot).
 * Independiente del presupuesto público QR de pedidos.
 */

export const COMMERCIAL_QUOTE_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
] as const;

export type CommercialQuoteStatus = (typeof COMMERCIAL_QUOTE_STATUSES)[number];

export const COMMERCIAL_QUOTE_STATUS_LABELS: Record<
  CommercialQuoteStatus,
  string
> = {
  draft: 'Borrador',
  sent: 'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Caducado',
};

export type QuoteStatusHistoryEntry = {
  at: string;
  from: CommercialQuoteStatus | null;
  to: CommercialQuoteStatus;
  by?: string | null;
  note?: string | null;
};

export type QuoteEmailSendEntry = {
  at: string;
  to: string;
  status: 'sent' | 'failed' | 'not_configured';
  error?: string | null;
  providerId?: string | null;
  by?: string | null;
};

/** Metadatos mutables en internal_notes (JSON). */
export type QuoteInternalMeta = {
  v: 1;
  history: QuoteStatusHistoryEntry[];
  emailSends: QuoteEmailSendEntry[];
};

/** Snapshot inmutable comercial (sin costes internos). */
export type CommercialQuoteSnapshot = {
  v: 1;
  clientName: string;
  contactName: string;
  contactEmail: string;
  pharmacyId: string | null;
  pharmacyName: string | null;
  planId: string;
  planName: string;
  interval: 'monthly' | 'annual';
  cohortPricing: string;
  kioskCount: number;
  onsiteInstallIncluded: boolean;
  includeAppSignupFee: boolean;
  appSignupFeeCents: number;
  hardwareUnitCents: number;
  hardwareCents: number;
  kioskLicenseMonthlyCents: number;
  vatBps: number;
  saasAnnualDiscountBps: number;
  notes: string | null;
  validUntil: string | null;
  commercialConditions: string[];
  breakdown: {
    oneTimeNetCents: number;
    oneTimeVatCents: number;
    oneTimeGrossCents: number;
    planRecurringCents: number;
    kioskLicenseRecurringCents: number;
    recurringNetCents: number;
    recurringVatCents: number;
    recurringGrossCents: number;
    firstYearSubscriptionCents: number;
    firstYearNetCents: number;
    firstYearVatCents: number;
    firstYearGrossCents: number;
    laterYearsRecurringNetCents: number;
  };
};

export type CommercialQuoteLineInput = {
  lineType:
    | 'plan'
    | 'kiosk_hardware'
    | 'kiosk_license'
    | 'onsite_install'
    | 'additional_service'
    | 'one_time_discount'
    | 'recurring_discount'
    | 'other';
  description: string;
  quantity: number;
  unitCents: number;
  lineNetCents: number;
  sortOrder: number;
  metadata?: Record<string, unknown>;
};

export type CommercialQuoteListItem = {
  id: string;
  referenceCode: string | null;
  status: CommercialQuoteStatus;
  prospectName: string | null;
  pharmacyId: string | null;
  pharmacyName: string | null;
  commercialSkuKey: string;
  billingInterval: 'monthly' | 'annual';
  kioskCount: number;
  oneTimeNetCents: number;
  recurringNetCents: number;
  firstYearNetCents: number;
  firstYearGrossCents: number;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
  contactName: string | null;
  contactEmail: string | null;
  snapshot: CommercialQuoteSnapshot | null;
  history: QuoteStatusHistoryEntry[];
  emailSends: QuoteEmailSendEntry[];
  notes: string | null;
};

export type QuotePharmacyOption = {
  id: string;
  name: string;
  email: string | null;
};

export const DEFAULT_QUOTE_VALIDITY_DAYS = 30;

export const DEFAULT_COMMERCIAL_CONDITIONS = [
  'Precios en euros. IVA del 21 % aplicado sobre importes netos indicados.',
  'El alta de la aplicación (190,00 €) es un pago único inicial y no se incluye en las cuotas de años posteriores.',
  'La personalización del kiosko se factura como pago único por unidad.',
  'El alquiler mensual del kiosko no entra en el descuento SaaS ni en el prepago anual.',
  'La instalación presencial, si figura como incluida, no modifica importes, IVA ni cuotas.',
  'La aceptación de este presupuesto no firma contrato ni activa el servicio. La contratación y activación siguen el flujo de contrato y firma.',
  'El piloto gratuito de 15 días no se activa al aceptar el presupuesto; requiere acción explícita en Gestión de pilotos.',
] as const;
