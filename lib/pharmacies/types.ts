/** Tipos alineados al esquema real (farmacias V1). Sin mocks. */

export type PharmacyStatus =
  | 'draft'
  | 'pending_contract'
  | 'contract_sent'
  | 'contract_signed'
  | 'pending_setup'
  | 'active'
  | 'suspended'
  | 'archived';

export type PlanKey = 'starter' | 'pro' | 'business' | 'enterprise';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'cancelled'
  | 'expired';

export interface PlanSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface PharmacyListItem {
  id: string;
  name: string;
  legal_name: string | null;
  cif: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  status: PharmacyStatus;
  logo_color: string | null;
  created_at: string;
  plan: PlanSummary | null;
}

export interface PharmacyBranding {
  pharmacy_id: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_family: string | null;
  border_radius: number | null;
  kiosk_wallpaper_url: string | null;
  welcome_message: string | null;
}

export interface PharmacySettings {
  pharmacy_id: string;
  visible_name: string | null;
  schedule: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  timezone: string;
}

export interface PharmacySubscription {
  id: string;
  status: SubscriptionStatus;
  provider: string;
  current_period_start: string | null;
  current_period_end: string | null;
  plan: PlanSummary | null;
}

export interface PharmacyDetail {
  id: string;
  name: string;
  legal_name: string | null;
  cif: string | null;
  email: string | null;
  phone: string | null;
  web: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  country: string;
  status: PharmacyStatus;
  logo_color: string | null;
  created_at: string;
  updated_at: string;
  plan: PlanSummary | null;
  branding: PharmacyBranding | null;
  settings: PharmacySettings | null;
  subscription: PharmacySubscription | null;
}

export interface CreatePharmacyInput {
  name: string;
  plan_key: PlanKey;
  legal_name?: string;
  cif?: string;
  email?: string;
  phone?: string;
  web?: string;
  address_line?: string;
  postal_code?: string;
  city?: string;
  province?: string;
  country?: string;
  primary_color?: string;
  secondary_color?: string;
  welcome_message?: string;
  visible_name?: string;
  schedule?: string;
  settings_phone?: string;
  whatsapp?: string;
  settings_email?: string;
  logo_color?: string;
}

/** Campos editables de pharmacies (sin plan, status ni archivado). */
export interface UpdatePharmacyGeneralInput {
  name: string;
  legal_name?: string | null;
  cif?: string | null;
  email?: string | null;
  phone?: string | null;
  web?: string | null;
  address_line?: string | null;
  postal_code?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
}

/** Campos editables de pharmacy_branding. */
export interface UpdatePharmacyBrandingInput {
  primary_color?: string | null;
  secondary_color?: string | null;
  welcome_message?: string | null;
}

/** Campos editables de pharmacy_settings. */
export interface UpdatePharmacySettingsInput {
  visible_name?: string | null;
  schedule?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
}
