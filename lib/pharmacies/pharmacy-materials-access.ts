/**
 * Material publicitario de farmacia (carteles PDF personalizados, vista previa,
 * impresión y pack de bienvenida): reservado a PLATFORM_SUPERADMIN.
 *
 * Owner / Admin de farmacia conservan solo la descarga individual del QR (PNG/SVG).
 *
 * Nota: los PDF se generan en el navegador (jsPDF); no existen Server Actions ni
 * endpoints de pack/carteles. La puerta efectiva es que solo la ficha SuperAdmin
 * (`app/(app)/farmacias/[id]`) calcula `canGenerateMaterials` en servidor con
 * `hasPlatformSuperAdminRole`; el panel tenant (`/f/[pharmacyId]/qr`) nunca lo activa.
 */

export const PHARMACY_TENANT_MATERIALS_CONTACT_MESSAGE =
  'Si necesitas más material publicitario personalizado para tu farmacia, contacta con FarmaFácil';

export const PHARMACY_MATERIALS_SUPERADMIN_ONLY_MESSAGE =
  'La generación de carteles y del pack de bienvenida está reservada al equipo de FarmaFácil.';

/** Predicado puro: solo SuperAdmin total puede generar material publicitario. */
export function canGeneratePharmacyMaterials(isPlatformSuperAdmin: boolean): boolean {
  return isPlatformSuperAdmin === true;
}
