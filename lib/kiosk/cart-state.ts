/**
 * Estado puro del carrito kiosko (testeable sin React).
 * Precios mostrados son informativos; el servidor recalcula al crear el pedido.
 */

export const KIOSK_CART_STORAGE_KEY = 'ff_kiosk_cart_v1';
/** Inactividad de compra (ms). No afecta la cookie de dispositivo. */
export const KIOSK_CART_IDLE_MS = 3 * 60 * 1000;

export type KioskCartLine = {
  productId: string;
  name: string;
  brand: string | null;
  /** Precio de catálogo al añadir (UI). El RPC ignora este valor. */
  unitPrice: number;
  quantity: number;
  stock: number;
};

export type KioskCartState = {
  pharmacyId: string | null;
  lines: KioskCartLine[];
  updatedAt: number;
};

export function emptyKioskCart(pharmacyId: string | null = null): KioskCartState {
  return { pharmacyId, lines: [], updatedAt: Date.now() };
}

export function cartLineCount(state: KioskCartState): number {
  return state.lines.reduce((n, l) => n + l.quantity, 0);
}

export function cartDisplayTotal(state: KioskCartState): number {
  return round2(
    state.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isCartIdle(
  state: KioskCartState,
  nowMs: number,
  idleMs: number = KIOSK_CART_IDLE_MS
): boolean {
  if (state.lines.length === 0) return false;
  return nowMs - state.updatedAt >= idleMs;
}

/**
 * Si el carrito pertenece a otra farmacia (re-pair), se vacía.
 */
export function bindCartToPharmacy(
  state: KioskCartState,
  pharmacyId: string
): KioskCartState {
  if (state.pharmacyId && state.pharmacyId !== pharmacyId) {
    return emptyKioskCart(pharmacyId);
  }
  if (state.pharmacyId === pharmacyId) return state;
  return { ...state, pharmacyId, updatedAt: Date.now() };
}

export function addOrUpdateCartLine(
  state: KioskCartState,
  input: {
    productId: string;
    name: string;
    brand: string | null;
    unitPrice: number;
    stock: number;
    quantityDelta?: number;
  }
): KioskCartState {
  const delta = input.quantityDelta ?? 1;
  const existing = state.lines.find((l) => l.productId === input.productId);
  const maxQty = Math.min(99, Math.max(0, input.stock));
  if (maxQty < 1) {
    return { ...state, updatedAt: Date.now() };
  }

  if (!existing) {
    if (delta < 1) return { ...state, updatedAt: Date.now() };
    const quantity = Math.min(delta, maxQty);
    return {
      ...state,
      lines: [
        ...state.lines,
        {
          productId: input.productId,
          name: input.name,
          brand: input.brand,
          unitPrice: input.unitPrice,
          quantity,
          stock: input.stock,
        },
      ],
      updatedAt: Date.now(),
    };
  }

  const nextQty = Math.min(maxQty, Math.max(0, existing.quantity + delta));
  if (nextQty === 0) {
    return {
      ...state,
      lines: state.lines.filter((l) => l.productId !== input.productId),
      updatedAt: Date.now(),
    };
  }

  return {
    ...state,
    lines: state.lines.map((l) =>
      l.productId === input.productId
        ? { ...l, quantity: nextQty, stock: input.stock, unitPrice: input.unitPrice, name: input.name, brand: input.brand }
        : l
    ),
    updatedAt: Date.now(),
  };
}

export function setCartLineQuantity(
  state: KioskCartState,
  productId: string,
  quantity: number
): KioskCartState {
  const line = state.lines.find((l) => l.productId === productId);
  if (!line) return state;
  const maxQty = Math.min(99, Math.max(0, line.stock));
  const qty = Math.min(maxQty, Math.max(0, Math.floor(quantity)));
  if (qty === 0) {
    return {
      ...state,
      lines: state.lines.filter((l) => l.productId !== productId),
      updatedAt: Date.now(),
    };
  }
  return {
    ...state,
    lines: state.lines.map((l) =>
      l.productId === productId ? { ...l, quantity: qty } : l
    ),
    updatedAt: Date.now(),
  };
}

export function removeCartLine(
  state: KioskCartState,
  productId: string
): KioskCartState {
  if (!state.lines.some((l) => l.productId === productId)) return state;
  return {
    ...state,
    lines: state.lines.filter((l) => l.productId !== productId),
    updatedAt: Date.now(),
  };
}

export function clearCart(state: KioskCartState): KioskCartState {
  return emptyKioskCart(state.pharmacyId);
}

export function parseStoredCart(raw: string | null): KioskCartState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<KioskCartState>;
    if (!data || typeof data !== 'object') return null;
    if (!Array.isArray(data.lines)) return null;
    const lines: KioskCartLine[] = [];
    for (const row of data.lines) {
      if (!row || typeof row !== 'object') continue;
      const productId = String((row as KioskCartLine).productId ?? '');
      const quantity = Number((row as KioskCartLine).quantity);
      const unitPrice = Number((row as KioskCartLine).unitPrice);
      if (!productId || !Number.isInteger(quantity) || quantity < 1) continue;
      if (!Number.isFinite(unitPrice) || unitPrice < 0) continue;
      lines.push({
        productId,
        name: String((row as KioskCartLine).name ?? 'Producto'),
        brand:
          (row as KioskCartLine).brand == null
            ? null
            : String((row as KioskCartLine).brand),
        unitPrice,
        quantity: Math.min(99, quantity),
        stock: Math.max(0, Number((row as KioskCartLine).stock) || 0),
      });
    }
    return {
      pharmacyId:
        typeof data.pharmacyId === 'string' && data.pharmacyId
          ? data.pharmacyId
          : null,
      lines,
      updatedAt:
        typeof data.updatedAt === 'number' && Number.isFinite(data.updatedAt)
          ? data.updatedAt
          : Date.now(),
    };
  } catch {
    return null;
  }
}

export function serializeCart(state: KioskCartState): string {
  return JSON.stringify(state);
}
