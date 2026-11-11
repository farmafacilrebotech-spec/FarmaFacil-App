import { createClient } from '@/lib/supabase/server';
import { hasKioskInventoryRead } from '@/lib/kiosk-inventory/authz';
import type {
  InventoryUiStatus,
  KioskAssetAssignment,
  KioskAssetDetail,
  KioskAssetInsurance,
  KioskAssetStatus,
  KioskAssetStatusEvent,
  KioskAssetSummary,
  KioskInventoryCounts,
} from '@/lib/kiosk-inventory/types';
import {
  assetStatusToUi,
  inventorySortRank,
  parseExhibitionLocation,
} from '@/lib/kiosk-inventory/types';

function mapStatus(raw: string | null | undefined): KioskAssetStatus {
  if (
    raw === 'pending_identification' ||
    raw === 'warehouse' ||
    raw === 'assigned' ||
    raw === 'exhibition' ||
    raw === 'repair' ||
    raw === 'retired'
  ) {
    return raw;
  }
  return 'pending_identification';
}

function locationFor(
  status: KioskAssetStatus,
  pharmacyName: string | null,
  notes: string | null
): string {
  if (status === 'assigned') return pharmacyName ?? 'Farmacia';
  if (status === 'exhibition') {
    return parseExhibitionLocation(notes) ?? 'Exposición';
  }
  if (status === 'repair') return 'Reparación';
  if (status === 'retired') return 'Retirado';
  if (status === 'warehouse' || status === 'pending_identification') {
    return 'Almacén';
  }
  return '—';
}

function mapAsset(
  row: Record<string, unknown>,
  pharmacyName: string | null,
  activePolicyRef: string | null
): KioskAssetSummary {
  const equipmentSerial = (row.equipment_serial as string | null) ?? null;
  const status = mapStatus(row.status as string);
  const uiStatus = assetStatusToUi(status);
  const notes = (row.notes as string | null) ?? null;
  const exhibitionLocation =
    status === 'exhibition' ? parseExhibitionLocation(notes) : null;
  return {
    id: String(row.id),
    assetCode: String(row.asset_code),
    equipmentSerial,
    model: (row.model as string | null) ?? null,
    vendor: (row.vendor as string | null) ?? null,
    receivedAt: (row.received_at as string | null) ?? null,
    purchaseOrderRef: (row.purchase_order_ref as string | null) ?? null,
    purchaseOrderId: (row.purchase_order_id as string | null) ?? null,
    status,
    uiStatus,
    currentPharmacyId: (row.current_pharmacy_id as string | null) ?? null,
    currentPharmacyName: pharmacyName,
    pairedDeviceId: (row.paired_device_id as string | null) ?? null,
    notes,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    activePolicyRef,
    needsIdentification: !equipmentSerial,
    isPendingSlot: false,
    locationLabel: locationFor(status, pharmacyName, notes),
    exhibitionLocation,
  };
}

const ASSET_SELECT = `
  id, asset_code, equipment_serial, model, vendor, received_at,
  purchase_order_ref, purchase_order_id, status, current_pharmacy_id, paired_device_id,
  notes, created_at, updated_at,
  pharmacies:current_pharmacy_id ( name )
`;

/** Unidades previstas = quantity - received_quantity de extensiones kiosk abiertas. */
async function listPendingOrderSlots(input?: {
  vendor?: string | null;
}): Promise<KioskAssetSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('kiosk_purchase_orders')
    .select(
      `
      id, supplier_name, order_number, model, quantity, received_quantity, status,
      ordered_at, general_purchase_order_id, notes, created_at, updated_at
    `
    )
    .neq('status', 'cancelado')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[kiosk-inventory] pending orders', error.code, error.message);
    return [];
  }

  const vendorFilter = (input?.vendor ?? '').trim().toLowerCase();
  const slots: KioskAssetSummary[] = [];

  for (const raw of data ?? []) {
    const qty = Number(raw.quantity ?? 0);
    const recv = Number(raw.received_quantity ?? 0);
    const remaining = Math.max(0, qty - recv);
    if (remaining <= 0) continue;
    if (String(raw.status) === 'recibido') continue;

    const vendor = String(raw.supplier_name ?? '');
    if (vendorFilter && !vendor.toLowerCase().includes(vendorFilter)) continue;

    const orderNumber =
      raw.order_number == null ? null : String(raw.order_number);
    const model = raw.model == null ? null : String(raw.model);
    const poId = String(raw.id);
    const createdAt = String(raw.created_at ?? '');
    const updatedAt = String(raw.updated_at ?? createdAt);

    for (let i = 1; i <= remaining; i++) {
      slots.push({
        id: `pending:${poId}:${i}`,
        assetCode: '—',
        equipmentSerial: null,
        model,
        vendor: vendor || null,
        receivedAt: null,
        purchaseOrderRef: orderNumber,
        purchaseOrderId: poId,
        status: 'pending_identification',
        uiStatus: 'ordered',
        currentPharmacyId: null,
        currentPharmacyName: null,
        pairedDeviceId: null,
        notes: raw.notes == null ? null : String(raw.notes),
        createdAt,
        updatedAt,
        activePolicyRef: null,
        needsIdentification: false,
        isPendingSlot: true,
        pendingSlotIndex: i,
        remainingOnOrder: remaining,
        locationLabel: 'Pendiente de recepción',
        exhibitionLocation: null,
      });
    }
  }
  return slots;
}

export async function getKioskInventoryCounts(): Promise<KioskInventoryCounts | null> {
  if (!(await hasKioskInventoryRead())) return null;
  const supabase = createClient();
  const [{ data, error }, pending] = await Promise.all([
    supabase.from('kiosk_assets').select('status, equipment_serial'),
    listPendingOrderSlots(),
  ]);

  if (error) {
    console.error('[kiosk-inventory] counts', error.code, error.message);
    return null;
  }

  const counts: KioskInventoryCounts = {
    total: 0,
    ordered: pending.length,
    received: 0,
    assigned: 0,
    exhibition: 0,
    repair: 0,
    retired: 0,
    needsSerial: 0,
  };
  for (const row of data ?? []) {
    counts.total += 1;
    const s = mapStatus((row as { status?: string }).status);
    const ui = assetStatusToUi(s);
    if (ui === 'received') counts.received += 1;
    else if (ui === 'assigned') counts.assigned += 1;
    else if (ui === 'exhibition') counts.exhibition += 1;
    else if (ui === 'repair') counts.repair += 1;
    else if (ui === 'retired') counts.retired += 1;
    if (!(row as { equipment_serial?: string | null }).equipment_serial) {
      counts.needsSerial += 1;
    }
  }
  counts.total += counts.ordered;
  return counts;
}

export async function listKioskAssets(input?: {
  query?: string;
  status?: KioskAssetStatus | InventoryUiStatus | 'all' | 'needs_serial' | 'ordered' | 'received';
  pharmacyId?: string | null;
  vendor?: string | null;
}): Promise<KioskAssetSummary[]> {
  if (!(await hasKioskInventoryRead())) return [];

  const supabase = createClient();
  const filter = input?.status ?? 'all';
  const includePending =
    filter === 'all' || filter === 'ordered';
  const includeAssets =
    filter !== 'ordered';

  let assets: KioskAssetSummary[] = [];
  if (includeAssets) {
    let q = supabase
      .from('kiosk_assets')
      .select(ASSET_SELECT)
      .order('asset_code', { ascending: true });

    if (filter === 'needs_serial') {
      q = q.is('equipment_serial', null);
    } else if (filter === 'received') {
      q = q.in('status', ['warehouse', 'pending_identification']);
    } else if (
      filter === 'assigned' ||
      filter === 'exhibition' ||
      filter === 'repair' ||
      filter === 'retired' ||
      filter === 'warehouse' ||
      filter === 'pending_identification'
    ) {
      q = q.eq('status', filter);
    }
    if (input?.pharmacyId) {
      q = q.eq('current_pharmacy_id', input.pharmacyId);
    }
    const vendorFilter = (input?.vendor ?? '').trim();
    if (vendorFilter) {
      q = q.ilike('vendor', `%${vendorFilter}%`);
    }

    const { data, error } = await q;
    if (error) {
      console.error('[kiosk-inventory] list', error.code, error.message);
    } else {
      const rows = (data ?? []) as Record<string, unknown>[];
      const assetIds = rows.map((r) => String(r.id));
      const policyByAsset = new Map<string, string>();
      if (assetIds.length > 0) {
        const { data: policies } = await supabase
          .from('kiosk_asset_insurance_coverages')
          .select('asset_id, policy_ref')
          .in('asset_id', assetIds)
          .is('coverage_end', null);
        for (const p of policies ?? []) {
          policyByAsset.set(String(p.asset_id), String(p.policy_ref));
        }
      }
      assets = rows.map((row) => {
        const pharmacy = row.pharmacies as
          | { name?: string }
          | { name?: string }[]
          | null;
        const name = Array.isArray(pharmacy)
          ? pharmacy[0]?.name ?? null
          : pharmacy?.name ?? null;
        return mapAsset(row, name, policyByAsset.get(String(row.id)) ?? null);
      });
    }
  }

  let pending: KioskAssetSummary[] = [];
  if (includePending) {
    pending = await listPendingOrderSlots({ vendor: input?.vendor });
  }

  let mapped = [...pending, ...assets];

  const query = (input?.query ?? '').trim().toLowerCase();
  if (query) {
    mapped = mapped.filter((a) => {
      const hay = [
        a.assetCode,
        a.equipmentSerial,
        a.model,
        a.vendor,
        a.purchaseOrderRef,
        a.currentPharmacyName,
        a.activePolicyRef,
        a.locationLabel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(query);
    });
  }

  mapped.sort((a, b) => {
    const ra = inventorySortRank(a.uiStatus);
    const rb = inventorySortRank(b.uiStatus);
    if (ra !== rb) return ra - rb;
    // Dentro de cada estado: más reciente primero.
    const ta = Date.parse(a.updatedAt || a.receivedAt || a.createdAt || '') || 0;
    const tb = Date.parse(b.updatedAt || b.receivedAt || b.createdAt || '') || 0;
    if (ta !== tb) return tb - ta;
    if (a.isPendingSlot && b.isPendingSlot) {
      return (a.purchaseOrderRef ?? '').localeCompare(b.purchaseOrderRef ?? '');
    }
    return a.assetCode.localeCompare(b.assetCode);
  });

  return mapped;
}

export async function getKioskAssetDetail(
  assetId: string
): Promise<KioskAssetDetail | null> {
  if (!(await hasKioskInventoryRead())) return null;
  if (assetId.startsWith('pending:')) return null;
  const supabase = createClient();

  const { data, error } = await supabase
    .from('kiosk_assets')
    .select(ASSET_SELECT)
    .eq('id', assetId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('[kiosk-inventory] detail', error.code, error.message);
    return null;
  }

  return hydrateDetail(data as Record<string, unknown>);
}

export async function getKioskAssetDetailByCode(
  assetCode: string
): Promise<KioskAssetDetail | null> {
  if (!(await hasKioskInventoryRead())) return null;
  const code = assetCode.trim().toUpperCase();
  if (!/^KSK-[0-9]{4,}$/.test(code)) return null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('kiosk_assets')
    .select(ASSET_SELECT)
    .eq('asset_code', code)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('[kiosk-inventory] by code', error.code, error.message);
    return null;
  }
  return hydrateDetail(data as Record<string, unknown>);
}

async function hydrateDetail(
  data: Record<string, unknown>
): Promise<KioskAssetDetail> {
  const supabase = createClient();
  const assetId = String(data.id);

  const pharmacy = data.pharmacies as
    | { name?: string }
    | { name?: string }[]
    | null
    | undefined;
  const pharmacyName = Array.isArray(pharmacy)
    ? pharmacy[0]?.name ?? null
    : pharmacy?.name ?? null;

  const [{ data: assignments }, { data: coverages }, { data: events }] =
    await Promise.all([
      supabase
        .from('kiosk_asset_assignments')
        .select(
          `
        id, pharmacy_id, pharmacy_device_id, started_at, shipped_at, installed_at,
        ended_at, end_reason, created_by,
        pharmacies:pharmacy_id ( name )
      `
        )
        .eq('asset_id', assetId)
        .order('started_at', { ascending: false }),
      supabase
        .from('kiosk_asset_insurance_coverages')
        .select(
          'id, policy_ref, insurer_name, coverage_start, coverage_end, notes, created_at, created_by'
        )
        .eq('asset_id', assetId)
        .order('coverage_start', { ascending: false }),
      supabase
        .from('kiosk_asset_status_events')
        .select('id, from_status, to_status, reason, created_at, created_by')
        .eq('asset_id', assetId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

  const assignmentRows: KioskAssetAssignment[] = (assignments ?? []).map((a) => {
    const ph = a.pharmacies as { name?: string } | { name?: string }[] | null;
    const name = Array.isArray(ph) ? ph[0]?.name ?? null : ph?.name ?? null;
    return {
      id: a.id as string,
      pharmacyId: a.pharmacy_id as string,
      pharmacyName: name,
      pharmacyDeviceId: (a.pharmacy_device_id as string | null) ?? null,
      startedAt: a.started_at as string,
      shippedAt: (a.shipped_at as string | null) ?? null,
      installedAt: (a.installed_at as string | null) ?? null,
      endedAt: (a.ended_at as string | null) ?? null,
      endReason: (a.end_reason as string | null) ?? null,
      createdBy: (a.created_by as string | null) ?? null,
    };
  });

  const insuranceRows: KioskAssetInsurance[] = (coverages ?? []).map((c) => ({
    id: c.id as string,
    policyRef: c.policy_ref as string,
    insurerName: (c.insurer_name as string | null) ?? null,
    coverageStart: c.coverage_start as string,
    coverageEnd: (c.coverage_end as string | null) ?? null,
    notes: (c.notes as string | null) ?? null,
    createdAt: c.created_at as string,
    createdBy: (c.created_by as string | null) ?? null,
  }));

  const statusEvents: KioskAssetStatusEvent[] = (events ?? []).map((e) => ({
    id: String(e.id),
    fromStatus: e.from_status == null ? null : String(e.from_status),
    toStatus: String(e.to_status),
    reason: e.reason == null ? null : String(e.reason),
    createdAt: String(e.created_at),
    createdBy: e.created_by == null ? null : String(e.created_by),
  }));

  const activePolicy =
    insuranceRows.find((c) => !c.coverageEnd)?.policyRef ?? null;

  return {
    ...mapAsset(data, pharmacyName, activePolicy),
    assignments: assignmentRows,
    insuranceCoverages: insuranceRows,
    statusEvents,
  };
}
