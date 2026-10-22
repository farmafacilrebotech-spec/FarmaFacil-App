'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check, Package, Search, ShoppingCart } from 'lucide-react';

import { useKioskCart } from '@/components/kiosk/kiosk-cart-provider';
import type { AssistantProductCard } from '@/lib/kiosk/assistant/types';
import {
  canAddKioskProductToCart,
  formatKioskProductAvailability,
  formatKioskProductPrice,
} from '@/lib/kiosk/catalog-display';
import { cn } from '@/lib/utils';

/**
 * Tarjetas de producto del asistente → carrito kiosko existente.
 * DEMO: canAddToCart=false (ejemplos; no contaminan el carrito real).
 */
export function KioskAssistantProductCards({
  products,
  demoMode,
}: {
  products: AssistantProductCard[];
  demoMode: boolean;
}) {
  const { addProduct } = useKioskCart();
  const [flashId, setFlashId] = React.useState<string | null>(null);

  if (!products.length) return null;

  function onAdd(product: AssistantProductCard) {
    if (
      !product.canAddToCart ||
      !canAddKioskProductToCart({
        available: product.available,
        price: product.price,
        stock: product.stock,
        source: null,
      })
    ) {
      return;
    }
    const unitPrice = product.price;
    const stock = product.stock;
    if (unitPrice == null || stock == null) return;
    addProduct({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      unitPrice,
      stock,
    });
    setFlashId(product.id);
    window.setTimeout(
      () => setFlashId((id) => (id === product.id ? null : id)),
      900
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {demoMode ? (
        <p className="text-xs font-medium text-amber-800 sm:text-sm">
          Ejemplos de demostración. No son el catálogo real de esta farmacia ni
          se pueden añadir al carrito.
        </p>
      ) : null}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {products.map((product) => {
          const justAdded = flashId === product.id;
          return (
            <li key={product.id}>
              <article
                className={cn(
                  'flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70',
                  !product.available && 'opacity-75'
                )}
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Package className="h-8 w-8" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 sm:text-base">
                    {product.name}
                  </h3>
                  {product.brand ? (
                    <p className="truncate text-xs text-slate-500">
                      {product.brand}
                    </p>
                  ) : null}
                  <p className="mt-1 text-base font-bold text-[#1a9a9d]">
                    {formatKioskProductPrice(product)}
                  </p>
                  <p
                    className={cn(
                      'mt-0.5 text-[11px] font-semibold',
                      product.available && product.price != null
                        ? 'text-emerald-700'
                        : 'text-amber-800'
                    )}
                  >
                    {formatKioskProductAvailability({
                      ...product,
                      source: null,
                    })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.canAddToCart ? (
                      <button
                        type="button"
                        disabled={
                          !canAddKioskProductToCart({
                            available: product.available,
                            price: product.price,
                            stock: product.stock,
                            source: null,
                          })
                        }
                        onClick={() => onAdd(product)}
                        className={cn(
                          'inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white shadow-sm active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm',
                          justAdded ? 'bg-emerald-600' : 'bg-[#2EC4C7]'
                        )}
                      >
                        {justAdded ? (
                          <>
                            <Check className="h-4 w-4" /> Añadido
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="h-4 w-4" /> Añadir al
                            carrito
                          </>
                        )}
                      </button>
                    ) : null}
                    <Link
                      href="/k/catalogo"
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 active:scale-[0.99] sm:text-sm"
                    >
                      <Search className="h-4 w-4" />
                      Ver en buscador
                    </Link>
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
