/**
 * Contratos comerciales FarmaFácil (documento legal).
 * Independiente del estado de farmacia pending_contract / mock ContratoTab.
 */

export const CONTRACT_TEMPLATE_KEYS = [
  'catalog',
  'catalog-ai',
  'full-kiosk',
] as const;

export type ContractTemplateKey = (typeof CONTRACT_TEMPLATE_KEYS)[number];

export const CONTRACT_TEMPLATE_LABELS: Record<ContractTemplateKey, string> = {
  catalog: 'Catálogo',
  'catalog-ai': 'Catálogo + IA',
  'full-kiosk': 'Completo con kiosco',
};

export type LegalApprovalStatus =
  | 'draft_pending_legal_review'
  | 'approved';

export type ContractLifecycleStatus =
  | 'draft'
  | 'preview_ready'
  | 'pdf_generated'
  | 'emailed'
  | 'awaiting_signature'
  | 'signed'
  | 'void';

export type ContractEmailSendEntry = {
  at: string;
  to: string;
  status: 'sent' | 'failed' | 'not_configured';
  error?: string | null;
  providerId?: string | null;
  by?: string | null;
};

/** Valores de relleno; null = ausente (no inventar). */
export type ContractFieldValues = Record<string, string | null>;

export type ContractMissingField = {
  key: string;
  label: string;
  required: boolean;
  reason: string;
  /** Dónde completar el dato en la app. */
  where?: string | null;
};

export type ContractPartyFarmafacil = {
  legalName: string | null;
  cif: string | null;
  address: string | null;
  representativeName: string | null;
  representativeNif: string | null;
  representativeTitle: string | null;
  /** false hasta constitución y confirmación explícita en STATUS/env. */
  entityConfirmed: boolean;
};

export type ContractPartyPharmacy = {
  pharmacyId: string | null;
  displayName: string | null;
  legalName: string | null;
  cif: string | null;
  address: string | null;
  representativeName: string | null;
  representativeNif: string | null;
  representativeTitle: string | null;
  contactEmail: string | null;
  contactName: string | null;
};

export type ContractCommercialAmounts = {
  quoteId: string;
  quoteReference: string | null;
  snapshotVersion: number;
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
  recurringNetCents: number;
  recurringGrossCents: number;
  oneTimeNetCents: number;
  oneTimeGrossCents: number;
  /** Importes formateados ES (netos salvo que la clave indique IVA). */
  formatted: Record<string, string>;
};

export type ContractTemplateMeta = {
  key: ContractTemplateKey;
  label: string;
  masterVersion: string;
  sourceStatus: 'LOADED';
  body: string;
};

export type CommercialContractListItem = {
  id: string;
  quoteId: string;
  quoteReference: string | null;
  pharmacyId: string | null;
  pharmacyName: string | null;
  templateKey: ContractTemplateKey;
  lifecycleStatus: ContractLifecycleStatus;
  legalApprovalSnapshot: LegalApprovalStatus;
  missingFields: string[];
  contactEmail: string | null;
  emailSends: ContractEmailSendEntry[];
  createdAt: string;
  updatedAt: string;
  signedAt: string | null;
};

export type ContractPreviewModel = {
  templateKey: ContractTemplateKey;
  templateLabel: string;
  masterTemplateVersion: string;
  legalApproval: LegalApprovalStatus;
  rebotechEntityConfirmed: boolean;
  isDraft: boolean;
  quoteId: string;
  quoteReference: string | null;
  quoteStatus: string;
  snapshotVersion: number;
  readyForSignature: boolean;
  canGenerateDraftPdf: boolean;
  canGenerateSignablePdf: boolean;
  /** @deprecated usar canGenerateDraftPdf */
  canGeneratePdf: boolean;
  canSendEmail: boolean;
  canMarkSigned: boolean;
  blockers: string[];
  missingFields: ContractMissingField[];
  unresolvedMarkers: string[];
  farmafacil: ContractPartyFarmafacil;
  pharmacy: ContractPartyPharmacy;
  amounts: ContractCommercialAmounts;
  filledBody: string;
};
