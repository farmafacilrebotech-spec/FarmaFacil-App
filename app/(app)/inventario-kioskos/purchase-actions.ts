'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import {
  hasKioskInventoryWrite,
  hasKioskPurchasingRead,
  hasKioskPurchasingWrite,
} from '@/lib/kiosk-inventory/authz';
import {
  DEFAULT_KIOSK_DELIVERY_LEAD_MONTHS,
  KIOSK_PURCHASE_STORAGE_BUCKET,
  type KioskPurchaseDocType,
} from '@/lib/kiosk-inventory/purchase-types';

export type PurchaseActionResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

function revalidatePurchases(poId?: string) {
  revalidatePath('/inventario-kioskos');
  revalidatePath('/proveedores');
  if (poId) revalidatePath(`/inventario-kioskos?po=${poId}`);
}

function mapStatus(status: string | undefined): string {
  switch (status) {
    case 'unauthenticated':
      return 'Debes iniciar sesión.';
    case 'forbidden':
      return 'No tienes permiso para esta operación de compras.';
    case 'supplier_required':
      return 'Indica el nombre del proveedor. No se inventa.';
    case 'invalid_quantity':
      return 'Indica un número de unidades válido.';
    case 'invalid_count':
      return 'Indica un número de unidades a recibir entre 1 y 500.';
    case 'invalid_lead':
      return 'El plazo de entrega debe estar entre 0 y 24 meses.';
    case 'not_found':
      return 'Pedido no encontrado.';
    case 'cancelled':
      return 'El pedido está cancelado.';
    case 'quantity_below_received':
      return 'No puedes reducir las unidades por debajo de las ya recibidas.';
    case 'exceeds_remaining':
      return 'La recepción supera las unidades pendientes del pedido.';
    case 'serials_count_mismatch':
      return 'El número de series debe coincidir con las unidades recibidas.';
    case 'duplicate_serial':
      return 'Ese número de serie ya está registrado en otro activo.';
    case 'invalid_doc_type':
      return 'Tipo de documento no válido.';
    default:
      return 'No se ha podido completar la operación.';
  }
}

export async function upsertKioskPurchaseOrderAction(input: {
  id?: string | null;
  supplierName: string;
  orderNumber?: string | null;
  model?: string | null;
  quantity: number;
  orderedAt?: string | null;
  deliveryLeadMonths?: number;
  unitPriceCents?: number | null;
  shippingCents?: number | null;
  totalCents?: number | null;
  notes?: string | null;
  markAsOrdered?: boolean;
  cancel?: boolean;
}): Promise<PurchaseActionResult<{ id: string }>> {
  if (!(await hasKioskPurchasingWrite())) {
    return {
      ok: false,
      error:
        'Sin permiso de compras. Solo SuperAdmin (o perfiles con permiso financiero) pueden crear pedidos al proveedor.',
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_kiosk_purchase_order_upsert_v1', {
    p_id: input.id?.trim() || null,
    p_supplier_name: input.supplierName,
    p_order_number: input.orderNumber ?? null,
    p_model: input.model ?? null,
    p_quantity: input.quantity,
    p_ordered_at: input.orderedAt || null,
    p_delivery_lead_months:
      input.deliveryLeadMonths ?? DEFAULT_KIOSK_DELIVERY_LEAD_MONTHS,
    p_unit_price_cents: input.unitPriceCents ?? null,
    p_shipping_cents: input.shippingCents ?? null,
    p_total_cents: input.totalCents ?? null,
    p_notes: input.notes ?? null,
    p_mark_as_ordered: Boolean(input.markAsOrdered),
    p_cancel: Boolean(input.cancel),
  });

  if (error) {
    console.error('[kiosk-purchasing] upsert', error.message);
    if (
      error.code === '42883' ||
      error.message.toLowerCase().includes('does not exist')
    ) {
      return {
        ok: false,
        error: 'Falta aplicar la migración 068 (pedidos de compra de kioskos).',
      };
    }
    return { ok: false, error: 'No se ha podido guardar el pedido.' };
  }

  const payload = data as { status?: string; id?: string };
  if (payload?.status !== 'ok' || !payload.id) {
    return { ok: false, error: mapStatus(payload?.status) };
  }

  revalidatePurchases(payload.id);
  return { ok: true, id: payload.id };
}

export async function uploadKioskPurchaseDocumentAction(input: {
  purchaseOrderId: string;
  docType: KioskPurchaseDocType;
  fileName: string;
  mimeType?: string | null;
  base64: string;
  replaceDocumentId?: string | null;
}): Promise<PurchaseActionResult<{ documentId: string }>> {
  if (!(await hasKioskPurchasingWrite())) {
    return {
      ok: false,
      error: 'Sin permiso para adjuntar documentos de compra.',
    };
  }

  const rawName = input.fileName.trim();
  if (!rawName || !input.base64) {
    return { ok: false, error: 'Falta el archivo a adjuntar.' };
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(input.base64, 'base64');
  } catch {
    return { ok: false, error: 'El archivo no es válido.' };
  }
  if (bytes.byteLength === 0 || bytes.byteLength > 25 * 1024 * 1024) {
    return { ok: false, error: 'El archivo supera el tamaño máximo (25 MB).' };
  }

  const safeName = rawName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
  const path = `${input.purchaseOrderId}/${input.docType}/${Date.now()}-${safeName}`;

  const supabase = createClient();
  const { error: upError } = await supabase.storage
    .from(KIOSK_PURCHASE_STORAGE_BUCKET)
    .upload(path, bytes, {
      contentType: input.mimeType || 'application/octet-stream',
      upsert: false,
    });

  if (upError) {
    console.error('[kiosk-purchasing] upload', upError.message);
    return {
      ok: false,
      error:
        'No se ha podido subir el documento. Comprueba el bucket privado y tus permisos.',
    };
  }

  const { data, error } = await supabase.rpc(
    'ff_kiosk_purchase_order_add_document_v1',
    {
      p_purchase_order_id: input.purchaseOrderId,
      p_doc_type: input.docType,
      p_storage_path: path,
      p_file_name: rawName,
      p_mime_type: input.mimeType ?? null,
      p_byte_size: bytes.byteLength,
      p_replace_document_id: input.replaceDocumentId ?? null,
    }
  );

  if (error) {
    console.error('[kiosk-purchasing] doc meta', error.message);
    return { ok: false, error: 'No se ha podido registrar el documento.' };
  }

  const payload = data as { status?: string; id?: string };
  if (payload?.status !== 'ok' || !payload.id) {
    return { ok: false, error: mapStatus(payload?.status) };
  }

  revalidatePurchases(input.purchaseOrderId);
  return { ok: true, documentId: payload.id };
}

export async function getKioskPurchaseDocumentSignedUrlAction(input: {
  documentId: string;
}): Promise<PurchaseActionResult<{ url: string; fileName: string }>> {
  if (!(await hasKioskPurchasingRead())) {
    return {
      ok: false,
      error:
        'Sin permiso financiero: no puedes abrir presupuestos ni facturas del proveedor.',
    };
  }

  const supabase = createClient();
  const { data: doc, error } = await supabase
    .from('kiosk_purchase_order_documents')
    .select('id, storage_path, file_name')
    .eq('id', input.documentId)
    .maybeSingle();

  if (error || !doc) {
    return { ok: false, error: 'Documento no encontrado.' };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(KIOSK_PURCHASE_STORAGE_BUCKET)
    .createSignedUrl(doc.storage_path as string, 60);

  if (signError || !signed?.signedUrl) {
    return { ok: false, error: 'No se ha podido generar el enlace seguro.' };
  }

  return {
    ok: true,
    url: signed.signedUrl,
    fileName: doc.file_name as string,
  };
}

export async function receiveAgainstPurchaseOrderAction(input: {
  purchaseOrderId: string;
  count: number;
  receivedAt?: string | null;
  serialsText?: string | null;
  notes?: string | null;
}): Promise<PurchaseActionResult<{ codes: string[]; orderStatus?: string }>> {
  const canReceive =
    (await hasKioskInventoryWrite()) || (await hasKioskPurchasingWrite());
  if (!canReceive) {
    return { ok: false, error: 'Sin permiso para registrar la recepción.' };
  }

  const serials = (input.serialsText ?? '')
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_kiosk_purchase_receive_v1', {
    p_purchase_order_id: input.purchaseOrderId,
    p_count: input.count,
    p_received_at: input.receivedAt || null,
    p_serials: serials.length > 0 ? serials : null,
    p_notes: input.notes?.trim() || null,
  });

  if (error) {
    console.error('[kiosk-purchasing] receive', error.message);
    if (
      error.code === '42883' ||
      error.message.toLowerCase().includes('does not exist')
    ) {
      return {
        ok: false,
        error: 'Falta aplicar la migración 068 (pedidos de compra de kioskos).',
      };
    }
    return { ok: false, error: 'No se ha podido registrar la recepción.' };
  }

  const payload = data as {
    status?: string;
    asset_codes?: string[];
    order_status?: string;
    remaining?: number;
  };
  if (payload?.status !== 'ok') {
    const base = mapStatus(payload?.status);
    if (payload?.status === 'exceeds_remaining' && payload.remaining != null) {
      return {
        ok: false,
        error: `${base} Pendientes: ${payload.remaining}.`,
      };
    }
    return { ok: false, error: base };
  }

  revalidatePurchases(input.purchaseOrderId);
  revalidatePath('/inventario-kioskos');
  return {
    ok: true,
    codes: payload.asset_codes ?? [],
    orderStatus: payload.order_status,
  };
}
