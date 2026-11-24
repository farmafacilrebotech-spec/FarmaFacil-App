import type { KioskCatalogProduct } from '@/lib/kiosk/catalog';

/** Copy comercial aprobado (stock no bloqueante). */
export const KIOSK_CLIENT_AVAILABILITY = {
  requestable: 'Disponible para solicitar.',
  pharmacyWillConfirm: 'Tu farmacia te confirmará cuándo puedes recogerlo.',
  genericConfirm: 'Confirmar disponibilidad en farmacia',
  genericUnavailable: 'No disponible como solicitud genérica',
} as const;

function formatEuroLocal(amount: number): string {
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} €`;
  }
}

/** True si el ítem es proyección genérica (sin PVP comercial inventado). */
export function isGenericCatalogProduct(
  product: Pick<KioskCatalogProduct, 'source' | 'price' | 'stock'>
): boolean {
  return product.source === 'generic' || product.source === 'demo';
}

/**
 * Precio para UI kiosko/asistente.
 * Genéricos: nunca "0,00 €".
 */
export function formatKioskProductPrice(
  product: Pick<KioskCatalogProduct, 'price' | 'source'>
): string {
  if (product.source === 'generic' || product.source === 'demo') {
    return 'Confirmar PVP en farmacia';
  }
  if (product.price == null) {
    return 'Confirmar PVP en farmacia';
  }
  return formatEuroLocal(product.price);
}

/**
 * Disponibilidad para UI comercial.
 * Nunca muestra cantidades de stock ni «Sin stock» / «Agotado».
 */
export function formatKioskProductAvailability(
  product: Pick<
    KioskCatalogProduct,
    'available' | 'stock' | 'source' | 'availabilityStatus' | 'price'
  >
): string {
  if (isGenericCatalogProduct(product)) {
    if (product.availabilityStatus === 'unavailable') {
      return KIOSK_CLIENT_AVAILABILITY.genericUnavailable;
    }
    return KIOSK_CLIENT_AVAILABILITY.genericConfirm;
  }
  if (product.availabilityStatus === 'unavailable') {
    return KIOSK_CLIENT_AVAILABILITY.genericUnavailable;
  }
  return KIOSK_CLIENT_AVAILABILITY.requestable;
}

/** Pie de apoyo (sin afirmar stock físico). */
export function formatKioskProductAvailabilityHint(
  product: Pick<KioskCatalogProduct, 'source' | 'availabilityStatus'>
): string | null {
  if (isGenericCatalogProduct(product)) return null;
  if (product.availabilityStatus === 'unavailable') return null;
  return KIOSK_CLIENT_AVAILABILITY.pharmacyWillConfirm;
}

/**
 * Productos propios con PVP pueden ir al carrito.
 * Stock 0 / null no bloquea.
 */
export function canAddKioskProductToCart(
  product: Pick<
    KioskCatalogProduct,
    'available' | 'price' | 'stock' | 'source' | 'availabilityStatus'
  >
): boolean {
  if (isGenericCatalogProduct(product)) return false;
  if (product.availabilityStatus === 'unavailable') return false;
  if (product.price == null || product.price < 0) return false;
  return true;
}
