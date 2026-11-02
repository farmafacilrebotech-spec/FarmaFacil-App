'use server';

import { revalidatePath } from 'next/cache';

import { getAppBaseUrl } from '@/lib/auth/app-url';
import { createClient } from '@/lib/supabase/server';
import { looksLikeObfuscatedExistingSignup } from '@/lib/customer/account-kind';
import {
  getCustomerProfile,
  listCustomerAddresses,
} from '@/lib/customer/queries';
import { validateCustomerRegister } from '@/lib/customer/validation';

export type CustomerActionResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string };

function revalidateCuenta(publicId?: string) {
  revalidatePath('/cuenta');
  revalidatePath('/cuenta/mis-farmacias');
  if (publicId) {
    revalidatePath(`/e/${publicId}/cuenta`);
    revalidatePath(`/e/${publicId}/cuenta/perfil`);
    revalidatePath(`/e/${publicId}/cuenta/direcciones`);
    revalidatePath(`/e/${publicId}/cuenta/pedidos`);
  }
}

/**
 * Registro cliente vía Auth. No inicia sesión si el proyecto exige confirmar email.
 */
export async function registerCustomerAction(input: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  passwordConfirm: string;
  privacyAccepted: boolean;
  marketingConsent: boolean;
  publicId?: string;
}): Promise<
  CustomerActionResult<{ needsEmailConfirmation: boolean; email: string }>
> {
  const parsed = validateCustomerRegister(input);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const supabase = createClient();
  const appBase = getAppBaseUrl();
  const afterConfirm = input.publicId
    ? `/e/${input.publicId}/cuenta`
    : '/cuenta/mis-farmacias';
  const emailRedirectTo = appBase
    ? `${appBase}/auth/callback?next=${encodeURIComponent(afterConfirm)}`
    : undefined;

  const { data, error } = await supabase.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    options: {
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
      data: {
        account_kind: 'customer',
        first_name: parsed.firstName,
        last_name: parsed.lastName,
        full_name: parsed.fullName,
        phone: parsed.phone,
        privacy_accepted: 'true',
        marketing_consent: parsed.marketingConsent ? 'true' : 'false',
      },
    },
  });

  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('already registered') || m.includes('already been registered')) {
      return {
        ok: false,
        error:
          'Si ya tienes cuenta FarmaFácil, inicia sesión. El personal puede activar Cliente desde Mi cuenta.',
        code: 'email_taken',
      };
    }
    console.error('[customer] signUp', error.message);
    return { ok: false, error: 'No se ha podido crear la cuenta. Inténtalo de nuevo.' };
  }

  const user = data.user;
  const session = data.session;

  // Confirmaciones ON: Auth ofusca emails existentes (user sin identities / sin sesión).
  if (looksLikeObfuscatedExistingSignup({ session, user })) {
    return {
      ok: false,
      error:
        'Si ya tienes cuenta FarmaFácil, inicia sesión. El personal puede activar Cliente desde Mi cuenta.',
      code: 'email_taken',
    };
  }

  // Si no hay sesión, Auth exige confirmación de email (no fingir login).
  const needsEmailConfirmation = !session;

  if (user && session) {
    // Consent / datos: el trigger ya fijó account_kind=customer.
    // No forzar account_kind aquí (el protect trigger lo bloquearía en staff→customer).
    await supabase
      .from('profiles')
      .update({
        first_name: parsed.firstName,
        last_name: parsed.lastName,
        full_name: parsed.fullName,
        phone: parsed.phone,
        privacy_accepted_at: new Date().toISOString(),
        marketing_consent_at: parsed.marketingConsent
          ? new Date().toISOString()
          : null,
      })
      .eq('id', user.id);
  }

  revalidateCuenta(input.publicId);
  return {
    ok: true,
    needsEmailConfirmation,
    email: parsed.email,
  };
}

/**
 * Activación voluntaria del área cliente (staff → both) vía RPC 071.
 * Registra consentimiento en servidor; no eleva permisos de panel.
 */
export async function enableCustomerSelfAction(input: {
  privacyAccepted: boolean;
  marketingConsent: boolean;
  firstName?: string;
  lastName?: string;
  phone?: string;
  publicId?: string;
}): Promise<
  CustomerActionResult<{ accountKind: string; previousKind: string }>
> {
  if (!input.privacyAccepted) {
    return {
      ok: false,
      error: 'Debes aceptar las condiciones y la política de privacidad.',
      code: 'privacy_required',
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Debes iniciar sesión.', code: 'unauthenticated' };
  }

  const { data, error } = await supabase.rpc('ff_customer_enable_self_v1', {
    p_privacy_accepted: true,
    p_marketing_consent: Boolean(input.marketingConsent),
    p_first_name: input.firstName?.trim() || null,
    p_last_name: input.lastName?.trim() || null,
    p_phone: input.phone?.trim() || null,
  });

  if (error) {
    console.error('[customer] enable_self', error.code, error.message);
    if (
      error.code === '42883' ||
      error.message.toLowerCase().includes('does not exist')
    ) {
      return {
        ok: false,
        error: 'Falta aplicar la migración 071 (doble rol).',
        code: 'migration_missing',
      };
    }
    return { ok: false, error: 'No se ha podido activar el área cliente.' };
  }

  const body = data as {
    status?: string;
    account_kind?: string;
    previous_kind?: string;
  };

  if (body?.status === 'privacy_required') {
    return {
      ok: false,
      error: 'Debes aceptar las condiciones y la política de privacidad.',
      code: 'privacy_required',
    };
  }
  if (body?.status !== 'ok') {
    return {
      ok: false,
      error: 'No se ha podido activar el área cliente.',
      code: body?.status,
    };
  }

  revalidateCuenta(input.publicId);
  return {
    ok: true,
    accountKind: String(body.account_kind ?? 'both'),
    previousKind: String(body.previous_kind ?? 'staff'),
  };
}

export async function updateCustomerProfileAction(input: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  marketingConsent: boolean;
  publicId?: string;
}): Promise<CustomerActionResult<{ emailChangePending?: boolean }>> {
  const profile = await getCustomerProfile();
  if (!profile.ok) return { ok: false, error: profile.error };

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (firstName.length < 2 || lastName.length < 2) {
    return { ok: false, error: 'Nombre y apellidos son obligatorios.' };
  }

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Indica un email válido.' };
  }

  const { normalizeSpanishPhone } = await import(
    '@/lib/kiosk/public-catalog-request-validation'
  );
  const phone = normalizeSpanishPhone(input.phone);
  if (!phone) {
    return { ok: false, error: 'Teléfono no válido.' };
  }

  const supabase = createClient();
  let emailChangePending = false;

  if (email !== profile.profile.email.toLowerCase()) {
    const { error: emailError } = await supabase.auth.updateUser({ email });
    if (emailError) {
      console.error('[customer] update email', emailError.message);
      return {
        ok: false,
        error:
          'No se ha podido solicitar el cambio de email. Comprueba que no esté en uso.',
      };
    }
    emailChangePending = true;
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`.trim(),
      phone,
      marketing_consent_at: input.marketingConsent
        ? profile.profile.marketingConsentAt ?? new Date().toISOString()
        : null,
    })
    .eq('id', profile.profile.id);

  if (error) {
    console.error('[customer] update profile', error.code, error.message);
    return { ok: false, error: 'No se ha podido guardar el perfil.' };
  }

  revalidateCuenta(input.publicId);
  return { ok: true, emailChangePending };
}

export async function upsertCustomerAddressAction(input: {
  id?: string | null;
  label?: string | null;
  recipientName?: string | null;
  line1: string;
  line2?: string | null;
  postalCode: string;
  city: string;
  province?: string | null;
  isDefault?: boolean;
  publicId?: string;
}): Promise<CustomerActionResult<{ addressId: string }>> {
  const profile = await getCustomerProfile();
  if (!profile.ok) return { ok: false, error: profile.error };

  const line1 = input.line1.trim();
  const postalCode = input.postalCode.trim();
  const city = input.city.trim();
  if (!line1 || !postalCode || !city) {
    return { ok: false, error: 'Completa dirección, código postal y ciudad.' };
  }

  const supabase = createClient();
  const payload = {
    profile_id: profile.profile.id,
    label: input.label?.trim() || null,
    recipient_name: input.recipientName?.trim() || null,
    line1,
    line2: input.line2?.trim() || null,
    postal_code: postalCode,
    city,
    province: input.province?.trim() || null,
    country_code: 'ES',
    is_default: Boolean(input.isDefault),
  };

  if (input.id) {
    const { error } = await supabase
      .from('customer_addresses')
      .update(payload)
      .eq('id', input.id)
      .eq('profile_id', profile.profile.id);
    if (error) {
      console.error('[customer] address update', error.code, error.message);
      return { ok: false, error: 'No se ha podido actualizar la dirección.' };
    }
    revalidateCuenta(input.publicId);
    return { ok: true, addressId: input.id };
  }

  const { data, error } = await supabase
    .from('customer_addresses')
    .insert(payload)
    .select('id')
    .maybeSingle();

  if (error || !data?.id) {
    console.error('[customer] address insert', error?.code, error?.message);
    return { ok: false, error: 'No se ha podido guardar la dirección.' };
  }

  revalidateCuenta(input.publicId);
  return { ok: true, addressId: data.id as string };
}

export async function deleteCustomerAddressAction(input: {
  id: string;
  publicId?: string;
}): Promise<CustomerActionResult> {
  const profile = await getCustomerProfile();
  if (!profile.ok) return { ok: false, error: profile.error };

  const supabase = createClient();
  const { error } = await supabase
    .from('customer_addresses')
    .delete()
    .eq('id', input.id)
    .eq('profile_id', profile.profile.id);

  if (error) {
    return { ok: false, error: 'No se ha podido eliminar la dirección.' };
  }
  revalidateCuenta(input.publicId);
  return { ok: true };
}

export async function signOutCustomerAction(publicId?: string): Promise<CustomerActionResult> {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidateCuenta(publicId);
  return { ok: true };
}

/** Reexport útil para páginas server. */
export { getCustomerProfile, listCustomerAddresses };
