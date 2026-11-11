/**
 * Campos de identidad de farmacia: solo SuperAdmin (`platform.pharmacies.write`).
 * Los ajustes operativos (horario, contactos kiosk, colores, asistente) usan
 * `settings.update` / `branding.update` y NO están en estas listas.
 */

export const PHARMACY_IDENTITY_COLUMNS = [
  'name',
  'legal_name',
  'cif',
  'email',
  'phone',
  'web',
  'address_line',
  'postal_code',
  'city',
  'province',
  'country',
  'logo_color',
] as const;

export type PharmacyIdentityColumn = (typeof PHARMACY_IDENTITY_COLUMNS)[number];

/** Branding: solo logo_url está protegido a nivel trigger/RLS identidad. */
export const PHARMACY_BRANDING_IDENTITY_COLUMNS = ['logo_url'] as const;

/** Settings: nombre comercial visible protegido; resto operativo. */
export const PHARMACY_SETTINGS_IDENTITY_COLUMNS = ['visible_name'] as const;

export const PHARMACY_SETTINGS_OPERATIONAL_COLUMNS = [
  'schedule',
  'phone',
  'whatsapp',
  'email',
  'timezone',
  'extra',
  'catalog_mode',
] as const;

export const PHARMACY_BRANDING_OPERATIONAL_COLUMNS = [
  'primary_color',
  'secondary_color',
  'accent_color',
  'font_family',
  'border_radius',
  'welcome_message',
  'kiosk_wallpaper_url',
] as const;

export const PHARMACY_IDENTITY_CHANGE_POLICY =
  'Los datos identificativos (nombre, CIF, dirección, logo, nombre visible) solo los modifica FarmaFácil (SuperAdmin) tras solicitud escrita del titular.';
