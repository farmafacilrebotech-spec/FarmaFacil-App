/**
 * Validación de carrito para crear pedidos (espejo reglas SQL 040).
 * Precios y farmacia del producto vienen del servidor; el cliente no autoriza.
 */

import type {
  CartLineInput,
  CreateOrderErrorCode,
  ResolvedCartLine,
} from '@/lib/orders/types';

export type CatalogProductForOrder = {
  id: string;
  pharmacyId: string;
  name: string;
  price: number;
  isActive: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CartValidationOk = {
  ok: true;
  lines: ResolvedCartLine[];
  totalAmount: number;
};

export type CartValidationError = {
  ok: false;
  code: CreateOrderErrorCode;
  message: string;
  productId?: string;
};

/**
 * Resuelve el carrito contra el catálogo de la farmacia de la sesión.
 * - Ignora pharmacy_id enviado por el cliente.
 * - Usa siempre el precio de catálogo.
 * - Si clientUnitPrice difiere del de catálogo → price_mismatch.
 */
export function resolveCartForPharmacy(input: {
  sessionPharmacyId: string;
  lines: readonly CartLineInput[];
  productsById: ReadonlyMap<string, CatalogProductForOrder>;
}): CartValidationOk | CartValidationError {
  const pharmacyId = input.sessionPharmacyId?.trim() ?? '';
  if (!pharmacyId || !UUID_RE.test(pharmacyId)) {
    return {
      ok: false,
      code: 'invalid_request',
      message: 'Farmacia de sesión no válida.',
    };
  }

  if (!input.lines || input.lines.length === 0) {
    return {
      ok: false,
      code: 'empty_cart',
      message: 'El carrito está vacío.',
    };
  }

  if (input.lines.length > 50) {
    return {
      ok: false,
      code: 'invalid_cart',
      message: 'El carrito tiene demasiadas líneas.',
    };
  }

  const seen = new Set<string>();
  const resolved: ResolvedCartLine[] = [];
  let total = 0;

  for (const line of input.lines) {
    const productId = line.productId?.trim() ?? '';
    if (!productId || !UUID_RE.test(productId)) {
      return {
        ok: false,
        code: 'invalid_product',
        message: 'Producto no válido en el carrito.',
      };
    }

    if (seen.has(productId)) {
      return {
        ok: false,
        code: 'duplicate_product_in_cart',
        message: 'Hay productos duplicados en el carrito.',
        productId,
      };
    }
    seen.add(productId);

    const qty = line.quantity;
    if (
      typeof qty !== 'number' ||
      !Number.isInteger(qty) ||
      qty < 1 ||
      qty > 99
    ) {
      return {
        ok: false,
        code: 'invalid_quantity',
        message: 'La cantidad debe ser un entero entre 1 y 99.',
        productId,
      };
    }

    const product = input.productsById.get(productId);
    if (!product) {
      return {
        ok: false,
        code: 'product_not_found',
        message: 'Producto no encontrado.',
        productId,
      };
    }

    if (product.pharmacyId !== pharmacyId) {
      return {
        ok: false,
        code: 'product_wrong_pharmacy',
        message: 'El producto no pertenece a esta farmacia.',
        productId,
      };
    }

    if (!product.isActive) {
      return {
        ok: false,
        code: 'product_inactive',
        message: 'El producto no está disponible.',
        productId,
      };
    }

    if (
      line.clientUnitPrice != null &&
      Number.isFinite(line.clientUnitPrice) &&
      roundMoney(line.clientUnitPrice) !== roundMoney(product.price)
    ) {
      return {
        ok: false,
        code: 'price_mismatch',
        message: 'El precio del producto no coincide con el catálogo.',
        productId,
      };
    }

    const unitPrice = roundMoney(product.price);
    const lineTotal = roundMoney(unitPrice * qty);
    total = roundMoney(total + lineTotal);

    resolved.push({
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unitPrice,
      lineTotal,
    });
  }

  if (total <= 0) {
    return {
      ok: false,
      code: 'invalid_cart',
      message: 'El importe total no es válido.',
    };
  }

  return { ok: true, lines: resolved, totalAmount: total };
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Mensajes homogéneos hacia el cliente del kiosko. */
export function createOrderErrorMessage(code: CreateOrderErrorCode): string {
  switch (code) {
    case 'session_missing':
    case 'session_invalid':
      return 'La tablet no tiene una sesión de kiosko válida.';
    case 'session_revoked':
      return 'Este dispositivo ha sido revocado. Solicita un código nuevo.';
    case 'commercially_blocked':
      return 'El servicio de kiosko no está disponible en este momento.';
    case 'empty_cart':
      return 'Añade al menos un producto al carrito.';
    case 'invalid_quantity':
      return 'Revisa las cantidades del carrito.';
    case 'product_inactive':
    case 'product_not_found':
      return 'Algunos productos ya no están disponibles. Actualiza el carrito.';
    case 'product_wrong_pharmacy':
      return 'Hay productos que no pertenecen a esta farmacia.';
    case 'price_mismatch':
      return 'Los precios han cambiado. Vuelve a revisar el carrito.';
    case 'duplicate_product_in_cart':
    case 'invalid_cart':
    case 'invalid_product':
      return 'El carrito no es válido.';
    case 'invalid_request':
      return 'No se ha podido crear el pedido.';
    case 'unavailable':
    default:
      return 'No se ha podido crear el pedido. Inténtalo de nuevo.';
  }
}
