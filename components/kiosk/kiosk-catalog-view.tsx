'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Package,
  Search,
  ShoppingCart,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { searchKioskCatalogAction } from '@/app/k/catalogo/actions';
import { useKioskCart } from '@/components/kiosk/kiosk-cart-provider';
import type { KioskCatalogProduct } from '@/lib/kiosk/catalog';
import { formatEuro } from '@/lib/orders/labels';
import { cn } from '@/lib/utils';

function useDebounced(value: string, ms: number) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function KioskCatalogView({
  pharmacyName,
  initialItems,
}: {
  pharmacyName: string;
  initialItems: KioskCatalogProduct[];
}) {
  const router = useRouter();
  const { addProduct, itemCount } = useKioskCart();
  const [query, setQuery] = React.useState('');
  const debounced = useDebounced(query, 280);
  const [items, setItems] = React.useState(initialItems);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [flashId, setFlashId] = React.useState<string | null>(null);

  React.useEffect(() => {
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

  function onAdd(product: KioskCatalogProduct) {
    if (!product.available) return;
    addProduct({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      unitPrice: product.price,
      stock: product.stock,
    });
    setFlashId(product.id);
    window.setTimeout(() => setFlashId((id) => (id === product.id ? null : id)), 900);
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#e8f7f7]">
      <header className="sticky top-0 z-20 border-b border-[#2EC4C7]/25 bg-[#2EC4C7] px-4 pb-4 pt-4 text-white shadow-md sm:px-6 sm:pt-5">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
          <Link
            href="/k"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 active:scale-95"
            aria-label="Volver al inicio"
          >
            <ArrowLeft className="h-7 w-7" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
              Buscar producto
            </h1>
            <p className="truncate text-sm text-white/80">{pharmacyName}</p>
          </div>
          <Link
            href="/k/carrito"
            className="relative flex h-14 min-w-[3.5rem] items-center justify-center rounded-2xl bg-white px-4 text-[#1a9a9d] shadow active:scale-95"
            aria-label="Ir al carrito"
          >
            <ShoppingCart className="h-7 w-7" />
            {itemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-900 px-1.5 text-sm font-bold text-white">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            ) : null}
          </Link>
        </div>

        <div className="mx-auto mt-3 w-full max-w-5xl sm:mt-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre, marca o código"
              autoCapitalize="off"
              autoCorrect="off"
              className="h-14 w-full rounded-2xl border-0 bg-white pl-14 pr-4 text-lg text-slate-900 shadow-inner outline-none ring-0 placeholder:text-slate-400 focus:ring-4 focus:ring-white/50 sm:h-16 sm:text-xl"
            />
          </label>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 sm:px-6 sm:py-5">
        {error ? (
          <p className="mb-4 rounded-2xl bg-white px-5 py-4 text-base text-red-700 shadow">
            {error}
          </p>
        ) : null}

        {loading && items.length === 0 ? (
          <p className="py-16 text-center text-lg text-slate-500">Buscando…</p>
        ) : null}

        {!loading && items.length === 0 && !error ? (
          <div className="rounded-3xl bg-white px-6 py-14 text-center shadow">
            <Package className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-lg font-medium text-slate-700">
              No hay productos para esta búsqueda
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Prueba con otro nombre, marca, SKU o EAN.
            </p>
          </div>
        ) : null}

        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {items.map((product) => {
            const justAdded = flashId === product.id;
            return (
              <li key={product.id} className="min-w-0">
                <article
                  className={cn(
                    'flex h-full flex-col rounded-2xl bg-white p-3 shadow-sm sm:rounded-3xl sm:p-4',
                    !product.available && 'opacity-70'
                  )}
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-slate-400 sm:h-20 sm:w-20 sm:rounded-2xl">
                    <Package className="h-8 w-8 sm:h-9 sm:w-9" aria-hidden />
                  </div>
                  <h2 className="mt-3 line-clamp-2 min-h-[2.75rem] text-center text-sm font-semibold leading-snug text-slate-900 sm:min-h-[3.25rem] sm:text-base">
                    {product.name}
                  </h2>
                  <p className="mt-1 line-clamp-1 text-center text-xs text-slate-500">
                    {product.brand || '\u00A0'}
                  </p>
                  <p className="mt-2 text-center text-lg font-bold text-[#1a9a9d] sm:text-xl">
                    {formatEuro(product.price)}
                  </p>
                  <span
                    className={cn(
                      'mx-auto mt-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:text-xs',
                      product.available
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-800'
                    )}
                  >
                    {product.available
                      ? `Disponible · ${product.stock}`
                      : 'Sin stock'}
                  </span>
                  <button
                    type="button"
                    disabled={!product.available}
                    onClick={() => onAdd(product)}
                    className={cn(
                      'mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold shadow-sm active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:mt-auto sm:h-14 sm:rounded-2xl sm:text-base',
                      justAdded
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#2EC4C7] text-white'
                    )}
                  >
                    {justAdded ? (
                      <>
                        <Check className="h-5 w-5" /> Añadido
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-5 w-5" /> Añadir
                      </>
                    )}
                  </button>
                </article>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
