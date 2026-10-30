'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
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
  const { data, error } = await supabase.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    options: {
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
        error: 'Ya existe una cuenta con este email. Inicia sesión o recupera la contraseña.',
        code: 'email_taken',
      };
    }
    console.error('[customer] signUp', error.message);
    return { ok: false, error: 'No se ha podido crear la cuenta. Inténtalo de nuevo.' };
  }

  const user = data.user;
  const session = data.session;
  // Si no hay sesión, Auth exige confirmación de email (no fingir login).
  const needsEmailConfirmation = !session;

  if (user && session) {
    // Asegurar campos en profiles por si el trigger no rellenó consent
    await supabase
      .from('profiles')
      .update({
        account_kind: 'customer',
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
    .eq('id', profile.profile.id)
    .eq('account_kind', 'customer');

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
