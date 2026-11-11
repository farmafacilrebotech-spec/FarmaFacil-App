export type KioskAssetStatus =
  | 'pending_identification'
  | 'warehouse'
  | 'assigned'
  | 'exhibition'
  | 'repair'
  | 'retired';

/**
 * Estados operativos de presentación (incluye unidades previstas).
 * Orden canónico: 0 pendientes → 1 asignados → 2 exposición →
 * 3 disponibles → 4 reparación → 5 retirados.
 */
export type InventoryUiStatus =
  | 'ordered'
  | 'assigned'
  | 'exhibition'
  | 'received'
  | 'repair'
  | 'retired';

export const KIOSK_ASSET_STATUS_LABELS: Record<KioskAssetStatus, string> = {
  pending_identification: 'Disponible',
  warehouse: 'Disponible',
  assigned: 'Asignado',
  exhibition: 'En exposición',
  repair: 'En reparación',
  retired: 'Retirado',
};

export const INVENTORY_UI_STATUS_LABELS: Record<InventoryUiStatus, string> = {
  ordered: 'Pendientes de recibir',
  assigned: 'Asignados',
  exhibition: 'En exposición',
  received: 'Disponibles',
  repair: 'En reparación',
  retired: 'Retirados',
};

/** Orden obligatorio de tarjetas / filtros / listado. */
export const INVENTORY_UI_STATUS_ORDER: InventoryUiStatus[] = [
  'ordered',
  'assigned',
  'exhibition',
  'received',
  'repair',
  'retired',
];

/** Colores de estado (fondo + borde). Textos siempre visibles. */
export const INVENTORY_UI_STATUS_COLORS: Record<
  InventoryUiStatus,
  { bg: string; border: string; text: string }
> = {
  ordered: { bg: '#FFFFFF', border: '#9CA3AF', text: '#111827' },
  assigned: { bg: '#1ABBB3', border: '#0F766E', text: '#FFFFFF' },
  exhibition: { bg: '#86EFAC', border: '#16A34A', text: '#14532D' },
  received: { bg: '#FDE68A', border: '#D97706', text: '#78350F' },
  repair: { bg: '#FDBA74', border: '#EA580C', text: '#7C2D12' },
  retired: { bg: '#FCA5A5', border: '#DC2626', text: '#7F1D1D' },
};

export function assetStatusToUi(status: KioskAssetStatus): InventoryUiStatus {
  if (status === 'pending_identification' || status === 'warehouse') {
    return 'received';
  }
  return status;
}

export type KioskAssetSummary = {
  id: string;
  assetCode: string;
  /**
   * Serie USB ICOD (campo Serial del Diagnóstico USB).
   * Identifica el conjunto kiosko FarmaFácil (tablet + impresora).
   */
  equipmentSerial: string | null;
  model: string | null;
  vendor: string | null;
  receivedAt: string | null;
  purchaseOrderRef: string | null;
  /** Extensión kiosk (076) si existe. */
  purchaseOrderId: string | null;
  status: KioskAssetStatus;
  uiStatus: InventoryUiStatus;
  currentPharmacyId: string | null;
  currentPharmacyName: string | null;
  pairedDeviceId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  activePolicyRef: string | null;
  /** True si falta la serie del conjunto (indicador secundario). */
  needsIdentification: boolean;
  /** Fila virtual: unidad pedida aún no recibida (sin KSK). */
  isPendingSlot?: boolean;
  pendingSlotIndex?: number;
  remainingOnOrder?: number;
  locationLabel?: string | null;
  /** Ubicación de exposición parseada de notas, si existe. */
  exhibitionLocation?: string | null;
};

export type KioskAssetAssignment = {
  id: string;
  pharmacyId: string;
  pharmacyName: string | null;
  pharmacyDeviceId: string | null;
  startedAt: string;
  shippedAt: string | null;
  installedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  createdBy: string | null;
};

export type KioskAssetInsurance = {
  id: string;
  policyRef: string;
  insurerName: string | null;
  coverageStart: string;
  coverageEnd: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
};

export type KioskAssetStatusEvent = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  createdAt: string;
  createdBy: string | null;
};

export type KioskInventoryCounts = {
  total: number;
  /** Unidades previstas (pedido confirmado, no recibidas). */
  ordered: number;
  /** Disponibles en almacén (warehouse + pending_identification). */
  received: number;
  assigned: number;
  exhibition: number;
  repair: number;
  retired: number;
  /** Indicador secundario: activos físicos sin serie. */
  needsSerial: number;
};

export type KioskAssetDetail = KioskAssetSummary & {
  assignments: KioskAssetAssignment[];
  insuranceCoverages: KioskAssetInsurance[];
  statusEvents: KioskAssetStatusEvent[];
};

/** Path estable del QR (independiente de farmacia). */
export function kioskAssetStablePath(assetCode: string): string {
  return `/inventario-kioskos/codigo/${encodeURIComponent(assetCode)}`;
}

/**
 * Orden de listado operativo.
 * 0 pendientes · 1 asignados · 2 exposición · 3 disponibles · 4 reparación · 5 retirados.
 */
export function inventorySortRank(ui: InventoryUiStatus): number {
  const idx = INVENTORY_UI_STATUS_ORDER.indexOf(ui);
  return idx >= 0 ? idx : 90;
}

/** Extrae la última ubicación de exposición registrada en notas. */
export function parseExhibitionLocation(
  notes: string | null | undefined
): string | null {
  if (!notes) return null;
  const re = /(?:^|\n)\s*Exposición:\s*(.+?)(?:\s*\(|$)/gim;
  let last: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(notes)) !== null) {
    last = m[1]?.trim() || null;
  }
  return last;
}

/** Añade una línea a notas sin borrar el historial previo. */
export function appendAssetNote(
  previous: string | null | undefined,
  line: string
): string {
  const next = line.trim();
  const prev = (previous ?? '').trim();
  if (!next) return prev;
  if (!prev) return next;
  return `${prev}\n${next}`;
}
