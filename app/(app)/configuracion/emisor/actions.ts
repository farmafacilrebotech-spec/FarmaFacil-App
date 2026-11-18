'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { hasPlatformPermission } from '@/lib/auth/platform';

export async function saveIssuerProfileAction(input: {
  id: string | null;
  commercialName: string;
  legalName: string;
  taxId: string;
  fiscalAddress: string;
  phone: string;
  billingEmail: string;
  web: string;
  bankIban: string;
  bankHolder: string;
  notes: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await hasPlatformPermission('platform.subscriptions.manage'))) {
    return { ok: false, error: 'Sin permiso para gestionar el emisor.' };
  }
  const name = input.commercialName?.trim();
  if (!name) return { ok: false, error: 'El nombre comercial es obligatorio.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Debes iniciar sesión.' };

  const row = {
    commercial_name: name,
    legal_name: input.legalName.trim() || null,
    tax_id: input.taxId.trim() || null,
    fiscal_address: input.fiscalAddress.trim() || null,
    phone: input.phone.trim() || null,
    billing_email: input.billingEmail.trim() || null,
    web: input.web.trim() || null,
    bank_iban: input.bankIban.trim() || null,
    bank_holder: input.bankHolder.trim() || null,
    notes: input.notes.trim() || null,
    is_current: true,
    updated_by: user.id,
  };

  let profileId = input.id;
  if (profileId) {
    const { data: before } = await supabase
      .from('platform_issuer_profile')
      .select('*')
      .eq('id', profileId)
      .maybeSingle();
    const { error } = await supabase
      .from('platform_issuer_profile')
      .update(row)
      .eq('id', profileId);
    if (error) return { ok: false, error: 'No se ha podido guardar el perfil.' };
    await supabase.from('platform_issuer_profile_audit').insert({
      profile_id: profileId,
      changed_by: user.id,
      before_row: before,
      after_row: row,
    });
  } else {
    const { data, error } = await supabase
      .from('platform_issuer_profile')
      .insert({ ...row, created_by: user.id })
      .select('id')
      .single();
    if (error || !data) {
      return { ok: false, error: 'No se ha podido crear el perfil.' };
    }
    profileId = data.id;
    await supabase.from('platform_issuer_profile_audit').insert({
      profile_id: profileId,
      changed_by: user.id,
      before_row: null,
      after_row: row,
    });
  }

  revalidatePath('/configuracion/emisor');
  revalidatePath('/configuracion');
  return { ok: true };
}
