import {
  PRICE_COPY,
  formatCatalogPriceLabel,
  isPriceInformed,
  isPricePending,
} from '../catalog/price-display.ts';
import type { KioskCatalogProduct } from './catalog.ts';

/** Copy comercial aprobado (stock no bloqueante). */
export const KIOSK_CLIENT_AVAILABILITY = {
  requestable: 'Disponible para solicitar.',
  pharmacyWillConfirm: 'Tu farmacia te confirmará cuándo puedes recogerlo.',
  genericConfirm: 'Confirmar disponibilidad en farmacia',
  genericUnavailable: 'No disponible como solicitud genérica',
} as const;

export { PRICE_COPY };

/** True si el ítem es proyección genérica (sin PVP comercial inventado). */
export function isGenericCatalogProduct(
  product: Pick<KioskCatalogProduct, 'source'>
): boolean {
  return product.source === 'generic' || product.source === 'demo';
}

/**
 * Precio para UI kiosko/asistente.
 * Genéricos y precio 0/null → «Consultar precio» (nunca «0,00 €»).
 */
export function formatKioskProductPrice(
  product: Pick<KioskCatalogProduct, 'price' | 'source'>
): string {
  return formatCatalogPriceLabel(product.price, {
    generic: isGenericCatalogProduct(product),
  });
}

/** True si el producto no tiene PVP informado (propios con 0/null). */
export function kioskProductPricePending(
  product: Pick<KioskCatalogProduct, 'price' | 'source'>
): boolean {
  if (isGenericCatalogProduct(product)) return true;
  return isPricePending(product.price);
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
 * Productos propios pueden ir al carrito aunque el PVP esté pendiente.
 * Stock 0 / null no bloquea. Genéricos no.
 */
export function canAddKioskProductToCart(
  product: Pick<
    KioskCatalogProduct,
    'available' | 'price' | 'stock' | 'source' | 'availabilityStatus'
  >
): boolean {
  if (isGenericCatalogProduct(product)) return false;
  if (product.availabilityStatus === 'unavailable') return false;
  // Precio pendiente (0/null) permitido; solo rechaza negativos.
  if (product.price != null && product.price < 0) return false;
  return true;
}

export function isKioskPriceInformed(
  product: Pick<KioskCatalogProduct, 'price' | 'source'>
): boolean {
  if (isGenericCatalogProduct(product)) return false;
  return isPriceInformed(product.price);
}

/**
 * Marca apta para mostrar en kiosko. Oculta valores basura de importación
 * ("0", vacío, "null", "-", caracteres de reemplazo / mojibake típico).
 */
export function displayKioskBrand(
  brand: string | null | undefined
): string | null {
  if (brand == null) return null;
  const trimmed = String(brand).replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  if (/^(0+|null|undefined|n\/a|-+|\?+)$/i.test(trimmed)) return null;
  // U+FFFD o secuencias UTF-8 mal decodificadas (Ã©, Â, etc.).
  if (/\uFFFD|Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]/.test(trimmed)) return null;
  return trimmed;
}
