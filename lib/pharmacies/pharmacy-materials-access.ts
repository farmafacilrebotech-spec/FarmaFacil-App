/**
 * Material publicitario de farmacia (carteles PDF personalizados, vista previa,
 * impresión y pack de bienvenida): reservado a PLATFORM_SUPERADMIN.
 *
 * Owner / Admin de farmacia conservan solo la descarga individual del QR (PNG/SVG).
 *
 * Puertas:
 * 1) Ficha SuperAdmin calcula `canGenerateMaterials` con `hasPlatformSuperAdminRole`.
 * 2) Antes de generar PDF, la UI debe llamar
 *    `assertPharmacyMaterialsAccessAction` (server). El panel tenant nunca activa
 *    `canGenerateMaterials`.
 *
 * Nota: el PDF del pack sigue generándose con jsPDF en cliente (assets DOM);
 * la acción servidor refuerza ACL. Migración a Server Action de bytes: pendiente.
 */

export const PHARMACY_TENANT_MATERIALS_CONTACT_MESSAGE =
  'Si necesitas más material publicitario personalizado para tu farmacia, contacta con FarmaFácil';

export const PHARMACY_MATERIALS_SUPERADMIN_ONLY_MESSAGE =
  'La generación de carteles y del pack de bienvenida está reservada al equipo de FarmaFácil.';

/** Predicado puro: solo SuperAdmin total puede generar material publicitario. */
export function canGeneratePharmacyMaterials(isPlatformSuperAdmin: boolean): boolean {
  return isPlatformSuperAdmin === true;
}
