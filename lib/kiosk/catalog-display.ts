import type { KioskCatalogProduct } from '@/lib/kiosk/catalog';

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

/** True si el ítem es proyección genérica (sin PVP/stock comerciales). */
export function isGenericCatalogProduct(
  product: Pick<KioskCatalogProduct, 'source' | 'price' | 'stock'>
): boolean {
  if (product.source === 'generic' || product.source === 'demo') return true;
  // Defensa: price/stock null también implica no inventar 0 €.
  return product.price == null || product.stock == null;
}

/**
 * Precio para UI kiosko/asistente.
 * Genéricos: nunca "0,00 €".
 */
export function formatKioskProductPrice(
  product: Pick<KioskCatalogProduct, 'price' | 'source'>
): string {
  if (product.price == null || product.source === 'generic') {
    return 'Confirmar PVP en farmacia';
  }
  return formatEuroLocal(product.price);
}

/**
 * Disponibilidad para UI.
 * Genéricos: stock=0/null no significa «sin stock» comercial.
 */
export function formatKioskProductAvailability(
  product: Pick<
    KioskCatalogProduct,
    'available' | 'stock' | 'source' | 'availabilityStatus' | 'price'
  >
): string {
  if (isGenericCatalogProduct(product)) {
    if (
      product.availabilityStatus === 'confirm_with_pharmacy' ||
      product.availabilityStatus == null
    ) {
      return 'Confirmar disponibilidad en farmacia';
    }
    if (product.availabilityStatus === 'unavailable') {
      return 'No disponible como solicitud genérica';
    }
    return 'Tipo genérico · sin stock inventado';
  }
  if (product.available && product.stock != null) {
    return `Disponible · ${product.stock}`;
  }
  return 'Sin stock';
}

/** Solo productos propios con PVP y stock confirmados pueden ir al carrito. */
export function canAddKioskProductToCart(
  product: Pick<KioskCatalogProduct, 'available' | 'price' | 'stock' | 'source'>
): boolean {
  if (isGenericCatalogProduct(product)) return false;
  if (!product.available) return false;
  if (product.price == null || product.price < 0) return false;
  if (product.stock == null || product.stock <= 0) return false;
  return true;
}
