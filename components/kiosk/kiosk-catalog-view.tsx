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
    <div className="flex min-h-screen flex-col bg-[#e8f7f7]">
      <header className="sticky top-0 z-20 border-b border-[#2EC4C7]/25 bg-[#2EC4C7] px-4 pb-4 pt-5 text-white shadow-md sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <Link
            href="/k"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 active:scale-95"
            aria-label="Volver al inicio"
          >
            <ArrowLeft className="h-7 w-7" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold tracking-tight">
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

        <div className="mx-auto mt-4 w-full max-w-3xl">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre, marca o código"
              autoCapitalize="off"
              autoCorrect="off"
              className="h-16 w-full rounded-2xl border-0 bg-white pl-14 pr-4 text-xl text-slate-900 shadow-inner outline-none ring-0 placeholder:text-slate-400 focus:ring-4 focus:ring-white/50"
            />
          </label>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 sm:px-6">
        {error ? (
          <p className="rounded-2xl bg-white px-5 py-4 text-base text-red-700 shadow">
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

        <ul className="space-y-3">
          {items.map((product) => {
            const justAdded = flashId === product.id;
            return (
              <li key={product.id}>
                <article
                  className={cn(
                    'flex gap-4 rounded-3xl bg-white p-4 shadow-sm sm:p-5',
                    !product.available && 'opacity-70'
                  )}
                >
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Package className="h-10 w-10" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-semibold leading-snug text-slate-900">
                      {product.name}
                    </h2>
                    {product.brand ? (
                      <p className="mt-1 text-sm text-slate-500">{product.brand}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-2xl font-bold text-[#1a9a9d]">
                        {formatEuro(product.price)}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-semibold',
                          product.available
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-800'
                        )}
                      >
                        {product.available
                          ? `Disponible · ${product.stock}`
                          : 'Sin stock'}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={!product.available}
                      onClick={() => onAdd(product)}
                      className={cn(
                        'mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-semibold shadow-sm active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
                        justAdded
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#2EC4C7] text-white'
                      )}
                    >
                      {justAdded ? (
                        <>
                          <Check className="h-6 w-6" /> Añadido
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="h-6 w-6" /> Añadir
                        </>
                      )}
                    </button>
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
