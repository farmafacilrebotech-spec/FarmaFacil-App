/**
 * Validación de registro/perfil cliente (sin I/O).
 * Misma regla de teléfono que public-catalog-request-validation (ES móvil/fijo).
 */

function normalizeSpanishPhone(raw: string): string | null {
  let phone = (raw ?? '').trim().replace(/[^0-9+]/g, '');
  if (!phone) return null;
  if (phone.startsWith('+34')) phone = phone.slice(3);
  else if (phone.startsWith('0034')) phone = phone.slice(4);
  else if (/^34[6-9]\d{8}$/.test(phone)) phone = phone.slice(2);
  if (!/^[6-9]\d{8}$/.test(phone)) return null;
  return phone;
}

export type CustomerRegisterInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  passwordConfirm: string;
  privacyAccepted: boolean;
  marketingConsent: boolean;
};

export type CustomerRegisterValidation =
  | {
      ok: true;
      firstName: string;
      lastName: string;
      fullName: string;
      phone: string;
      email: string;
      password: string;
      privacyAccepted: true;
      marketingConsent: boolean;
    }
  | { ok: false; error: string; field?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCustomerRegister(
  raw: CustomerRegisterInput
): CustomerRegisterValidation {
  const firstName = (raw.firstName ?? '').trim();
  const lastName = (raw.lastName ?? '').trim();
  const email = (raw.email ?? '').trim().toLowerCase();
  const password = raw.password ?? '';
  const passwordConfirm = raw.passwordConfirm ?? '';

  if (firstName.length < 2) {
    return {
      ok: false,
      field: 'firstName',
      error: 'Indica tu nombre (mínimo 2 caracteres).',
    };
  }
  if (lastName.length < 2) {
    return {
      ok: false,
      field: 'lastName',
      error: 'Indica tus apellidos (mínimo 2 caracteres).',
    };
  }

  const phone = normalizeSpanishPhone(raw.phone ?? '');
  if (!phone) {
    return {
      ok: false,
      field: 'phone',
      error: 'Indica un teléfono español válido (9 dígitos).',
    };
  }

  if (!EMAIL_RE.test(email)) {
    return {
      ok: false,
      field: 'email',
      error: 'Indica un email válido.',
    };
  }

  if (password.length < 8) {
    return {
      ok: false,
      field: 'password',
      error: 'La contraseña debe tener al menos 8 caracteres.',
    };
  }
  if (password !== passwordConfirm) {
    return {
      ok: false,
      field: 'passwordConfirm',
      error: 'Las contraseñas no coinciden.',
    };
  }

  if (!raw.privacyAccepted) {
    return {
      ok: false,
      field: 'privacyAccepted',
      error: 'Debes aceptar las condiciones y la política de privacidad.',
    };
  }

  return {
    ok: true,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    phone,
    email,
    password,
    privacyAccepted: true,
    marketingConsent: Boolean(raw.marketingConsent),
  };
}

export function looksLikeEmail(value: string): boolean {
  return EMAIL_RE.test((value ?? '').trim());
}

/** Login: el proyecto usa email+password de Supabase Auth (no phone auth). */
export function normalizeCustomerLoginIdentifier(raw: string): {
  ok: true;
  email: string;
} | { ok: false; error: string } {
  const value = (raw ?? '').trim();
  if (!value) {
    return { ok: false, error: 'Indica tu email.' };
  }
  if (looksLikeEmail(value)) {
    return { ok: true, email: value.toLowerCase() };
  }
  return {
    ok: false,
    error:
      'El acceso es con email y contraseña. El teléfono se guarda en tu perfil, pero no se usa para iniciar sesión.',
  };
}
