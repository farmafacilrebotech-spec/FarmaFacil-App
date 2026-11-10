'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import {
  hasSuppliersApprove,
  hasSuppliersWrite,
} from '@/lib/kiosk-inventory/authz';
import {
  isSupplierCategory,
  SUPPLIER_DOCS_BUCKET,
  SUPPLIER_PO_DOC_TYPES,
  SUPPLIER_PO_STATUSES,
  SUPPLIER_PO_UI_STATUSES,
  SUPPLIER_QUOTE_STATUSES,
  SUPPLIER_QUOTE_UI_STATUSES,
  type SupplierCategory,
  type SupplierPurchaseDocType,
  type SupplierPurchaseStatus,
  type SupplierQuoteStatus,
} from '@/lib/suppliers/types';
import { getCurrentProfile } from '@/lib/auth/platform';
import { listQuoteLines } from '@/lib/suppliers/queries';

export type SupplierActionResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

function revalidateSuppliers(supplierId?: string) {
  revalidatePath('/proveedores');
  if (supplierId) revalidatePath(`/proveedores?supplier=${supplierId}`);
}

async function actorId(): Promise<string | null> {
  const p = await getCurrentProfile();
  return p.profile?.id ?? null;
}

async function logActivity(
  supplierId: string,
  action: string,
  summary: string
) {
  const supabase = createClient();
  const uid = await actorId();
  await supabase.from('platform_supplier_activity').insert({
    supplier_id: supplierId,
    actor_profile_id: uid,
    action,
    summary,
  });
}

async function logStatusEvent(input: {
  entityType: 'quote' | 'purchase_order';
  entityId: string;
  supplierId?: string | null;
  fromStatus?: string | null;
  toStatus: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createClient();
  const uid = await actorId();
  const { error } = await supabase.from('platform_supplier_status_events').insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    supplier_id: input.supplierId ?? null,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus,
    reason: input.reason?.trim() || null,
    actor_profile_id: uid,
    metadata: input.metadata ?? {},
  });
  // Compatibilidad pre-077: ignorar si la tabla aún no existe.
  if (error && !String(error.message).toLowerCase().includes('does not exist')) {
    console.error('[suppliers] status_event', error.code, error.message);
  }
}

function isApproveTransition(from: string | null, to: string): boolean {
  return to === 'aprobado' || to === 'rechazado' || from === 'aprobado';
}

export async function upsertSupplierAction(input: {
  id?: string | null;
  legalName: string;
  tradeName?: string | null;
  taxId?: string | null;
  category?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
}): Promise<SupplierActionResult<{ id: string }>> {
  if (!(await hasSuppliersWrite())) {
    return { ok: false, error: 'Sin permiso de gestión de proveedores.' };
  }
  const legalName = input.legalName.trim();
  if (!legalName) return { ok: false, error: 'La razón social es obligatoria.' };
  const categoryRaw = (input.category ?? 'otros').trim();
  if (!isSupplierCategory(categoryRaw)) {
    return { ok: false, error: 'Categoría de proveedor no válida.' };
  }
  const category: SupplierCategory = categoryRaw;

  const supabase = createClient();
  const uid = await actorId();
  const payload = {
    legal_name: legalName,
    trade_name: input.tradeName?.trim() || null,
    tax_id: input.taxId?.trim() || null,
    category,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    website: input.website?.trim() || null,
    payment_terms: input.paymentTerms?.trim() || null,
    notes: input.notes?.trim() || null,
    updated_by: uid,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from('platform_suppliers')
      .update(payload)
      .eq('id', input.id);
    if (error) return { ok: false, error: 'No se ha podido actualizar el proveedor.' };
    await logActivity(input.id, 'supplier.updated', `Actualizado: ${legalName}`);
    revalidateSuppliers(input.id);
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase
    .from('platform_suppliers')
    .insert({ ...payload, created_by: uid, status: 'active' })
    .select('id')
    .single();
  if (error || !data) {
    return { ok: false, error: 'No se ha podido crear el proveedor.' };
  }
  const id = String((data as { id: string }).id);
  await logActivity(id, 'supplier.created', `Alta: ${legalName}`);
  revalidateSuppliers(id);
  return { ok: true, id };
}

export async function archiveSupplierAction(
  supplierId: string
): Promise<SupplierActionResult> {
  if (!(await hasSuppliersWrite())) {
    return { ok: false, error: 'Sin permiso de gestión de proveedores.' };
  }
  const supabase = createClient();
  const uid = await actorId();
  const { error } = await supabase
    .from('platform_suppliers')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
      updated_by: uid,
      updated_at: new Date().toISOString(),
    })
    .eq('id', supplierId);
  if (error) return { ok: false, error: 'No se ha podido archivar.' };
  await logActivity(supplierId, 'supplier.archived', 'Proveedor archivado');
  revalidateSuppliers(supplierId);
  return { ok: true };
}

export async function upsertSupplierContactAction(input: {
  id?: string | null;
  supplierId: string;
  fullName: string;
  roleTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
}): Promise<SupplierActionResult<{ id: string }>> {
  if (!(await hasSuppliersWrite())) {
    return { ok: false, error: 'Sin permiso.' };
  }
  const fullName = input.fullName.trim();
  if (!fullName) return { ok: false, error: 'Nombre de contacto obligatorio.' };
  const supabase = createClient();
  const row = {
    supplier_id: input.supplierId,
    full_name: fullName,
    role_title: input.roleTitle?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    is_primary: Boolean(input.isPrimary),
  };
  if (input.id) {
    const { error } = await supabase
      .from('platform_supplier_contacts')
      .update(row)
      .eq('id', input.id);
    if (error) return { ok: false, error: 'No se ha podido guardar el contacto.' };
    revalidateSuppliers(input.supplierId);
    return { ok: true, id: input.id };
  }
  const { data, error } = await supabase
    .from('platform_supplier_contacts')
    .insert(row)
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: 'No se ha podido crear el contacto.' };
  await logActivity(
    input.supplierId,
    'supplier.contact_added',
    `Contacto: ${fullName}`
  );
  revalidateSuppliers(input.supplierId);
  return { ok: true, id: String((data as { id: string }).id) };
}

export async function upsertSupplierQuoteAction(input: {
  id?: string | null;
  supplierId: string;
  title: string;
  quoteNumber?: string | null;
  status?: SupplierQuoteStatus;
  receivedAt?: string | null;
  validUntil?: string | null;
  shippingCents?: number | null;
  notes?: string | null;
  rejectionReason?: string | null;
  /** Si true, sustituye todas las líneas por `lines` (incluso vacío). */
  replaceLines?: boolean;
  lines?: Array<{
    materialKey: string;
    description: string;
    quantity: number;
    unit?: string | null;
    unitPriceCents: number;
    vatBps?: number;
    leadDays?: number | null;
  }>;
}): Promise<SupplierActionResult<{ id: string }>> {
  if (!(await hasSuppliersWrite())) {
    return { ok: false, error: 'Sin permiso de presupuestos.' };
  }
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Título del presupuesto obligatorio.' };
  const status = input.status ?? 'recibido';
  if (!(SUPPLIER_QUOTE_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: 'Estado de presupuesto no válido.' };
  }
  if (
    !(SUPPLIER_QUOTE_UI_STATUSES as readonly string[]).includes(status) &&
    status !== 'caducado'
  ) {
    return { ok: false, error: 'Estado de presupuesto no permitido en UI.' };
  }
  if (status === 'rechazado' && !input.rejectionReason?.trim()) {
    return { ok: false, error: 'Indica el motivo de rechazo.' };
  }

  const supabase = createClient();
  const uid = await actorId();

  let previousStatus: string | null = null;
  if (input.id) {
    const { data: prev } = await supabase
      .from('platform_supplier_quotes')
      .select('id, status, supplier_id')
      .eq('id', input.id)
      .maybeSingle();
    if (!prev) return { ok: false, error: 'Presupuesto no encontrado.' };
    previousStatus = String((prev as { status: string }).status);
  }

  if (isApproveTransition(previousStatus, status)) {
    if (!(await hasSuppliersApprove())) {
      return {
        ok: false,
        error: 'Sin permiso para aceptar o rechazar presupuestos.',
      };
    }
  }

  const nowIso = new Date().toISOString();
  const base: Record<string, unknown> = {
    supplier_id: input.supplierId,
    title,
    quote_number: input.quoteNumber?.trim() || null,
    status,
    received_at: input.receivedAt || null,
    valid_until: input.validUntil || null,
    shipping_cents: input.shippingCents ?? null,
    notes: input.notes?.trim() || null,
    updated_by: uid,
    updated_at: nowIso,
  };

  if (status === 'aprobado') {
    base.approved_by = uid;
    base.approved_at = nowIso;
    base.rejection_reason = null;
    base.rejected_by = null;
    base.rejected_at = null;
  } else if (status === 'rechazado') {
    base.rejection_reason = input.rejectionReason?.trim() || null;
    base.rejected_by = uid;
    base.rejected_at = nowIso;
  } else if (input.rejectionReason !== undefined) {
    base.rejection_reason = input.rejectionReason?.trim() || null;
  }

  let quoteId = input.id ?? null;
  if (quoteId) {
    const { error } = await supabase
      .from('platform_supplier_quotes')
      .update(base)
      .eq('id', quoteId);
    if (error) {
      return {
        ok: false,
        error: `No se ha podido actualizar el presupuesto.${error.message ? ` (${error.message})` : ''}`,
      };
    }
  } else {
    const { data, error } = await supabase
      .from('platform_supplier_quotes')
      .insert({ ...base, created_by: uid })
      .select('id')
      .single();
    if (error || !data) {
      return { ok: false, error: 'No se ha podido crear el presupuesto.' };
    }
    quoteId = String((data as { id: string }).id);
  }

  const shouldReplace =
    input.replaceLines === true ||
    (input.lines != null && input.lines.length > 0 && !input.id);
  if (shouldReplace || (input.replaceLines && input.lines)) {
    await supabase
      .from('platform_supplier_quote_lines')
      .delete()
      .eq('quote_id', quoteId);
    const lines = input.lines ?? [];
    if (lines.length > 0) {
      const rows = lines.map((l, i) => ({
        quote_id: quoteId,
        material_key: l.materialKey.trim().toLowerCase(),
        description: l.description.trim(),
        quantity: l.quantity,
        unit: l.unit?.trim() || null,
        unit_price_cents: l.unitPriceCents,
        vat_bps: l.vatBps ?? 2100,
        lead_days: l.leadDays ?? null,
        sort_order: i,
      }));
      const { error: lineErr } = await supabase
        .from('platform_supplier_quote_lines')
        .insert(rows);
      if (lineErr) {
        return { ok: false, error: 'Presupuesto guardado, pero fallaron las líneas.' };
      }
    }
  }

  if (previousStatus !== status) {
    await logStatusEvent({
      entityType: 'quote',
      entityId: quoteId,
      supplierId: input.supplierId,
      fromStatus: previousStatus,
      toStatus: status,
      reason: status === 'rechazado' ? input.rejectionReason : null,
    });
  }

  await logActivity(
    input.supplierId,
    'supplier.quote_upsert',
    `Presupuesto «${title}» (${status})`
  );
  revalidateSuppliers(input.supplierId);
  return { ok: true, id: quoteId };
}

/** Pedido general de materiales/servicios (no kiosko). */
export async function upsertGeneralPurchaseOrderAction(input: {
  id?: string | null;
  supplierId: string;
  quoteId?: string | null;
  category: SupplierCategory;
  title: string;
  orderNumber?: string | null;
  status?: SupplierPurchaseStatus;
  orderedAt?: string | null;
  expectedDeliveryAt?: string | null;
  actualDeliveryAt?: string | null;
  subtotalCents?: number | null;
  taxCents?: number | null;
  shippingCents?: number | null;
  totalCents?: number | null;
  notes?: string | null;
  /** Idempotencia anti doble clic / reintentos. */
  clientRequestId?: string | null;
  replaceLines?: boolean;
  lines?: Array<{
    description: string;
    quantity: number;
    unit?: string | null;
    unitPriceCents: number;
    vatBps?: number;
  }>;
}): Promise<SupplierActionResult<{ id: string }>> {
  if (!(await hasSuppliersWrite())) {
    return { ok: false, error: 'Sin permiso de pedidos.' };
  }
  if (!isSupplierCategory(input.category)) {
    return { ok: false, error: 'Categoría no válida.' };
  }
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Título del pedido obligatorio.' };
  const status = input.status ?? 'borrador';
  if (!(SUPPLIER_PO_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: 'Estado de pedido no válido.' };
  }
  if (
    !(SUPPLIER_PO_UI_STATUSES as readonly string[]).includes(status) &&
    status !== 'parcial' &&
    status !== 'facturado'
  ) {
    return { ok: false, error: 'Estado de pedido no permitido.' };
  }

  const supabase = createClient();
  const uid = await actorId();
  const clientRequestId = input.clientRequestId?.trim() || null;

  if (!input.id && clientRequestId) {
    const { data: existing } = await supabase
      .from('platform_supplier_purchase_orders')
      .select('id')
      .eq('client_request_id', clientRequestId)
      .maybeSingle();
    if (existing) {
      return { ok: true, id: String((existing as { id: string }).id) };
    }
  }

  let previousStatus: string | null = null;
  let preservedQuoteId: string | null = input.quoteId || null;
  if (input.id) {
    const { data: prev } = await supabase
      .from('platform_supplier_purchase_orders')
      .select('id, status, quote_id')
      .eq('id', input.id)
      .maybeSingle();
    if (!prev) return { ok: false, error: 'Pedido no encontrado.' };
    previousStatus = String((prev as { status: string }).status);
    const prevQuote = (prev as { quote_id?: string | null }).quote_id;
    if (prevQuote) preservedQuoteId = String(prevQuote);
  }

  // Relación permanente con presupuesto origen: no se elimina al editar.
  if (input.quoteId && preservedQuoteId && input.quoteId !== preservedQuoteId) {
    return {
      ok: false,
      error: 'No se puede cambiar el presupuesto origen de un pedido existente.',
    };
  }

  const nowIso = new Date().toISOString();
  const base: Record<string, unknown> = {
    supplier_id: input.supplierId,
    quote_id: preservedQuoteId,
    category: input.category,
    title,
    order_number: input.orderNumber?.trim() || null,
    status,
    ordered_at: input.orderedAt || null,
    expected_delivery_at: input.expectedDeliveryAt || null,
    actual_delivery_at: input.actualDeliveryAt || null,
    subtotal_cents: input.subtotalCents ?? null,
    tax_cents: input.taxCents ?? null,
    shipping_cents: input.shippingCents ?? null,
    total_cents: input.totalCents ?? null,
    notes: input.notes?.trim() || null,
    updated_by: uid,
    updated_at: nowIso,
  };
  if (!input.id && clientRequestId) {
    base.client_request_id = clientRequestId;
  }

  let poId = input.id ?? null;
  if (poId) {
    const { error } = await supabase
      .from('platform_supplier_purchase_orders')
      .update(base)
      .eq('id', poId);
    if (error) {
      return {
        ok: false,
        error: `No se ha podido actualizar el pedido.${error.message ? ` (${error.message})` : ''}`,
      };
    }
  } else {
    const { data, error } = await supabase
      .from('platform_supplier_purchase_orders')
      .insert({ ...base, created_by: uid })
      .select('id')
      .single();
    if (error || !data) {
      // Unique quote activo / client_request_id → devolver existente
      if (error && (error.code === '23505' || /unique|duplicate/i.test(error.message))) {
        if (clientRequestId) {
          const { data: byReq } = await supabase
            .from('platform_supplier_purchase_orders')
            .select('id')
            .eq('client_request_id', clientRequestId)
            .maybeSingle();
          if (byReq) return { ok: true, id: String((byReq as { id: string }).id) };
        }
        if (preservedQuoteId) {
          const { data: byQuote } = await supabase
            .from('platform_supplier_purchase_orders')
            .select('id')
            .eq('quote_id', preservedQuoteId)
            .neq('status', 'cancelado')
            .maybeSingle();
          if (byQuote) return { ok: true, id: String((byQuote as { id: string }).id) };
        }
        return {
          ok: false,
          error: 'Ya existe un pedido activo para este presupuesto.',
        };
      }
      return { ok: false, error: 'No se ha podido crear el pedido general.' };
    }
    poId = String((data as { id: string }).id);
  }

  const shouldReplace =
    input.replaceLines === true ||
    (input.lines != null && input.lines.length > 0 && !input.id);
  if (shouldReplace || (input.replaceLines && input.lines)) {
    await supabase
      .from('platform_supplier_purchase_lines')
      .delete()
      .eq('purchase_order_id', poId);
    const lines = input.lines ?? [];
    if (lines.length > 0) {
      const rows = lines.map((l, i) => {
        const qty = l.quantity > 0 ? l.quantity : 1;
        const vat = l.vatBps ?? 2100;
        const net = Math.round(qty * l.unitPriceCents);
        const lineTotal = Math.round(net * (1 + vat / 10000));
        return {
          purchase_order_id: poId,
          description: l.description.trim(),
          quantity: qty,
          unit: l.unit?.trim() || null,
          unit_price_cents: l.unitPriceCents,
          vat_bps: vat,
          line_total_cents: lineTotal,
          sort_order: i,
        };
      });
      const { error: lineErr } = await supabase
        .from('platform_supplier_purchase_lines')
        .insert(rows);
      if (lineErr) {
        return { ok: false, error: 'Pedido guardado, pero fallaron las líneas.' };
      }
    }
  }

  if (previousStatus !== status) {
    await logStatusEvent({
      entityType: 'purchase_order',
      entityId: poId,
      supplierId: input.supplierId,
      fromStatus: previousStatus,
      toStatus: status,
    });
  }

  await logActivity(
    input.supplierId,
    'supplier.purchase_upsert',
    `Pedido «${title}» (${status})`
  );
  revalidateSuppliers(input.supplierId);
  return { ok: true, id: poId };
}

/**
 * Prepara borrador de pedido general desde presupuesto aceptado.
 * No confirma la compra (queda en borrador para revisión).
 */
export async function preparePurchaseFromQuoteAction(input: {
  quoteId: string;
  clientRequestId?: string | null;
}): Promise<SupplierActionResult<{ id: string; alreadyExisted: boolean }>> {
  if (!(await hasSuppliersWrite())) {
    return { ok: false, error: 'Sin permiso de pedidos.' };
  }
  const supabase = createClient();
  const { data: quote, error } = await supabase
    .from('platform_supplier_quotes')
    .select(
      'id, status, title, supplier_id, shipping_cents, notes, platform_suppliers ( legal_name, category, payment_terms )'
    )
    .eq('id', input.quoteId)
    .maybeSingle();
  if (error || !quote) return { ok: false, error: 'Presupuesto no encontrado.' };
  const q = quote as Record<string, unknown>;
  if (String(q.status) !== 'aprobado') {
    return {
      ok: false,
      error: 'Solo se prepara pedido desde presupuestos aceptados.',
    };
  }

  const { data: existing } = await supabase
    .from('platform_supplier_purchase_orders')
    .select('id')
    .eq('quote_id', input.quoteId)
    .neq('status', 'cancelado')
    .maybeSingle();
  if (existing) {
    return {
      ok: true,
      id: String((existing as { id: string }).id),
      alreadyExisted: true,
    };
  }

  const linesRes = await listQuoteLines(input.quoteId);
  if (!linesRes.ok) return linesRes;
  const supplier = q.platform_suppliers as {
    legal_name?: string;
    category?: string;
    payment_terms?: string | null;
  } | null;
  const category = isSupplierCategory(supplier?.category)
    ? (supplier!.category as SupplierCategory)
    : 'otros';

  let subtotal = 0;
  let tax = 0;
  const poLines = linesRes.lines.map((l) => {
    const net = Math.round(l.quantity * l.unitPriceCents);
    const lineTax = Math.round(net * (l.vatBps / 10000));
    subtotal += net;
    tax += lineTax;
    return {
      description: l.description || l.materialKey,
      quantity: l.quantity,
      unit: l.unit,
      unitPriceCents: l.unitPriceCents,
      vatBps: l.vatBps,
    };
  });
  const shipping =
    q.shipping_cents == null ? null : Number(q.shipping_cents);
  const total =
    subtotal + tax + (shipping == null ? 0 : shipping);

  const notesParts = [
    `Borrador desde presupuesto aceptado ${input.quoteId}`,
    q.notes ? `Condiciones presupuesto: ${String(q.notes)}` : null,
    supplier?.payment_terms
      ? `Pago proveedor: ${supplier.payment_terms}`
      : null,
  ].filter(Boolean);

  const created = await upsertGeneralPurchaseOrderAction({
    supplierId: String(q.supplier_id),
    quoteId: String(q.id),
    category,
    title: String(q.title),
    status: 'borrador',
    shippingCents: shipping,
    subtotalCents: subtotal || null,
    taxCents: tax || null,
    totalCents: total || null,
    notes: notesParts.join('\n'),
    clientRequestId: input.clientRequestId ?? null,
    replaceLines: true,
    lines: poLines,
  });
  if (!created.ok) return created;

  await logActivity(
    String(q.supplier_id),
    'supplier.quote_prepare_purchase',
    `Presupuesto → borrador pedido ${created.id}`
  );
  return { ok: true, id: created.id, alreadyExisted: false };
}

/**
 * Convierte presupuesto aceptado:
 * - target 'general' → borrador revisable (no confirma compra)
 * - target 'kiosk' → kiosk_purchase_orders (integración existente, sin marcar pedido)
 */
export async function convertApprovedQuoteToPurchaseAction(input: {
  quoteId: string;
  target: 'general' | 'kiosk';
  quantity?: number;
  category?: SupplierCategory;
  model?: string | null;
  clientRequestId?: string | null;
}): Promise<SupplierActionResult<{ purchaseOrderId: string; kind: 'general' | 'kiosk' }>> {
  if (!(await hasSuppliersWrite())) {
    return { ok: false, error: 'Sin permiso.' };
  }

  if (input.target === 'general') {
    const prepared = await preparePurchaseFromQuoteAction({
      quoteId: input.quoteId,
      clientRequestId: input.clientRequestId ?? null,
    });
    if (!prepared.ok) return prepared;
    return { ok: true, purchaseOrderId: prepared.id, kind: 'general' };
  }

  const supabase = createClient();
  const { data: quote, error } = await supabase
    .from('platform_supplier_quotes')
    .select(
      'id, status, title, supplier_id, shipping_cents, platform_suppliers ( legal_name, category )'
    )
    .eq('id', input.quoteId)
    .maybeSingle();
  if (error || !quote) return { ok: false, error: 'Presupuesto no encontrado.' };
  const q = quote as Record<string, unknown>;
  if (String(q.status) !== 'aprobado') {
    return { ok: false, error: 'Solo se convierten presupuestos aceptados.' };
  }
  const supplier = q.platform_suppliers as {
    legal_name?: string;
    category?: string;
  } | null;
  const supplierName = supplier?.legal_name?.trim();
  if (!supplierName) return { ok: false, error: 'Proveedor sin razón social.' };

  const { data: rpc, error: rpcErr } = await supabase.rpc(
    'ff_kiosk_purchase_order_upsert_v1',
    {
      p_id: null,
      p_supplier_name: supplierName,
      p_order_number: null,
      p_model: input.model?.trim() || String(q.title),
      p_quantity: input.quantity && input.quantity > 0 ? input.quantity : 1,
      p_ordered_at: null,
      p_delivery_lead_months: 2,
      p_unit_price_cents: null,
      p_shipping_cents: null,
      p_total_cents: null,
      p_notes: `Desde presupuesto ${input.quoteId}`,
      p_mark_as_ordered: false,
      p_cancel: false,
    }
  );
  if (rpcErr) {
    return {
      ok: false,
      error:
        'No se pudo crear el pedido kiosko. ¿Migración 076? ¿Permiso kiosk_purchasing.write?',
    };
  }
  const status = (rpc as { status?: string; id?: string } | null)?.status;
  const poId = (rpc as { id?: string } | null)?.id;
  if (status !== 'ok' || !poId) {
    return { ok: false, error: 'RPC de pedido kiosko no disponible o rechazada.' };
  }

  await supabase
    .from('kiosk_purchase_orders')
    .update({ supplier_id: String(q.supplier_id) })
    .eq('id', poId);

  await logActivity(
    String(q.supplier_id),
    'supplier.quote_converted_kiosk',
    `Presupuesto → pedido kiosko ${poId}`
  );
  revalidatePath('/proveedores');
  revalidatePath('/inventario-kioskos');
  return { ok: true, purchaseOrderId: poId, kind: 'kiosk' };
}

/** @deprecated usar convertApprovedQuoteToPurchaseAction */
export async function convertApprovedQuoteToKioskPurchaseAction(input: {
  quoteId: string;
  quantity: number;
  model?: string | null;
}): Promise<SupplierActionResult<{ purchaseOrderId: string }>> {
  const res = await convertApprovedQuoteToPurchaseAction({
    quoteId: input.quoteId,
    target: 'kiosk',
    quantity: input.quantity,
    model: input.model,
  });
  if (!res.ok) return res;
  return { ok: true, purchaseOrderId: res.purchaseOrderId };
}

export async function uploadSupplierQuoteDocumentAction(formData: FormData): Promise<
  SupplierActionResult<{ documentId: string }>
> {
  if (!(await hasSuppliersWrite())) {
    return { ok: false, error: 'Sin permiso.' };
  }
  const quoteId = String(formData.get('quoteId') ?? '');
  const file = formData.get('file');
  if (!quoteId || !(file instanceof File)) {
    return { ok: false, error: 'Faltan presupuesto o archivo.' };
  }
  const supabase = createClient();
  const path = `${quoteId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(SUPPLIER_DOCS_BUCKET)
    .upload(path, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (upErr) return { ok: false, error: 'No se ha podido subir el documento.' };

  const uid = await actorId();
  const { data, error } = await supabase
    .from('platform_supplier_quote_documents')
    .insert({
      quote_id: quoteId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      byte_size: file.size,
      uploaded_by: uid,
    })
    .select('id')
    .single();
  if (error || !data) {
    return { ok: false, error: 'Metadatos de documento no guardados.' };
  }
  revalidateSuppliers();
  return { ok: true, documentId: String((data as { id: string }).id) };
}

export async function getSupplierDocSignedUrlAction(
  storagePath: string
): Promise<SupplierActionResult<{ url: string }>> {
  const { hasSuppliersRead } = await import('@/lib/kiosk-inventory/authz');
  if (!(await hasSuppliersRead())) {
    return { ok: false, error: 'Sin permiso.' };
  }
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(SUPPLIER_DOCS_BUCKET)
    .createSignedUrl(storagePath, 120);
  if (error || !data?.signedUrl) {
    return { ok: false, error: 'No se ha podido firmar la URL.' };
  }
  return { ok: true, url: data.signedUrl };
}

export async function uploadPurchaseDocumentAction(formData: FormData): Promise<
  SupplierActionResult<{ documentId: string }>
> {
  if (!(await hasSuppliersWrite())) {
    return { ok: false, error: 'Sin permiso.' };
  }
  const purchaseOrderId = String(formData.get('purchaseOrderId') ?? '');
  const docTypeRaw = String(formData.get('docType') ?? 'invoice');
  const file = formData.get('file');
  if (!purchaseOrderId || !(file instanceof File)) {
    return { ok: false, error: 'Faltan pedido o archivo.' };
  }
  if (!(SUPPLIER_PO_DOC_TYPES as readonly string[]).includes(docTypeRaw)) {
    return { ok: false, error: 'Tipo de documento no válido.' };
  }
  const docType = docTypeRaw as SupplierPurchaseDocType;
  const supabase = createClient();
  const path = `purchases/${purchaseOrderId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(SUPPLIER_DOCS_BUCKET)
    .upload(path, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (upErr) return { ok: false, error: 'No se ha podido subir el documento.' };

  const uid = await actorId();
  const { data, error } = await supabase
    .from('platform_supplier_purchase_documents')
    .insert({
      purchase_order_id: purchaseOrderId,
      doc_type: docType,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      byte_size: file.size,
      uploaded_by: uid,
    })
    .select('id')
    .single();
  if (error || !data) {
    return { ok: false, error: 'Metadatos de documento no guardados.' };
  }
  revalidateSuppliers();
  return { ok: true, documentId: String((data as { id: string }).id) };
}
