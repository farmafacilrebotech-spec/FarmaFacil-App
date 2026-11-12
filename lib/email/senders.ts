/**
 * Catálogo cerrado de remitentes corporativos FarmaFácil.
 * No se permiten direcciones arbitrarias; solo claves autorizadas
 * cuyo dominio coincide con el dominio verificado/configurado.
 */

export const CORPORATE_SENDER_DOMAIN = 'farmafacil.solutions';

export type CorporateSenderKey =
  | 'pilar'
  | 'contacto'
  | 'info'
  | 'soporte'
  | 'pruebas'
  | 'ventas'
  | 'admin'
  | 'privacidad';

export type CorporateSender = {
  key: CorporateSenderKey;
  email: string;
  displayName: string;
  /** Nombre visible en cabecera From: "Nombre <email>" */
  fromHeader: string;
  replyTo: string;
  /** Texto firma (nombre completo) */
  signatureName: string;
  signatureTitle: string;
  isDefault: boolean;
};

export const CORPORATE_SENDERS: readonly CorporateSender[] = [
  {
    key: 'pilar',
    email: 'pilar@farmafacil.solutions',
    displayName: 'Pilar Reyes · FarmaFácil',
    fromHeader: 'Pilar Reyes · FarmaFácil <pilar@farmafacil.solutions>',
    replyTo: 'pilar@farmafacil.solutions',
    signatureName: 'Pilar Reyes Bononat',
    signatureTitle: 'Fundadora de FarmaFácil',
    isDefault: true,
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
  },
  {
    key: 'pruebas',
    email: 'pruebas@farmafacil.solutions',
    displayName: 'Pruebas · FarmaFácil',
    fromHeader: 'Pruebas · FarmaFácil <pruebas@farmafacil.solutions>',
    replyTo: 'pruebas@farmafacil.solutions',
    signatureName: 'FarmaFácil',
    signatureTitle: 'Entorno de pruebas',
    isDefault: false,
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
  },
] as const;

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

/**
 * Dominio autorizado para From.
 * Preferencia: FF_CORPORATE_EMAIL_VERIFIED_DOMAIN → dominio de EMAIL_FROM → catálogo.
 */
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

/**
 * Allowlist opcional de claves: FF_CORPORATE_EMAIL_ALLOWED_FROM_KEYS=pilar,contacto
 * Si vacío → todas las del dominio autorizado.
 */
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

/**
 * Remitentes mostrables: catálogo ∩ dominio autorizado ∩ allowlist opcional.
 * Resend permite cualquier dirección @dominio si el dominio está verificado;
 * sin API de dominios en runtime, filtramos por dominio de configuración.
 */
export function listAuthorizedSenders(
  env: NodeJS.ProcessEnv = process.env
): CorporateSender[] {
  const domain = resolveAuthorizedSenderDomain(env);
  const allow = parseAllowedSenderKeys(env);
  return CORPORATE_SENDERS.filter((s) => {
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
  const authorized = listAuthorizedSenders(env);
  const sender = authorized.find((s) => s.key === key);
  if (!sender) {
    return {
      ok: false,
      error: 'Ese remitente no está habilitado para el dominio configurado.',
    };
  }
  return { ok: true, sender };
}
