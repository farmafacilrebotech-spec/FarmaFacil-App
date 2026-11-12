/**
 * Cuentas / remitentes corporativos FarmaFácil (catálogo cerrado).
 * No se permiten direcciones arbitrarias.
 */

export const CORPORATE_SENDER_DOMAIN = 'farmafacil.solutions';

export type CorporateSenderKey =
  | 'pilar'
  | 'contacto'
  | 'info'
  | 'soporte'
  | 'demo'
  | 'ventas'
  | 'comercial'
  | 'facturacion'
  // legado (086); siguen válidos en BD
  | 'pruebas'
  | 'admin'
  | 'privacidad';

export type CorporateSender = {
  key: CorporateSenderKey;
  email: string;
  displayName: string;
  fromHeader: string;
  replyTo: string;
  signatureName: string;
  signatureTitle: string;
  isDefault: boolean;
  /** Visible en selector de cuentas activas */
  managed: boolean;
};

/** Cuentas gestionadas (UI). */
export const CORPORATE_MANAGED_SENDERS: readonly CorporateSender[] = [
  {
    key: 'pilar',
    email: 'pilar@farmafacil.solutions',
    displayName: 'Pilar Reyes · FarmaFácil',
    fromHeader: 'Pilar Reyes · FarmaFácil <pilar@farmafacil.solutions>',
    replyTo: 'pilar@farmafacil.solutions',
    signatureName: 'Pilar Reyes Bononat',
    signatureTitle: 'Fundadora de FarmaFácil',
    isDefault: true,
    managed: true,
  },
  {
    key: 'contacto',
    email: 'contacto@farmafacil.solutions',
    displayName: 'Contacto · FarmaFácil',
    fromHeader: 'Contacto · FarmaFácil <contacto@farmafacil.solutions>',
    replyTo: 'contacto@farmafacil.solutions',
    signatureName: 'FarmaFácil',
    signatureTitle: 'Contacto',
    isDefault: false,
    managed: true,
  },
  {
    key: 'info',
    email: 'info@farmafacil.solutions',
    displayName: 'Info · FarmaFácil',
    fromHeader: 'Info · FarmaFácil <info@farmafacil.solutions>',
    replyTo: 'info@farmafacil.solutions',
    signatureName: 'FarmaFácil',
    signatureTitle: 'Información',
    isDefault: false,
    managed: true,
  },
  {
    key: 'soporte',
    email: 'soporte@farmafacil.solutions',
    displayName: 'Soporte · FarmaFácil',
    fromHeader: 'Soporte · FarmaFácil <soporte@farmafacil.solutions>',
    replyTo: 'soporte@farmafacil.solutions',
    signatureName: 'FarmaFácil',
    signatureTitle: 'Soporte',
    isDefault: false,
    managed: true,
  },
  {
    key: 'demo',
    email: 'demo@farmafacil.solutions',
    displayName: 'Demo · FarmaFácil',
    fromHeader: 'Demo · FarmaFácil <demo@farmafacil.solutions>',
    replyTo: 'demo@farmafacil.solutions',
    signatureName: 'FarmaFácil',
    signatureTitle: 'Demostraciones',
    isDefault: false,
    managed: true,
  },
  {
    key: 'ventas',
    email: 'ventas@farmafacil.solutions',
    displayName: 'Ventas · FarmaFácil',
    fromHeader: 'Ventas · FarmaFácil <ventas@farmafacil.solutions>',
    replyTo: 'ventas@farmafacil.solutions',
    signatureName: 'FarmaFácil',
    signatureTitle: 'Ventas',
    isDefault: false,
    managed: true,
  },
  {
    key: 'comercial',
    email: 'comercial@farmafacil.solutions',
    displayName: 'Comercial · FarmaFácil',
    fromHeader: 'Comercial · FarmaFácil <comercial@farmafacil.solutions>',
    replyTo: 'comercial@farmafacil.solutions',
    signatureName: 'FarmaFácil',
    signatureTitle: 'Comercial',
    isDefault: false,
    managed: true,
  },
  {
    key: 'facturacion',
    email: 'facturacion@farmafacil.solutions',
    displayName: 'Facturación · FarmaFácil',
    fromHeader: 'Facturación · FarmaFácil <facturacion@farmafacil.solutions>',
    replyTo: 'facturacion@farmafacil.solutions',
    signatureName: 'FarmaFácil',
    signatureTitle: 'Facturación',
    isDefault: false,
    managed: true,
  },
] as const;

const LEGACY_SENDERS: readonly CorporateSender[] = [
  {
    key: 'pruebas',
    email: 'pruebas@farmafacil.solutions',
    displayName: 'Pruebas · FarmaFácil',
    fromHeader: 'Pruebas · FarmaFácil <pruebas@farmafacil.solutions>',
    replyTo: 'pruebas@farmafacil.solutions',
    signatureName: 'FarmaFácil',
    signatureTitle: 'Entorno de pruebas',
    isDefault: false,
    managed: false,
  },
  {
    key: 'admin',
    email: 'admin@farmafacil.solutions',
    displayName: 'Admin · FarmaFácil',
    fromHeader: 'Admin · FarmaFácil <admin@farmafacil.solutions>',
    replyTo: 'admin@farmafacil.solutions',
    signatureName: 'FarmaFácil',
    signatureTitle: 'Administración',
    isDefault: false,
    managed: false,
  },
  {
    key: 'privacidad',
    email: 'privacidad@farmafacil.solutions',
    displayName: 'Privacidad · FarmaFácil',
    fromHeader: 'Privacidad · FarmaFácil <privacidad@farmafacil.solutions>',
    replyTo: 'privacidad@farmafacil.solutions',
    signatureName: 'FarmaFácil',
    signatureTitle: 'Privacidad y protección de datos',
    isDefault: false,
    managed: false,
  },
];

export const CORPORATE_SENDERS: readonly CorporateSender[] = [
  ...CORPORATE_MANAGED_SENDERS,
  ...LEGACY_SENDERS,
];

const BY_KEY = new Map(CORPORATE_SENDERS.map((s) => [s.key, s]));

export function isCorporateSenderKey(value: string): value is CorporateSenderKey {
  return BY_KEY.has(value as CorporateSenderKey);
}

export function getCorporateSender(
  key: string | null | undefined
): CorporateSender {
  if (key && isCorporateSenderKey(key)) {
    return BY_KEY.get(key)!;
  }
  return BY_KEY.get('pilar')!;
}

export function defaultCorporateSenderKey(): CorporateSenderKey {
  return 'pilar';
}

export function resolveAuthorizedSenderDomain(
  env: NodeJS.ProcessEnv = process.env
): string {
  const explicit = (env.FF_CORPORATE_EMAIL_VERIFIED_DOMAIN ?? '')
    .trim()
    .toLowerCase();
  if (explicit) return explicit;
  const from = (env.EMAIL_FROM ?? '').trim();
  const domain = from.match(/@([\w.-]+)/)?.[1]?.toLowerCase();
  if (domain) return domain;
  return CORPORATE_SENDER_DOMAIN;
}

export function parseAllowedSenderKeys(
  env: NodeJS.ProcessEnv = process.env
): Set<CorporateSenderKey> | null {
  const raw = (env.FF_CORPORATE_EMAIL_ALLOWED_FROM_KEYS ?? '').trim();
  if (!raw) return null;
  const keys = raw
    .split(/[,;\s]+/)
    .map((k) => k.trim().toLowerCase())
    .filter(isCorporateSenderKey);
  return new Set(keys);
}

/** Remitentes mostrables en UI (cuentas managed ∩ dominio ∩ allowlist). */
export function listAuthorizedSenders(
  env: NodeJS.ProcessEnv = process.env
): CorporateSender[] {
  const domain = resolveAuthorizedSenderDomain(env);
  const allow = parseAllowedSenderKeys(env);
  return CORPORATE_MANAGED_SENDERS.filter((s) => {
    const senderDomain = s.email.split('@')[1]?.toLowerCase();
    if (senderDomain !== domain) return false;
    if (allow && !allow.has(s.key)) return false;
    return true;
  });
}

export function assertAuthorizedSenderKey(
  key: string,
  env: NodeJS.ProcessEnv = process.env
):
  | { ok: true; sender: CorporateSender }
  | { ok: false; error: string } {
  if (!isCorporateSenderKey(key)) {
    return { ok: false, error: 'Remitente no autorizado.' };
  }
  const sender = getCorporateSender(key);
  const domain = resolveAuthorizedSenderDomain(env);
  const senderDomain = sender.email.split('@')[1]?.toLowerCase();
  if (senderDomain !== domain) {
    return {
      ok: false,
      error: 'Ese remitente no está habilitado para el dominio configurado.',
    };
  }
  const allow = parseAllowedSenderKeys(env);
  if (allow && !allow.has(key)) {
    return { ok: false, error: 'Remitente no autorizado para tu usuario.' };
  }
  // Solo managed en selector nuevo; legado solo si ya estaba en borrador
  if (!sender.managed && !(allow && allow.has(key))) {
    return { ok: false, error: 'Esa cuenta no está disponible en el selector.' };
  }
  return { ok: true, sender };
}
