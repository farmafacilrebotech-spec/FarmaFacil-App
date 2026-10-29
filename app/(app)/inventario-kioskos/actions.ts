'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import {
  hasKioskInventoryWrite,
} from '@/lib/kiosk-inventory/authz';

export type InventoryActionResult =
  | { ok: true; message?: string; codes?: string[] }
  | { ok: false; error: string };

function revalidateInventory(assetId?: string) {
  revalidatePath('/inventario-kioskos');
  if (assetId) revalidatePath(`/inventario-kioskos/${assetId}`);
}

function mapRpcStatus(status: string | undefined): string {
  switch (status) {
    case 'unauthenticated':
      return 'Debes iniciar sesión.';
    case 'forbidden':
      return 'No tienes permiso para modificar el inventario de kioskos.';
    case 'invalid_count':
      return 'Indica un número de unidades entre 1 y 500.';
    case 'serials_count_mismatch':
      return 'El número de series debe coincidir con las unidades del lote.';
    case 'duplicate_serial':
      return 'Ese número de serie ya está registrado en otro activo.';
    case 'serial_required':
      return 'Indica el número de serie del conjunto (Serial USB ICOD).';
    case 'invalid_dates':
      return 'La fecha de instalación no puede ser anterior al envío.';
    case 'not_found':
      return 'Activo no encontrado.';
    case 'pharmacy_not_found':
      return 'Farmacia no encontrada.';
    case 'device_mismatch':
      return 'El dispositivo no pertenece a esa farmacia o no está activo.';
    case 'retired':
      return 'Un activo retirado no se puede asignar.';
    case 'invalid_status':
      return 'Estado no válido.';
    case 'needs_assignment':
      return 'Para marcar como asignado, vincula primero una farmacia.';
    case 'invalid_input':
      return 'Datos incompletos o no válidos.';
    default:
      return 'No se ha podido completar la operación.';
  }
}

export async function receiveKioskBatchAction(input: {
  count: number;
  model?: string;
  vendor?: string;
  receivedAt?: string;
  purchaseOrderRef?: string;
  serialsText?: string;
  notes?: string;
}): Promise<InventoryActionResult> {
  if (!(await hasKioskInventoryWrite())) {
    return { ok: false, error: 'Sin permiso de escritura en inventario.' };
  }

  const serials = (input.serialsText ?? '')
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_kiosk_inventory_receive_batch_v1', {
    p_count: input.count,
    p_model: input.model?.trim() || null,
    p_vendor: input.vendor?.trim() || null,
    p_received_at: input.receivedAt || null,
    p_purchase_order_ref: input.purchaseOrderRef?.trim() || null,
    p_serials: serials.length > 0 ? serials : null,
    p_notes: input.notes?.trim() || null,
  });

  if (error) {
    console.error('[kiosk-inventory] receive', error.message);
    if (
      error.code === '42883' ||
      error.message.toLowerCase().includes('does not exist')
    ) {
      return {
        ok: false,
        error: 'Falta aplicar la migración 065 (inventario físico de kioskos).',
      };
    }
    return { ok: false, error: 'No se ha podido registrar el lote.' };
  }

  const payload = data as { status?: string; asset_codes?: string[] };
  if (payload?.status !== 'ok') {
    return { ok: false, error: mapRpcStatus(payload?.status) };
  }

  revalidateInventory();
  return {
    ok: true,
    message: `Se han dado de alta ${input.count} kiosko(s).`,
    codes: payload.asset_codes ?? [],
  };
}

export async function assignKioskAssetAction(input: {
  assetId: string;
  pharmacyId: string;
  deviceId?: string | null;
  notes?: string;
  shippedAt?: string | null;
  installedAt?: string | null;
}): Promise<InventoryActionResult> {
  if (!(await hasKioskInventoryWrite())) {
    return { ok: false, error: 'Sin permiso de escritura en inventario.' };
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_kiosk_inventory_assign_v1', {
    p_asset_id: input.assetId,
    p_pharmacy_id: input.pharmacyId,
    p_device_id: input.deviceId || null,
    p_notes: input.notes?.trim() || null,
    p_shipped_at: input.shippedAt || null,
    p_installed_at: input.installedAt || null,
  });
  if (error) {
    console.error('[kiosk-inventory] assign', error.message);
    return { ok: false, error: 'No se ha podido asignar el kiosko.' };
  }
  const payload = data as { status?: string };
  if (payload?.status !== 'ok') {
    return { ok: false, error: mapRpcStatus(payload?.status) };
  }
  revalidateInventory(input.assetId);
  return { ok: true, message: 'Kiosko asignado / enviado a farmacia.' };
}

export async function unassignKioskAssetAction(input: {
  assetId: string;
  endReason?: string;
  nextStatus?: 'warehouse' | 'pending_identification' | 'repair' | 'retired';
}): Promise<InventoryActionResult> {
  if (!(await hasKioskInventoryWrite())) {
    return { ok: false, error: 'Sin permiso de escritura en inventario.' };
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_kiosk_inventory_unassign_v1', {
    p_asset_id: input.assetId,
    p_end_reason: input.endReason?.trim() || 'unassigned',
    p_next_status: input.nextStatus || 'warehouse',
  });
  if (error) {
    console.error('[kiosk-inventory] unassign', error.message);
    return { ok: false, error: 'No se ha podido desvincular el kiosko.' };
  }
  const payload = data as { status?: string };
  if (payload?.status !== 'ok') {
    return { ok: false, error: mapRpcStatus(payload?.status) };
  }
  revalidateInventory(input.assetId);
  return { ok: true, message: 'Kiosko desvinculado (mismo código KSK conservado).' };
}

export async function setKioskAssetStatusAction(input: {
  assetId: string;
  status:
    | 'pending_identification'
    | 'warehouse'
    | 'assigned'
    | 'repair'
    | 'retired';
  notes?: string;
}): Promise<InventoryActionResult> {
  if (!(await hasKioskInventoryWrite())) {
    return { ok: false, error: 'Sin permiso de escritura en inventario.' };
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_kiosk_inventory_set_status_v1', {
    p_asset_id: input.assetId,
    p_status: input.status,
    p_notes: input.notes?.trim() || null,
  });
  if (error) {
    console.error('[kiosk-inventory] set_status', error.message);
    return { ok: false, error: 'No se ha podido cambiar el estado.' };
  }
  const payload = data as { status?: string };
  if (payload?.status !== 'ok') {
    return { ok: false, error: mapRpcStatus(payload?.status) };
  }
  revalidateInventory(input.assetId);
  return { ok: true, message: 'Estado actualizado.' };
}

export async function setKioskInsuranceAction(input: {
  assetId: string;
  policyRef: string;
  insurerName?: string;
  coverageStart?: string;
  coverageEnd?: string | null;
  notes?: string;
}): Promise<InventoryActionResult> {
  if (!(await hasKioskInventoryWrite())) {
    return { ok: false, error: 'Sin permiso de escritura en inventario.' };
  }
  if (!input.policyRef.trim()) {
    return { ok: false, error: 'Indica la referencia de la póliza.' };
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_kiosk_inventory_set_insurance_v1', {
    p_asset_id: input.assetId,
    p_policy_ref: input.policyRef.trim(),
    p_insurer_name: input.insurerName?.trim() || null,
    p_coverage_start: input.coverageStart || null,
    p_coverage_end: input.coverageEnd || null,
    p_notes: input.notes?.trim() || null,
  });
  if (error) {
    console.error('[kiosk-inventory] insurance', error.message);
    return { ok: false, error: 'No se ha podido guardar la póliza.' };
  }
  const payload = data as { status?: string };
  if (payload?.status !== 'ok') {
    return { ok: false, error: mapRpcStatus(payload?.status) };
  }
  revalidateInventory(input.assetId);
  return { ok: true, message: 'Cobertura de seguro registrada.' };
}

export async function updateKioskAssetMetaAction(input: {
  assetId: string;
  model?: string | null;
  vendor?: string | null;
  receivedAt?: string | null;
  purchaseOrderRef?: string | null;
  notes?: string | null;
}): Promise<InventoryActionResult> {
  if (!(await hasKioskInventoryWrite())) {
    return { ok: false, error: 'Sin permiso de escritura en inventario.' };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Debes iniciar sesión.' };

  const { error } = await supabase
    .from('kiosk_assets')
    .update({
      model: input.model?.trim() || null,
      vendor: input.vendor?.trim() || null,
      received_at: input.receivedAt || null,
      purchase_order_ref: input.purchaseOrderRef?.trim() || null,
      notes: input.notes?.trim() || null,
      updated_by: user.id,
    })
    .eq('id', input.assetId);

  if (error) {
    console.error('[kiosk-inventory] meta', error.code, error.message);
    return { ok: false, error: 'No se ha podido guardar.' };
  }
  revalidateInventory(input.assetId);
  return { ok: true, message: 'Datos técnicos actualizados.' };
}

/**
 * Serie del conjunto kiosko FarmaFácil = campo Serial del Diagnóstico USB ICOD.
 */
export async function setKioskAssetSerialsAction(input: {
  assetId: string;
  equipmentSerial?: string | null;
  markPending?: boolean;
  notes?: string;
}): Promise<InventoryActionResult> {
  if (!(await hasKioskInventoryWrite())) {
    return { ok: false, error: 'Sin permiso de escritura en inventario.' };
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_kiosk_inventory_set_serials_v1', {
    p_asset_id: input.assetId,
    p_equipment_serial: input.equipmentSerial?.trim() || null,
    p_mark_pending: Boolean(input.markPending),
    p_notes: input.notes?.trim() || null,
  });
  if (error) {
    console.error('[kiosk-inventory] set_serials', error.message);
    return { ok: false, error: 'No se ha podido guardar el número de serie.' };
  }
  const payload = data as { status?: string };
  if (payload?.status !== 'ok') {
    return { ok: false, error: mapRpcStatus(payload?.status) };
  }
  revalidateInventory(input.assetId);
  return {
    ok: true,
    message: input.markPending
      ? 'Marcado como pendiente de identificar.'
      : 'Número de serie registrado. Si estaba pendiente, pasa a «En almacén».',
  };
}
