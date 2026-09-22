'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type {
  CreatePharmacyInput,
  UpdatePharmacyBrandingInput,
  UpdatePharmacyGeneralInput,
  UpdatePharmacySettingsInput,
} from '@/lib/pharmacies/types';

export type CreatePharmacyResult =
  | { ok: true; pharmacyId: string }
  | { ok: false; error: string };

export type UpdatePharmacyResult =
  | { ok: true }
  | { ok: false; error: string };

function emptyToNull(value: string | null | undefined): string | null {
  const v = value?.trim() ?? '';
  return v.length > 0 ? v : null;
}

function mapUpdateError(message: string, code?: string): string {
  const m = message.toLowerCase();
  if (code === '42501' || m.includes('permission') || m.includes('42501')) {
    return 'No tienes permiso para editar farmacias.';
  }
  if (m.includes('check') && m.includes('color')) {
    return 'Los colores deben tener formato #RRGGBB.';
  }
  if (m.includes('pharmacies_name_not_blank') || m.includes('name')) {
    return 'El nombre de la farmacia es obligatorio.';
  }
  return 'No se han podido guardar los cambios. Inténtalo de nuevo.';
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidCif(value: string): boolean {
  // Validación ligera ES: letra + 7–8 dígitos + control opcional, o NIF numérico.
  const v = value.trim().toUpperCase().replace(/[\s-]/g, '');
  return /^[A-Z]\d{7,8}[A-Z0-9]?$/.test(v) || /^\d{8}[A-Z]$/.test(v);
}

function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

function mapRpcError(message: string, code?: string): string {
  const m = message.toLowerCase();
  if (code === '42501' || m.includes('permission') || m.includes('42501')) {
    return 'No tienes permiso para crear farmacias.';
  }
  if (m.includes('not_authenticated')) {
    return 'Debes iniciar sesión para crear una farmacia.';
  }
  if (m.includes('pharmacy_name_required')) {
    return 'El nombre de la farmacia es obligatorio.';
  }
  if (m.includes('plan_key_required') || m.includes('plan_not_found')) {
    return 'Selecciona un plan válido.';
  }
  if (m.includes('plan_has_no_active_modules')) {
    return 'El plan seleccionado no tiene módulos activos. Contacta con soporte.';
  }
  if (m.includes('check') && m.includes('color')) {
    return 'Los colores deben tener formato #RRGGBB.';
  }
  return 'No se ha podido crear la farmacia. Inténtalo de nuevo.';
}

export async function createPharmacyAction(
  input: CreatePharmacyInput
): Promise<CreatePharmacyResult> {
  const name = input.name?.trim() ?? '';
  if (!name) {
    return { ok: false, error: 'El nombre de la farmacia es obligatorio.' };
  }

  const planKey = input.plan_key?.trim() ?? '';
  if (!['starter', 'pro', 'business', 'enterprise'].includes(planKey)) {
    return { ok: false, error: 'Selecciona un plan válido.' };
  }

  const email = input.email?.trim() ?? '';
  if (email && !isValidEmail(email)) {
    return { ok: false, error: 'El email no es válido.' };
  }

  const cif = input.cif?.trim() ?? '';
  if (cif && !isValidCif(cif)) {
    return { ok: false, error: 'El CIF/NIF no tiene un formato válido.' };
  }

  const primary = input.primary_color?.trim() || null;
  const secondary = input.secondary_color?.trim() || null;
  if (primary && !isHexColor(primary)) {
    return { ok: false, error: 'El color primario debe ser #RRGGBB.' };
  }
  if (secondary && !isHexColor(secondary)) {
    return { ok: false, error: 'El color secundario debe ser #RRGGBB.' };
  }

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Debes iniciar sesión para crear una farmacia.' };
  }

  const { data, error } = await supabase.rpc('ff_create_pharmacy_v1', {
    p_name: name,
    p_plan_key: planKey,
    p_legal_name: input.legal_name?.trim() || null,
    p_cif: cif || null,
    p_email: email || null,
    p_phone: input.phone?.trim() || null,
    p_web: input.web?.trim() || null,
    p_address_line: input.address_line?.trim() || null,
    p_postal_code: input.postal_code?.trim() || null,
    p_city: input.city?.trim() || null,
    p_province: input.province?.trim() || null,
    p_country: input.country?.trim() || 'ES',
    p_status: 'pending_setup',
    p_logo_color: input.logo_color?.trim() || primary,
    p_primary_color: primary,
    p_secondary_color: secondary,
    p_welcome_message: input.welcome_message?.trim() || null,
    p_visible_name: input.visible_name?.trim() || null,
    p_schedule: input.schedule?.trim() || null,
    p_settings_phone: input.settings_phone?.trim() || input.phone?.trim() || null,
    p_whatsapp: input.whatsapp?.trim() || null,
    p_settings_email: input.settings_email?.trim() || email || null,
  });

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[pharmacies] ff_create_pharmacy_v1', {
        message: error.message,
        code: error.code,
        details: error.details,
      });
    }
    return { ok: false, error: mapRpcError(error.message, error.code) };
  }

  const pharmacyId = typeof data === 'string' ? data : String(data);
  if (!pharmacyId) {
    return { ok: false, error: 'No se ha podido crear la farmacia. Inténtalo de nuevo.' };
  }

  revalidatePath('/farmacias');
  revalidatePath(`/farmacias/${pharmacyId}`);

  return { ok: true, pharmacyId };
}

export async function updatePharmacyGeneralAction(
  pharmacyId: string,
  input: UpdatePharmacyGeneralInput
): Promise<UpdatePharmacyResult> {
  if (!pharmacyId) {
    return { ok: false, error: 'Farmacia no válida.' };
  }

  const name = input.name?.trim() ?? '';
  if (!name) {
    return { ok: false, error: 'El nombre de la farmacia es obligatorio.' };
  }

  const email = emptyToNull(input.email);
  if (email && !isValidEmail(email)) {
    return { ok: false, error: 'El email no es válido.' };
  }

  const cif = emptyToNull(input.cif);
  if (cif && !isValidCif(cif)) {
    return { ok: false, error: 'El CIF/NIF no tiene un formato válido.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Debes iniciar sesión para editar la farmacia.' };
  }

  const { data, error } = await supabase
    .from('pharmacies')
    .update({
      name,
      legal_name: emptyToNull(input.legal_name),
      cif,
      email,
      phone: emptyToNull(input.phone),
      web: emptyToNull(input.web),
      address_line: emptyToNull(input.address_line),
      postal_code: emptyToNull(input.postal_code),
      city: emptyToNull(input.city),
      province: emptyToNull(input.province),
      country: emptyToNull(input.country) || 'ES',
      updated_by: user.id,
    })
    .eq('id', pharmacyId)
    .select('id')
    .maybeSingle();

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[pharmacies] update general', {
        message: error.message,
        code: error.code,
      });
    }
    return { ok: false, error: mapUpdateError(error.message, error.code) };
  }

  if (!data) {
    return {
      ok: false,
      error: 'No se ha podido actualizar la farmacia. Comprueba tus permisos.',
    };
  }

  revalidatePath('/farmacias');
  revalidatePath(`/farmacias/${pharmacyId}`);
  return { ok: true };
}

export async function updatePharmacyPersonalizationAction(
  pharmacyId: string,
  branding: UpdatePharmacyBrandingInput,
  settings: UpdatePharmacySettingsInput
): Promise<UpdatePharmacyResult> {
  if (!pharmacyId) {
    return { ok: false, error: 'Farmacia no válida.' };
  }

  const primary = emptyToNull(branding.primary_color);
  const secondary = emptyToNull(branding.secondary_color);
  if (primary && !isHexColor(primary)) {
    return { ok: false, error: 'El color primario debe ser #RRGGBB.' };
  }
  if (secondary && !isHexColor(secondary)) {
    return { ok: false, error: 'El color secundario debe ser #RRGGBB.' };
  }

  const settingsEmail = emptyToNull(settings.email);
  if (settingsEmail && !isValidEmail(settingsEmail)) {
    return { ok: false, error: 'El email de ajustes no es válido.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Debes iniciar sesión para editar la farmacia.' };
  }

  const { data: brandingRow, error: brandingError } = await supabase
    .from('pharmacy_branding')
    .update({
      primary_color: primary,
      secondary_color: secondary,
      welcome_message: emptyToNull(branding.welcome_message),
      updated_by: user.id,
    })
    .eq('pharmacy_id', pharmacyId)
    .select('pharmacy_id')
    .maybeSingle();

  if (brandingError) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[pharmacies] update branding', {
        message: brandingError.message,
        code: brandingError.code,
      });
    }
    return {
      ok: false,
      error: mapUpdateError(brandingError.message, brandingError.code),
    };
  }

  if (!brandingRow) {
    return {
      ok: false,
      error:
        'No se ha podido actualizar el branding. Comprueba tus permisos o que exista el registro.',
    };
  }

  const { data: settingsRow, error: settingsError } = await supabase
    .from('pharmacy_settings')
    .update({
      visible_name: emptyToNull(settings.visible_name),
      schedule: emptyToNull(settings.schedule),
      phone: emptyToNull(settings.phone),
      whatsapp: emptyToNull(settings.whatsapp),
      email: settingsEmail,
      updated_by: user.id,
    })
    .eq('pharmacy_id', pharmacyId)
    .select('pharmacy_id')
    .maybeSingle();

  if (settingsError) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[pharmacies] update settings', {
        message: settingsError.message,
        code: settingsError.code,
      });
    }
    return {
      ok: false,
      error: mapUpdateError(settingsError.message, settingsError.code),
    };
  }

  if (!settingsRow) {
    return {
      ok: false,
      error:
        'No se han podido actualizar los ajustes. Comprueba tus permisos o que exista el registro.',
    };
  }

  revalidatePath('/farmacias');
  revalidatePath(`/farmacias/${pharmacyId}`);
  return { ok: true };
}

function mapChangePlanError(message: string, code?: string): string {
  const m = message.toLowerCase();
  if (code === '42501' || m.includes('permission') || m.includes('42501')) {
    return 'No tienes permiso para cambiar el plan de la farmacia.';
  }
  if (m.includes('not_authenticated')) {
    return 'Debes iniciar sesión para cambiar el plan.';
  }
  if (m.includes('plan_already_current')) {
    return 'La farmacia ya tiene este plan.';
  }
  if (m.includes('subscription_status_not_changeable')) {
    return 'No se puede cambiar el plan con el estado actual de la suscripción.';
  }
  if (m.includes('current_subscription_not_found')) {
    return 'No se ha encontrado una suscripción activa o en periodo de prueba.';
  }
  if (m.includes('plan_not_found_or_inactive')) {
    return 'El plan seleccionado no está disponible.';
  }
  if (m.includes('plan_has_no_active_modules')) {
    return 'El plan seleccionado no tiene módulos disponibles.';
  }
  if (m.includes('pharmacy_not_found')) {
    return 'No se ha encontrado la farmacia.';
  }
  return 'No se ha podido cambiar el plan. Inténtalo de nuevo.';
}

export async function changePharmacyPlanAction(
  pharmacyId: string,
  newPlanKey: string
): Promise<UpdatePharmacyResult> {
  if (!pharmacyId) {
    return { ok: false, error: 'Farmacia no válida.' };
  }

  const planKey = newPlanKey?.trim() ?? '';
  if (!['starter', 'pro', 'business', 'enterprise'].includes(planKey)) {
    return { ok: false, error: 'Selecciona un plan válido.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Debes iniciar sesión para cambiar el plan.' };
  }

  const { error } = await supabase.rpc('ff_change_pharmacy_plan_v1', {
    p_pharmacy_id: pharmacyId,
    p_new_plan_key: planKey,
  });

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[pharmacies] ff_change_pharmacy_plan_v1', {
        message: error.message,
        code: error.code,
        details: error.details,
      });
    }
    return { ok: false, error: mapChangePlanError(error.message, error.code) };
  }

  revalidatePath('/farmacias');
  revalidatePath(`/farmacias/${pharmacyId}`);
  return { ok: true };
}
