/**
 * Carrito del catálogo QR público (estado puro + serialización).
 * Aislado por publicId: nunca mezcla farmacias/catálogos.
 */

export const PUBLIC_QR_CART_STORAGE_PREFIX = 'ff_public_qr_cart_v1:';

export type PublicQrCartLine = {
  productId: string;
  name: string;
  quantity: number;
};

export type PublicQrCartState = {
  publicId: string;
  lines: PublicQrCartLine[];
  updatedAt: number;
};

export function publicQrCartStorageKey(publicId: string): string {
  return `${PUBLIC_QR_CART_STORAGE_PREFIX}${publicId.trim().toLowerCase()}`;
}

export function emptyPublicQrCart(publicId: string): PublicQrCartState {
  return {
    publicId: publicId.trim().toLowerCase(),
    lines: [],
    updatedAt: Date.now(),
  };
}

export function publicQrCartUnitCount(state: PublicQrCartState): number {
  return state.lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function upsertPublicQrCartLine(
  state: PublicQrCartState,
  input: { productId: string; name: string; delta: number; maxQty?: number }
): PublicQrCartState {
  const maxQty = input.maxQty ?? 20;
  const existing = state.lines.find((l) => l.productId === input.productId);
  if (!existing) {
    if (input.delta <= 0) return state;
    return {
      ...state,
      lines: [
        ...state.lines,
        {
          productId: input.productId,
          name: input.name,
          quantity: Math.min(maxQty, input.delta),
        },
      ],
      updatedAt: Date.now(),
    };
  }
  const nextQty = existing.quantity + input.delta;
  if (nextQty <= 0) {
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
        ? { ...l, quantity: Math.min(maxQty, nextQty) }
        : l
    ),
    updatedAt: Date.now(),
  };
}

export function clearPublicQrCart(state: PublicQrCartState): PublicQrCartState {
  return { ...state, lines: [], updatedAt: Date.now() };
}

export function serializePublicQrCart(state: PublicQrCartState): string {
  return JSON.stringify(state);
}

export function parsePublicQrCart(
  raw: string | null | undefined,
  expectedPublicId: string
): PublicQrCartState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PublicQrCartState>;
    const publicId = String(parsed.publicId ?? '')
      .trim()
      .toLowerCase();
    const expected = expectedPublicId.trim().toLowerCase();
    if (!publicId || publicId !== expected) return null;
    if (!Array.isArray(parsed.lines)) return null;
    const lines: PublicQrCartLine[] = [];
    for (const line of parsed.lines) {
      const productId = String((line as PublicQrCartLine)?.productId ?? '').trim();
      const name = String((line as PublicQrCartLine)?.name ?? '').trim();
      const quantity = Number((line as PublicQrCartLine)?.quantity);
      if (!productId || !name) continue;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) continue;
      lines.push({ productId, name, quantity });
    }
    return {
      publicId,
      lines,
      updatedAt:
        typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

/** Filtro local de catálogo: no toca el carrito. */
export function filterPublicCatalogItemsByQuery<
  T extends {
    name: string;
    category: string | null;
    subcategory: string | null;
    sku: string | null;
  },
>(items: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter((item) => {
    const haystack = [
      item.name,
      item.category ?? '',
      item.subcategory ?? '',
      item.sku ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}
