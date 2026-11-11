'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requirePharmacyLogoManageAccess } from '@/lib/pharmacies/pharmacy-logo-authz';
import {
  PHARMACY_LOGO_BUCKET,
  pharmacyLogoObjectPath,
  probePharmacyLogoBuffer,
} from '@/lib/pharmacies/pharmacy-logo-file';

export type PharmacyLogoActionResult =
  | { ok: true; logoUrl: string | null }
  | { ok: false; error: string };

function publicLogoUrl(supabaseUrl: string, objectPath: string): string {
  const base = supabaseUrl.replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${PHARMACY_LOGO_BUCKET}/${objectPath}`;
}

function mapStorageError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('bucket') && (m.includes('not found') || m.includes('404'))) {
    return 'El almacenamiento de logos aún no está disponible en este entorno. Aplica el SQL de staging documentado.';
  }
  if (m.includes('row-level security') || m.includes('42501')) {
    return 'No tienes permiso para modificar el logo de esta farmacia.';
  }
  return 'No se ha podido guardar el logo. Inténtalo de nuevo.';
}

async function listPharmacyLogoObjects(
  supabase: ReturnType<typeof createClient>,
  pharmacyId: string
): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(PHARMACY_LOGO_BUCKET)
    .list(pharmacyId, { limit: 50 });
  if (error || !data) return [];
  return data
    .map((f) => f.name)
    .filter((n) => /^logo\./i.test(n))
    .map((n) => `${pharmacyId}/${n}`);
}

/**
 * Sube o reemplaza el logo de la farmacia.
 * FormData: campo `file` (File/Blob).
 */
export async function uploadPharmacyLogoAction(
  pharmacyId: string,
  formData: FormData
): Promise<PharmacyLogoActionResult> {
  const gate = await requirePharmacyLogoManageAccess(pharmacyId);
  if (!gate.ok) return { ok: false, error: gate.error };

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { ok: false, error: 'Selecciona un archivo de imagen.' };
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const probed = probePharmacyLogoBuffer(buffer);
  if (!probed.ok) return { ok: false, error: probed.error };

  const objectPath = pharmacyLogoObjectPath(
    pharmacyId,
    probed.probe.extension
  );
  const supabase = createClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return { ok: false, error: 'Configuración de Storage incompleta.' };
  }

  // Eliminar variantes previas (png/jpg/webp) para no dejar basura
  const existing = await listPharmacyLogoObjects(supabase, pharmacyId);
  if (existing.length > 0) {
    await supabase.storage.from(PHARMACY_LOGO_BUCKET).remove(existing);
  }

  const { error: uploadError } = await supabase.storage
    .from(PHARMACY_LOGO_BUCKET)
    .upload(objectPath, buffer, {
      contentType: probed.probe.mime,
      upsert: true,
      cacheControl: '3600',
    });

  if (uploadError) {
    console.error('[pharmacy-logo] upload', uploadError.message);
    return { ok: false, error: mapStorageError(uploadError.message) };
  }

  const logoUrl = publicLogoUrl(supabaseUrl, objectPath);
  // Cache-bust para que el cartel/UI vean el reemplazo
  const logoUrlFresh = `${logoUrl}?v=${Date.now()}`;

  const { data: row, error: updateError } = await supabase
    .from('pharmacy_branding')
    .update({
      logo_url: logoUrlFresh,
      updated_by: gate.actorId,
    })
    .eq('pharmacy_id', pharmacyId)
    .select('pharmacy_id')
    .maybeSingle();

  if (updateError || !row) {
    console.error(
      '[pharmacy-logo] branding update',
      updateError?.message ?? 'no row'
    );
    return {
      ok: false,
      error:
        updateError?.message
          ? mapStorageError(updateError.message)
          : 'No se ha podido actualizar el branding con el nuevo logo.',
    };
  }

  revalidatePath(`/farmacias/${pharmacyId}`);
  revalidatePath(`/f/${pharmacyId}/configuracion`);
  revalidatePath(`/f/${pharmacyId}/qr`);
  return { ok: true, logoUrl: logoUrlFresh };
}

/** Elimina el logo (Storage + logo_url = null). */
export async function removePharmacyLogoAction(
  pharmacyId: string
): Promise<PharmacyLogoActionResult> {
  const gate = await requirePharmacyLogoManageAccess(pharmacyId);
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = createClient();
  const existing = await listPharmacyLogoObjects(supabase, pharmacyId);
  if (existing.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(PHARMACY_LOGO_BUCKET)
      .remove(existing);
    if (removeError) {
      console.error('[pharmacy-logo] remove storage', removeError.message);
      // Seguimos limpiando branding aunque falle el storage
    }
  }

  const { data: row, error: updateError } = await supabase
    .from('pharmacy_branding')
    .update({
      logo_url: null,
      updated_by: gate.actorId,
    })
    .eq('pharmacy_id', pharmacyId)
    .select('pharmacy_id')
    .maybeSingle();

  if (updateError || !row) {
    return {
      ok: false,
      error:
        'No se ha podido quitar el logo del branding. Comprueba tus permisos.',
    };
  }

  revalidatePath(`/farmacias/${pharmacyId}`);
  revalidatePath(`/f/${pharmacyId}/configuracion`);
  revalidatePath(`/f/${pharmacyId}/qr`);
  return { ok: true, logoUrl: null };
}
