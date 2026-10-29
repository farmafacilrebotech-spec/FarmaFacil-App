'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { searchKioskCatalogAction } from '@/app/k/catalogo/actions';
import { useKioskCart } from '@/components/kiosk/kiosk-cart-provider';
import { resolveMasterCategoryIcon } from '@/lib/catalog/category-icons';
import { resolveProductIllustration } from '@/lib/catalog/product-illustration';
import type { KioskCatalogProduct } from '@/lib/kiosk/catalog';
import {
  canAddKioskProductToCart,
  formatKioskProductAvailability,
  formatKioskProductPrice,
} from '@/lib/kiosk/catalog-display';
import { cn } from '@/lib/utils';

/** Debounce de búsqueda: reduce RPC por tecla en pantallas táctiles lentas. */
const SEARCH_DEBOUNCE_MS = 350;

function useDebounced(value: string, ms: number) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

function productIllustration(product: KioskCatalogProduct) {
  const categoryIcon = resolveMasterCategoryIcon(product.category);
  return resolveProductIllustration(
    {
      name: product.name,
      category: product.category,
      subcategory: product.subcategory ?? null,
    },
    categoryIcon
      ? { src: categoryIcon.iconSrc, slug: categoryIcon.slug }
      : null
  );
}

export function KioskCatalogView({
  pharmacyName,
  initialItems,
}: {
  pharmacyName: string;
  initialItems: KioskCatalogProduct[];
}) {
  const router = useRouter();
  const { cart, addProduct, setQuantity, itemCount } = useKioskCart();
  const [query, setQuery] = React.useState('');
  const debounced = useDebounced(query, SEARCH_DEBOUNCE_MS);
  const [items, setItems] = React.useState(initialItems);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // El SSR ya cargó query ''; evita un segundo RPC idéntico al montar.
  const skipSeededEmptySearch = React.useRef(true);

  const qtyByProductId = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart.lines) {
      map.set(line.productId, line.quantity);
    }
    return map;
  }, [cart.lines]);

  React.useEffect(() => {
    if (skipSeededEmptySearch.current && debounced === '') {
      skipSeededEmptySearch.current = false;
      return;
    }
    skipSeededEmptySearch.current = false;

    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      const result = await searchKioskCatalogAction({
        query: debounced,
        limit: 40,
      });
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        if (
          result.code === 'session_missing' ||
          result.code === 'session_invalid' ||
          result.code === 'session_revoked'
        ) {
          router.replace('/k/pair');
          return;
        }
        if (result.code === 'commercially_blocked') {
          router.replace('/k');
          return;
        }
        setError(result.message);
        setItems([]);
        return;
      }
      setItems(result.items);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [debounced, router]);

  function qtyOf(productId: string): number {
    return qtyByProductId.get(productId) ?? 0;
  }

  function onAdd(product: KioskCatalogProduct) {
    if (!canAddKioskProductToCart(product)) return;
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
  }

  function onIncrement(product: KioskCatalogProduct) {
    const qty = qtyOf(product.id);
    const stock = product.stock ?? 0;
    if (qty >= stock) return;
    onAdd(product);
  }

  function onDecrement(product: KioskCatalogProduct) {
    const qty = qtyOf(product.id);
    if (qty <= 0) return;
    setQuantity(product.id, qty - 1);
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#e8f7f7]">
      <header className="sticky top-0 z-20 border-b border-[#2EC4C7]/25 bg-[#2EC4C7] px-4 pb-4 pt-4 text-white shadow-md sm:px-6 sm:pt-5 lg:px-8 lg:pb-5 lg:pt-6">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 lg:gap-4">
          <Link
            href="/k"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 active:scale-95 lg:h-16 lg:w-16"
            aria-label="Volver al inicio"
          >
            <ArrowLeft className="h-7 w-7 lg:h-8 lg:w-8" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
              Buscar producto
            </h1>
            <p className="truncate text-sm text-white/80 lg:text-base">
              {pharmacyName}
            </p>
          </div>
          <Link
            href="/k/carrito"
            className="relative flex h-14 min-w-[3.5rem] items-center justify-center rounded-2xl bg-white px-4 text-[#1a9a9d] shadow active:scale-95 lg:h-16 lg:min-w-[4rem] lg:px-5"
            aria-label="Ir al carrito"
          >
            <ShoppingCart className="h-7 w-7 lg:h-8 lg:w-8" />
            {itemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-900 px-1.5 text-sm font-bold text-white lg:h-8 lg:min-w-8 lg:text-base">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            ) : null}
          </Link>
        </div>

        <div className="mx-auto mt-3 w-full max-w-5xl sm:mt-4 lg:mt-5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400 lg:left-5 lg:h-7 lg:w-7" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre, marca o código"
              autoCapitalize="off"
              autoCorrect="off"
              className="h-14 w-full rounded-2xl border-0 bg-white pl-14 pr-4 text-lg text-slate-900 shadow-inner outline-none ring-0 placeholder:text-slate-400 focus:ring-4 focus:ring-white/50 sm:h-16 sm:text-xl lg:h-[4.5rem] lg:rounded-3xl lg:pl-16 lg:pr-5 lg:text-2xl"
            />
          </label>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
        {error ? (
          <p className="mb-4 rounded-2xl bg-white px-5 py-4 text-base text-red-700 shadow lg:text-lg">
            {error}
          </p>
        ) : null}

        {loading && items.length === 0 ? (
          <p className="py-16 text-center text-lg text-slate-500 lg:text-xl">
            Buscando…
          </p>
        ) : null}

        {!loading && items.length === 0 && !error ? (
          <div className="rounded-3xl bg-white px-6 py-14 text-center shadow">
            <Package className="mx-auto h-12 w-12 text-slate-300 lg:h-14 lg:w-14" />
            <p className="mt-4 text-lg font-medium text-slate-700 lg:text-xl">
              No hay productos para esta búsqueda
            </p>
            <p className="mt-2 text-sm text-slate-500 lg:text-base">
              Prueba con otro nombre, marca, SKU o EAN.
            </p>
          </div>
        ) : null}

        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-5">
          {items.map((product) => {
            const qty = qtyOf(product.id);
            const selected = qty > 0;
            const canAdd = canAddKioskProductToCart(product);
            const stock = product.stock ?? 0;
            const atStockLimit = selected && stock > 0 && qty >= stock;
            const illustration = productIllustration(product);

            return (
              <li key={product.id} className="min-w-0">
                <article
                  className={cn(
                    'flex h-full flex-col rounded-2xl bg-white p-3 shadow-sm sm:rounded-3xl sm:p-4 lg:p-5',
                    selected
                      ? 'ring-2 ring-[#2EC4C7] ring-offset-2 ring-offset-[#e8f7f7]'
                      : 'ring-1 ring-transparent',
                    !product.available && !selected && 'opacity-70'
                  )}
                  data-selected={selected ? 'true' : 'false'}
                  data-qty={qty}
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-[#F2F7F7] sm:h-20 sm:w-20 sm:rounded-2xl lg:h-24 lg:w-24">
                    {/* eslint-disable-next-line @next/next/no-img-element -- SVG estáticos del catálogo Canva */}
                    <img
                      src={illustration.src}
                      alt=""
                      width={96}
                      height={96}
                      className="h-full w-full object-contain p-1.5 sm:p-2"
                      data-illustration-kind={illustration.kind}
                      data-illustration-slug={illustration.slug}
                      draggable={false}
                    />
                  </div>
                  <h2 className="mt-3 line-clamp-2 min-h-[2.75rem] text-center text-sm font-semibold leading-snug text-slate-900 sm:min-h-[3.25rem] sm:text-base lg:min-h-[3.5rem] lg:text-lg">
                    {product.name}
                  </h2>
                  <p className="mt-1 line-clamp-1 text-center text-xs text-slate-500 lg:text-sm">
                    {product.brand || '\u00A0'}
                  </p>
                  <p className="mt-2 text-center text-lg font-bold text-[#1a9a9d] sm:text-xl lg:text-2xl">
                    {formatKioskProductPrice(product)}
                  </p>
                  <span
                    className={cn(
                      'mx-auto mt-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:text-xs lg:mt-2 lg:px-3 lg:py-1 lg:text-sm',
                      canAdd
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-800'
                    )}
                  >
                    {formatKioskProductAvailability(product)}
                  </span>
                  <div className="mt-3 sm:mt-auto sm:pt-3 lg:mt-4">
                    {selected ? (
                      <div className="flex h-12 w-full items-center justify-between gap-2 rounded-xl bg-[#2EC4C7]/12 px-1.5 sm:h-14 sm:rounded-2xl lg:h-16">
                        <button
                          type="button"
                          aria-label={`Quitar uno de ${product.name}`}
                          onClick={() => onDecrement(product)}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#0F2A2E] shadow-sm active:scale-95 sm:h-11 sm:w-11 lg:h-12 lg:w-12"
                        >
                          <Minus className="h-5 w-5 lg:h-6 lg:w-6" />
                        </button>
                        <span
                          className="min-w-[2rem] text-center text-lg font-bold tabular-nums text-[#0F2A2E] sm:text-xl lg:text-2xl"
                          aria-live="polite"
                        >
                          {qty}
                        </span>
                        <button
                          type="button"
                          aria-label={`Añadir uno de ${product.name}`}
                          disabled={!canAdd || atStockLimit}
                          onClick={() => onIncrement(product)}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2EC4C7] text-white shadow-sm active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11 lg:h-12 lg:w-12"
                        >
                          <Plus className="h-5 w-5 lg:h-6 lg:w-6" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={!canAdd}
                        onClick={() => onAdd(product)}
                        className={cn(
                          'flex h-12 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold shadow-sm active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:rounded-2xl sm:text-base',
                          'lg:h-16 lg:gap-2 lg:rounded-2xl lg:text-lg',
                          'bg-[#2EC4C7] text-white'
                        )}
                      >
                        <ShoppingCart className="h-5 w-5 lg:h-6 lg:w-6" />{' '}
                        Añadir
                      </button>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
