export type KioskAssetStatus =
  | 'pending_identification'
  | 'warehouse'
  | 'assigned'
  | 'exhibition'
  | 'repair'
  | 'retired';

/** Estados de presentación en inventario (incluye unidades previstas PEDIDO). */
export type InventoryUiStatus =
  | 'ordered'
  | 'received'
  | 'assigned'
  | 'exhibition'
  | 'repair'
  | 'retired';

export const KIOSK_ASSET_STATUS_LABELS: Record<KioskAssetStatus, string> = {
  pending_identification: 'Recibido',
  warehouse: 'Recibido',
  assigned: 'Asignado',
  exhibition: 'Exposición',
  repair: 'Reparación',
  retired: 'Retirado',
};

export const INVENTORY_UI_STATUS_LABELS: Record<InventoryUiStatus, string> = {
  ordered: 'Pedido',
  received: 'Recibido',
  assigned: 'Asignado',
  exhibition: 'Exposición',
  repair: 'Reparación',
  retired: 'Retirado',
};

/** Colores de estado (fondo + borde). Textos siempre visibles. */
export const INVENTORY_UI_STATUS_COLORS: Record<
  InventoryUiStatus,
  { bg: string; border: string; text: string }
> = {
  ordered: { bg: '#FFFFFF', border: '#9CA3AF', text: '#111827' },
  received: { bg: '#FDE68A', border: '#D97706', text: '#78350F' },
  assigned: { bg: '#1ABBB3', border: '#0F766E', text: '#FFFFFF' },
  exhibition: { bg: '#86EFAC', border: '#16A34A', text: '#14532D' },
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
  /** True si falta la serie del conjunto. */
  needsIdentification: boolean;
  /** Fila virtual: unidad pedida aún no recibida (sin KSK). */
  isPendingSlot?: boolean;
  pendingSlotIndex?: number;
  remainingOnOrder?: number;
  locationLabel?: string | null;
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
  /** Recibidos disponibles (warehouse + pending_identification). */
  received: number;
  assigned: number;
  exhibition: number;
  repair: number;
  retired: number;
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

/** Orden de listado: retirados siempre al final. */
export function inventorySortRank(ui: InventoryUiStatus): number {
  if (ui === 'retired') return 100;
  if (ui === 'ordered') return 10;
  if (ui === 'received') return 20;
  if (ui === 'exhibition') return 30;
  if (ui === 'repair') return 40;
  if (ui === 'assigned') return 50;
  return 60;
}
