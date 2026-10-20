export type AssistantModuleMode = 'demo' | 'contracted' | 'off';

export type AssistantEntitlementStatus =
  | 'active'
  | 'trial'
  | 'suspended'
  | 'cancelled'
  | 'expired';

export type AssistantEntitlementRecord = {
  status: AssistantEntitlementStatus;
  source: string;
  endsAt: string | null;
  mode: AssistantModuleMode;
  monthlyRequestLimit: number | null;
  pharmacistConsultEnabled: boolean;
};

export type AssistantCommercialUiState =
  | 'not_contracted'
  | 'demo_active'
  | 'demo_expired'
  | 'contracted_active'
  | 'suspended'
  | 'cancelled';

function parseMode(raw: unknown): AssistantModuleMode {
  if (raw === 'contracted' || raw === 'demo') return raw;
  return 'off';
}

function parseLimit(limits: unknown): number | null {
  if (!limits || typeof limits !== 'object') return null;
  const n = Number((limits as { monthly_request_limit?: unknown }).monthly_request_limit);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

export function parseAssistantEntitlementRow(row: {
  status: string;
  source: string;
  ends_at: string | null;
  config?: unknown;
  limits?: unknown;
}): AssistantEntitlementRecord {
  const config =
    row.config && typeof row.config === 'object'
      ? (row.config as Record<string, unknown>)
      : {};
  const mode = parseMode(config.mode);
  return {
    status: row.status as AssistantEntitlementStatus,
    source: row.source,
    endsAt: row.ends_at,
    mode: mode === 'off' ? (row.status === 'trial' ? 'demo' : 'contracted') : mode,
    monthlyRequestLimit: parseLimit(row.limits),
    pharmacistConsultEnabled:
      mode === 'contracted' && config.pharmacist_consult_enabled === true,
  };
}

export function assistantModuleCurrentlyUsable(
  entitlement: AssistantEntitlementRecord | null,
  nowMs: number = Date.now()
): boolean {
  if (!entitlement) return false;
  if (entitlement.status !== 'active' && entitlement.status !== 'trial') {
    return false;
  }
  if (entitlement.endsAt) {
    const ends = Date.parse(entitlement.endsAt);
    if (Number.isFinite(ends) && ends <= nowMs) return false;
  }
  return entitlement.mode === 'demo' || entitlement.mode === 'contracted';
}

export function resolveAssistantCommercialUiState(
  entitlement: AssistantEntitlementRecord | null,
  nowMs: number = Date.now()
): AssistantCommercialUiState {
  if (!entitlement) return 'not_contracted';

  if (entitlement.status === 'cancelled') return 'cancelled';
  if (entitlement.status === 'suspended') return 'suspended';

  const expired =
    entitlement.endsAt != null &&
    Number.isFinite(Date.parse(entitlement.endsAt)) &&
    Date.parse(entitlement.endsAt) <= nowMs;

  if (entitlement.status === 'trial' || entitlement.mode === 'demo') {
    if (expired || entitlement.status === 'expired') return 'demo_expired';
    if (entitlement.status === 'trial' || entitlement.status === 'active') {
      return 'demo_active';
    }
  }

  if (entitlement.status === 'active' && entitlement.mode === 'contracted') {
    return 'contracted_active';
  }

  if (expired) return 'demo_expired';
  return 'not_contracted';
}
