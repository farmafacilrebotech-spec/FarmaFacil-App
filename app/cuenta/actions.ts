'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getCustomerProfile } from '@/lib/customer/queries';
import { normalizePublicEntrypointId } from '@/lib/kiosk/public-id';

export type SavedPharmacyActionResult =
  | { ok: true; message?: string; alreadySaved?: boolean }
  | { ok: false; error: string; code?: string };

function revalidateSaved(publicId?: string) {
  revalidatePath('/cuenta');
  revalidatePath('/cuenta/mis-farmacias');
  if (publicId) {
    revalidatePath(`/e/${publicId}`);
    revalidatePath(`/e/${publicId}/catalogo`);
    revalidatePath(`/e/${publicId}/cuenta`);
  }
}

export async function savePharmacyAction(input: {
  publicId: string;
}): Promise<SavedPharmacyActionResult> {
  const profile = await getCustomerProfile();
  if (!profile.ok) {
    return {
      ok: false,
      error: profile.error,
      code: profile.code ?? 'unauthenticated',
    };
  }

  const publicId = normalizePublicEntrypointId(input.publicId);
  if (!publicId) {
    return { ok: false, error: 'Código de farmacia no válido.', code: 'invalid' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_customer_save_pharmacy_v1', {
    p_public_id: publicId,
  });

  if (error) {
    console.error('[customer] save pharmacy', error.message);
    if (
      error.code === '42883' ||
      error.message.toLowerCase().includes('does not exist')
    ) {
      return {
        ok: false,
        error: 'Falta aplicar la migración 067 (Mis farmacias).',
        code: 'migration_missing',
      };
    }
    return { ok: false, error: 'No se ha podido guardar la farmacia.' };
  }

  const body = data as { status?: string };
  if (body?.status === 'not_found' || body?.status === 'inactive') {
    return {
      ok: false,
      error: 'Esta farmacia no está disponible para guardar.',
      code: body.status,
    };
  }
  if (body?.status !== 'ok') {
    return { ok: false, error: 'No se ha podido guardar la farmacia.' };
  }

  revalidateSaved(publicId);
  return { ok: true, message: 'Farmacia guardada en Mis farmacias.' };
}

export async function unsavePharmacyAction(input: {
  publicId?: string;
  pharmacyId?: string;
}): Promise<SavedPharmacyActionResult> {
  const profile = await getCustomerProfile();
  if (!profile.ok) {
    return {
      ok: false,
      error: profile.error,
      code: profile.code ?? 'unauthenticated',
    };
  }

  const publicId = input.publicId
    ? normalizePublicEntrypointId(input.publicId)
    : null;
  if (!publicId && !input.pharmacyId) {
    return { ok: false, error: 'Indica la farmacia a quitar.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_customer_unsave_pharmacy_v1', {
    p_public_id: publicId,
    p_pharmacy_id: input.pharmacyId ?? null,
  });

  if (error) {
    console.error('[customer] unsave pharmacy', error.message);
    return { ok: false, error: 'No se ha podido quitar la farmacia.' };
  }

  const body = data as { status?: string; removed?: boolean };
  if (body?.status !== 'ok') {
    return { ok: false, error: 'No se ha podido quitar la farmacia.' };
  }

  revalidateSaved(publicId ?? undefined);
  revalidatePath('/cuenta/mis-farmacias');
  return {
    ok: true,
    message: body.removed
      ? 'Farmacia eliminada de Mis farmacias.'
      : 'La farmacia no estaba guardada.',
  };
}
