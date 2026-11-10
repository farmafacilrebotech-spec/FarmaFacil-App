import { createClient } from '@/lib/supabase/server';
import {
  hasSuppliersRead,
} from '@/lib/kiosk-inventory/authz';
import {
  isSupplierCategory,
  type MaterialOfferCompareRow,
  type SupplierActivityRow,
  type SupplierCategory,
  type SupplierContactRow,
  type SupplierPurchaseDocType,
  type SupplierPurchaseDocumentRow,
  type SupplierPurchaseOrderRow,
  type SupplierPurchaseStatus,
  type SupplierQuoteDocumentRow,
  type SupplierQuoteLineRow,
  type SupplierQuoteRow,
  type SupplierQuoteStatus,
  type SupplierRow,
  type SupplierStatus,
} from '@/lib/suppliers/types';

function mapCategory(raw: unknown): SupplierCategory {
  const v = raw == null ? '' : String(raw);
  return isSupplierCategory(v) ? v : 'otros';
}

function mapSupplier(r: Record<string, unknown>): SupplierRow {
  return {
    id: String(r.id),
    legalName: String(r.legal_name ?? ''),
    tradeName: r.trade_name == null ? null : String(r.trade_name),
    taxId: r.tax_id == null ? null : String(r.tax_id),
    category: mapCategory(r.category),
    email: r.email == null ? null : String(r.email),
    phone: r.phone == null ? null : String(r.phone),
    website: r.website == null ? null : String(r.website),
    paymentTerms: r.payment_terms == null ? null : String(r.payment_terms),
    notes: r.notes == null ? null : String(r.notes),
    status: String(r.status ?? 'active') as SupplierStatus,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  };
}

export async function listSuppliers(opts?: {
  q?: string;
  status?: SupplierStatus | 'all';
  category?: string;
}): Promise<{ ok: true; suppliers: SupplierRow[] } | { ok: false; error: string }> {
  if (!(await hasSuppliersRead())) {
    return { ok: false, error: 'Sin permiso para consultar proveedores.' };
  }
  const supabase = createClient();
  let query = supabase
    .from('platform_suppliers')
    .select(
      'id, legal_name, trade_name, tax_id, category, email, phone, website, payment_terms, notes, status, created_at, updated_at'
    )
    .order('legal_name', { ascending: true })
    .limit(200);

  const status = opts?.status ?? 'active';
  if (status !== 'all') {
    query = query.eq('status', status);
  }
  if (opts?.category?.trim()) {
    query = query.ilike('category', opts.category.trim());
  }
  const q = opts?.q?.trim();
  if (q) {
    query = query.or(
      `legal_name.ilike.%${q}%,trade_name.ilike.%${q}%,tax_id.ilike.%${q}%,email.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error('[suppliers] list', error.code, error.message);
    if (
      error.code === '42P01' ||
      error.message.toLowerCase().includes('does not exist')
    ) {
      return {
        ok: false,
        error: 'Falta aplicar la migración 076 (proveedores y compras).',
      };
    }
    return { ok: false, error: 'No se han podido cargar los proveedores.' };
  }
  return {
    ok: true,
    suppliers: ((data as Record<string, unknown>[] | null) ?? []).map(mapSupplier),
  };
}

export async function listSupplierContacts(
  supplierId: string
): Promise<{ ok: true; contacts: SupplierContactRow[] } | { ok: false; error: string }> {
  if (!(await hasSuppliersRead())) return { ok: false, error: 'Sin permiso.' };
  const supabase = createClient();
  const { data, error } = await supabase
    .from('platform_supplier_contacts')
    .select('id, supplier_id, full_name, role_title, email, phone, is_primary')
    .eq('supplier_id', supplierId)
    .order('is_primary', { ascending: false });
  if (error) return { ok: false, error: 'No se han podido cargar contactos.' };
  return {
    ok: true,
    contacts: ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
      id: String(r.id),
      supplierId: String(r.supplier_id),
      fullName: String(r.full_name ?? ''),
      roleTitle: r.role_title == null ? null : String(r.role_title),
      email: r.email == null ? null : String(r.email),
      phone: r.phone == null ? null : String(r.phone),
      isPrimary: Boolean(r.is_primary),
    })),
  };
}

export async function listSupplierActivity(
  supplierId: string,
  limit = 40
): Promise<{ ok: true; rows: SupplierActivityRow[] } | { ok: false; error: string }> {
  if (!(await hasSuppliersRead())) return { ok: false, error: 'Sin permiso.' };
  const supabase = createClient();
  const { data, error } = await supabase
    .from('platform_supplier_activity')
    .select('id, supplier_id, action, summary, created_at')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { ok: false, error: 'No se ha podido cargar el historial.' };
  return {
    ok: true,
    rows: ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
      id: String(r.id),
      supplierId: String(r.supplier_id),
      action: String(r.action ?? ''),
      summary: String(r.summary ?? ''),
      createdAt: String(r.created_at ?? ''),
    })),
  };
}

export async function listSupplierQuotes(opts?: {
  supplierId?: string;
  status?: SupplierQuoteStatus | 'all';
}): Promise<{ ok: true; quotes: SupplierQuoteRow[] } | { ok: false; error: string }> {
  if (!(await hasSuppliersRead())) {
    return { ok: false, error: 'Sin permiso para consultar presupuestos.' };
  }
  const supabase = createClient();
  let query = supabase
    .from('platform_supplier_quotes')
    .select(
      `
      id, supplier_id, quote_number, title, status, received_at, valid_until,
      currency, shipping_cents, notes, created_at,
      platform_suppliers ( legal_name )
    `
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (opts?.supplierId) query = query.eq('supplier_id', opts.supplierId);
  if (opts?.status && opts.status !== 'all') query = query.eq('status', opts.status);

  const { data, error } = await query;
  if (error) {
    console.error('[suppliers] quotes', error.code, error.message);
    return { ok: false, error: 'No se han podido cargar los presupuestos.' };
  }

  return {
    ok: true,
    quotes: ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
      const s = r.platform_suppliers as { legal_name?: string } | null;
      return {
        id: String(r.id),
        supplierId: String(r.supplier_id),
        supplierName: s?.legal_name ?? null,
        quoteNumber: r.quote_number == null ? null : String(r.quote_number),
        title: String(r.title ?? ''),
        status: String(r.status ?? 'recibido') as SupplierQuoteStatus,
        receivedAt: r.received_at == null ? null : String(r.received_at),
        validUntil: r.valid_until == null ? null : String(r.valid_until),
        currency: String(r.currency ?? 'EUR'),
        shippingCents:
          r.shipping_cents == null ? null : Number(r.shipping_cents),
        notes: r.notes == null ? null : String(r.notes),
        createdAt: String(r.created_at ?? ''),
      };
    }),
  };
}

export async function listQuoteLines(
  quoteId: string
): Promise<{ ok: true; lines: SupplierQuoteLineRow[] } | { ok: false; error: string }> {
  if (!(await hasSuppliersRead())) return { ok: false, error: 'Sin permiso.' };
  const supabase = createClient();
  const { data, error } = await supabase
    .from('platform_supplier_quote_lines')
    .select(
      'id, quote_id, material_key, description, quantity, unit, unit_price_cents, vat_bps, lead_days'
    )
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true });
  if (error) return { ok: false, error: 'No se han podido cargar líneas.' };
  return {
    ok: true,
    lines: ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
      id: String(r.id),
      quoteId: String(r.quote_id),
      materialKey: String(r.material_key ?? ''),
      description: String(r.description ?? ''),
      quantity: Number(r.quantity ?? 1),
      unit: r.unit == null ? null : String(r.unit),
      unitPriceCents: Number(r.unit_price_cents ?? 0),
      vatBps: Number(r.vat_bps ?? 2100),
      leadDays: r.lead_days == null ? null : Number(r.lead_days),
    })),
  };
}

/** Comparar ofertas de varios proveedores para el mismo material_key. */
export async function compareMaterialOffers(
  materialKey: string
): Promise<
  | { ok: true; offers: MaterialOfferCompareRow[] }
  | { ok: false; error: string }
> {
  if (!(await hasSuppliersRead())) return { ok: false, error: 'Sin permiso.' };
  const key = materialKey.trim().toLowerCase();
  if (!key) return { ok: false, error: 'Indica un material.' };

  const supabase = createClient();
  const { data, error } = await supabase
    .from('platform_supplier_quote_lines')
    .select(
      `
      material_key, description, quantity, unit_price_cents, lead_days, quote_id,
      platform_supplier_quotes (
        id, title, status, supplier_id,
        platform_suppliers ( id, legal_name )
      )
    `
    )
    .ilike('material_key', key)
    .limit(100);

  if (error) {
    return { ok: false, error: 'No se ha podido comparar ofertas.' };
  }

  const offers: MaterialOfferCompareRow[] = [];
  for (const r of (data as Record<string, unknown>[] | null) ?? []) {
    const q = r.platform_supplier_quotes as Record<string, unknown> | null;
    if (!q) continue;
    const s = q.platform_suppliers as { id?: string; legal_name?: string } | null;
    offers.push({
      materialKey: String(r.material_key ?? ''),
      description: String(r.description ?? ''),
      supplierId: String(s?.id ?? q.supplier_id ?? ''),
      supplierName: String(s?.legal_name ?? '—'),
      quoteId: String(q.id ?? r.quote_id ?? ''),
      quoteTitle: String(q.title ?? ''),
      unitPriceCents: Number(r.unit_price_cents ?? 0),
      quantity: Number(r.quantity ?? 1),
      leadDays: r.lead_days == null ? null : Number(r.lead_days),
      quoteStatus: String(q.status ?? 'recibido') as SupplierQuoteStatus,
    });
  }
  offers.sort((a, b) => a.unitPriceCents - b.unitPriceCents);
  return { ok: true, offers };
}

export async function listQuoteDocuments(
  quoteId: string
): Promise<
  | { ok: true; documents: SupplierQuoteDocumentRow[] }
  | { ok: false; error: string }
> {
  if (!(await hasSuppliersRead())) return { ok: false, error: 'Sin permiso.' };
  const supabase = createClient();
  const { data, error } = await supabase
    .from('platform_supplier_quote_documents')
    .select('id, quote_id, storage_path, file_name, mime_type, byte_size, created_at')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: 'No se han podido cargar adjuntos.' };
  return {
    ok: true,
    documents: ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
      id: String(r.id),
      quoteId: String(r.quote_id),
      fileName: String(r.file_name ?? ''),
      mimeType: r.mime_type == null ? null : String(r.mime_type),
      byteSize: r.byte_size == null ? null : Number(r.byte_size),
      storagePath: String(r.storage_path ?? ''),
      createdAt: String(r.created_at ?? ''),
    })),
  };
}

export async function listSupplierPurchaseOrders(opts?: {
  supplierId?: string;
  category?: SupplierCategory | 'all';
}): Promise<
  | { ok: true; orders: SupplierPurchaseOrderRow[] }
  | { ok: false; error: string }
> {
  if (!(await hasSuppliersRead())) {
    return { ok: false, error: 'Sin permiso para consultar pedidos.' };
  }
  const supabase = createClient();
  let query = supabase
    .from('platform_supplier_purchase_orders')
    .select(
      `
      id, supplier_id, quote_id, category, title, order_number, status,
      ordered_at, expected_delivery_at, actual_delivery_at, currency,
      subtotal_cents, tax_cents, shipping_cents, total_cents, notes, created_at,
      platform_suppliers ( legal_name )
    `
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (opts?.supplierId) query = query.eq('supplier_id', opts.supplierId);
  if (opts?.category && opts.category !== 'all') {
    query = query.eq('category', opts.category);
  }
  const { data, error } = await query;
  if (error) {
    console.error('[suppliers] purchases', error.code, error.message);
    if (
      error.code === '42P01' ||
      error.message.toLowerCase().includes('does not exist')
    ) {
      return {
        ok: false,
        error: 'Falta aplicar la migración 076 (pedidos generales).',
      };
    }
    return { ok: false, error: 'No se han podido cargar los pedidos.' };
  }
  return {
    ok: true,
    orders: ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
      const s = r.platform_suppliers as { legal_name?: string } | null;
      return {
        id: String(r.id),
        supplierId: String(r.supplier_id),
        supplierName: s?.legal_name ?? null,
        quoteId: r.quote_id == null ? null : String(r.quote_id),
        category: mapCategory(r.category),
        title: String(r.title ?? ''),
        orderNumber: r.order_number == null ? null : String(r.order_number),
        status: String(r.status ?? 'borrador') as SupplierPurchaseStatus,
        orderedAt: r.ordered_at == null ? null : String(r.ordered_at),
        expectedDeliveryAt:
          r.expected_delivery_at == null
            ? null
            : String(r.expected_delivery_at),
        actualDeliveryAt:
          r.actual_delivery_at == null ? null : String(r.actual_delivery_at),
        currency: String(r.currency ?? 'EUR'),
        subtotalCents:
          r.subtotal_cents == null ? null : Number(r.subtotal_cents),
        taxCents: r.tax_cents == null ? null : Number(r.tax_cents),
        shippingCents:
          r.shipping_cents == null ? null : Number(r.shipping_cents),
        totalCents: r.total_cents == null ? null : Number(r.total_cents),
        notes: r.notes == null ? null : String(r.notes),
        createdAt: String(r.created_at ?? ''),
      };
    }),
  };
}

export async function listPurchaseDocuments(
  purchaseOrderId: string
): Promise<
  | { ok: true; documents: SupplierPurchaseDocumentRow[] }
  | { ok: false; error: string }
> {
  if (!(await hasSuppliersRead())) return { ok: false, error: 'Sin permiso.' };
  const supabase = createClient();
  const { data, error } = await supabase
    .from('platform_supplier_purchase_documents')
    .select(
      'id, purchase_order_id, doc_type, storage_path, file_name, mime_type, byte_size, created_at'
    )
    .eq('purchase_order_id', purchaseOrderId)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: 'No se han podido cargar documentos.' };
  return {
    ok: true,
    documents: ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
      id: String(r.id),
      purchaseOrderId: String(r.purchase_order_id),
      docType: String(r.doc_type ?? 'other') as SupplierPurchaseDocType,
      fileName: String(r.file_name ?? ''),
      mimeType: r.mime_type == null ? null : String(r.mime_type),
      byteSize: r.byte_size == null ? null : Number(r.byte_size),
      storagePath: String(r.storage_path ?? ''),
      createdAt: String(r.created_at ?? ''),
    })),
  };
}
