/**
 * Helpers de aislamiento del catálogo kiosko (sin I/O).
 */

export function assertCatalogItemsBelongToPharmacy(
  pharmacyId: string,
  items: ReadonlyArray<{ pharmacyId?: string }>
): boolean {
  return items.every(
    (item) => !item.pharmacyId || item.pharmacyId === pharmacyId
  );
}
