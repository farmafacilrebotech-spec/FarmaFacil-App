export type KioskAssetStatus =
  | 'pending_identification'
  | 'warehouse'
  | 'assigned'
  | 'repair'
  | 'retired';

export const KIOSK_ASSET_STATUS_LABELS: Record<KioskAssetStatus, string> = {
  pending_identification: 'Pendiente de identificar',
  warehouse: 'En almacén',
  assigned: 'Asignado',
  repair: 'En reparación',
  retired: 'Retirado',
};

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
  status: KioskAssetStatus;
  currentPharmacyId: string | null;
  currentPharmacyName: string | null;
  pairedDeviceId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  activePolicyRef: string | null;
  /** True si falta la serie del conjunto. */
  needsIdentification: boolean;
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

export type KioskInventoryCounts = {
  total: number;
  pendingIdentification: number;
  warehouse: number;
  assigned: number;
  repair: number;
  retired: number;
  needsSerial: number;
};

export type KioskAssetDetail = KioskAssetSummary & {
  assignments: KioskAssetAssignment[];
  insuranceCoverages: KioskAssetInsurance[];
};

/** Path estable del QR (independiente de farmacia). */
export function kioskAssetStablePath(assetCode: string): string {
  return `/inventario-kioskos/codigo/${encodeURIComponent(assetCode)}`;
}
