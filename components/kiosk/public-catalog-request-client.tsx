'use client';

import * as React from 'react';
import { Minus, Plus, ShoppingBag, X } from 'lucide-react';

import { submitPublicCatalogRequestAction } from '@/app/e/[publicId]/catalogo/actions';
import type { PublicCatalogItem } from '@/lib/kiosk/public-catalog';
import type { PharmacyCatalogMode } from '@/lib/catalog/catalog-mode';
import {
  emptyPublicQrCart,
  filterPublicCatalogItems,
  parsePublicQrCart,
  publicQrCartStorageKey,
  publicQrCartUnitCount,
  serializePublicQrCart,
  upsertPublicQrCartLine,
  type PublicQrCartState,
} from '@/lib/kiosk/public-catalog-cart-state';
import { normalizeSpanishPhone } from '@/lib/kiosk/public-catalog-request-validation';
import type {
  PublicQrCheckoutIdentityMode,
  PublicQrCheckoutPrefill,
} from '@/lib/kiosk/public-qr-customer-link';
import {
  listCategoriesFromItems,
  resolveMasterCategoryIcon,
} from '@/lib/catalog/category-icons';
import { resolveProductIllustration } from '@/lib/catalog/product-illustration';

type Props = {
  publicId: string;
  pharmacyName: string;
  pharmacyLogoUrl?: string | null;
  catalogMode: PharmacyCatalogMode;
  note: string | null;
  items: PublicCatalogItem[];
  initialQuery?: string;
  /**
   * Sesión customer|both: datos disponibles tras «Usar mis datos».
   * No se muestran PII hasta esa elección.
   */
  authenticatedPrefill?: PublicQrCheckoutPrefill | null;
};

function availabilityLabel(status: string): string {
  if (status === 'confirm_with_pharmacy') {
    return 'Precio y disponibilidad a confirmar por tu farmacia';
  }
  if (status === 'unavailable') return 'No disponible';
  return 'Precio y disponibilidad a confirmar por tu farmacia';
}

export function PublicCatalogRequestClient({
  publicId,
  pharmacyName,
  pharmacyLogoUrl = null,
  catalogMode,
  note,
  items,
  initialQuery = '',
  authenticatedPrefill = null,
}: Props) {
  const isAuthenticatedCustomer = Boolean(authenticatedPrefill);
  const [cart, setCart] = React.useState<PublicQrCartState>(() =>
    emptyPublicQrCart(publicId)
  );
  const [hydrated, setHydrated] = React.useState(false);
  const [query, setQuery] = React.useState(initialQuery);
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(
    null
  );
  const [panelOpen, setPanelOpen] = React.useState(false);
  /** Con sesión: empezar en choose (sin PII). Sin sesión: guest implícito. */
  const [identityMode, setIdentityMode] =
    React.useState<PublicQrCheckoutIdentityMode | null>(() =>
      authenticatedPrefill ? 'choose' : null
    );
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [noteText, setNoteText] = React.useState('');
  const [privacy, setPrivacy] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [detailItem, setDetailItem] = React.useState<PublicCatalogItem | null>(
    null
  );
  const [confirmation, setConfirmation] = React.useState<{
    displayNumber: string;
    pharmacyName: string;
    linkedToCustomer: boolean;
  } | null>(null);
  const requestIdRef = React.useRef<string | null>(null);

  const showContactForm =
    !isAuthenticatedCustomer ||
    identityMode === 'account' ||
    identityMode === 'guest';
  const linkToCustomer = identityMode === 'account';

  function chooseAccountIdentity() {
    if (!authenticatedPrefill) return;
    setIdentityMode('account');
    setName(authenticatedPrefill.displayName);
    setPhone(authenticatedPrefill.phone);
    setPrivacy(Boolean(authenticatedPrefill.privacyAlreadyAccepted));
    setError(null);
  }

  function chooseGuestIdentity() {
    setIdentityMode('guest');
    setName('');
    setPhone('');
    setPrivacy(false);
    setError(null);
  }

  function resetIdentityChoice() {
    setIdentityMode('choose');
    setName('');
    setPhone('');
    setPrivacy(false);
    setError(null);
  }

  React.useEffect(() => {
    const key = publicQrCartStorageKey(publicId);
    try {
      const restored = parsePublicQrCart(
        window.sessionStorage.getItem(key),
        publicId
      );
      if (restored) setCart(restored);
      else setCart(emptyPublicQrCart(publicId));
    } catch {
      setCart(emptyPublicQrCart(publicId));
    }
    setHydrated(true);
  }, [publicId]);

  React.useEffect(() => {
    if (!hydrated) return;
    // Tras envío exitoso no rehidratar ni reescribir el carrito antiguo.
    if (confirmation) return;
    try {
      const key = publicQrCartStorageKey(publicId);
      if (cart.lines.length === 0) {
        window.sessionStorage.setItem(key, serializePublicQrCart(cart));
        return;
      }
      window.sessionStorage.setItem(key, serializePublicQrCart(cart));
    } catch {
      /* sessionStorage no disponible */
    }
  }, [cart, hydrated, publicId, confirmation]);

  function resetCheckoutForm() {
    setName('');
    setPhone('');
    setNoteText('');
    setPrivacy(false);
    setError(null);
    setIdentityMode(isAuthenticatedCustomer ? 'choose' : null);
    requestIdRef.current = null;
  }

  function clearCartPersistently() {
    const empty = emptyPublicQrCart(publicId);
    setCart(empty);
    try {
      const key = publicQrCartStorageKey(publicId);
      window.sessionStorage.setItem(key, serializePublicQrCart(empty));
    } catch {
      /* ignore */
    }
  }

  const categories = React.useMemo(
    () => listCategoriesFromItems(items),
    [items]
  );

  const visibleItems = React.useMemo(
    () =>
      filterPublicCatalogItems(items, {
        query,
        category: categoryFilter,
      }),
    [items, query, categoryFilter]
  );

  const totalUnits = publicQrCartUnitCount(cart);

  function upsertLine(item: PublicCatalogItem, delta: number) {
    if (!item.requestable || item.availabilityStatus === 'unavailable') return;
    setError(null);
    setCart((prev) =>
      upsertPublicQrCartLine(prev, {
        productId: item.id,
        name: item.name,
        delta,
      })
    );
  }

  function qtyOf(productId: string): number {
    return cart.lines.find((l) => l.productId === productId)?.quantity ?? 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || cart.lines.length === 0) return;
    setBusy(true);
    setError(null);

    if (!normalizeSpanishPhone(phone)) {
      setBusy(false);
      setError(
        'Indica un teléfono español válido (9 dígitos, o con prefijo +34 / 0034).'
      );
      return;
    }

    if (!requestIdRef.current) {
      requestIdRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `pub-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    const result = await submitPublicCatalogRequestAction({
      publicId,
      clientRequestId: requestIdRef.current,
      lines: cart.lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
      })),
      customerName: name,
      customerPhone: phone,
      privacyAccepted: privacy,
      customerNote: noteText.trim() || undefined,
      linkToCustomer,
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setConfirmation({
      displayNumber: result.displayNumber,
      pharmacyName: result.pharmacyName || pharmacyName,
      linkedToCustomer: result.linkedToCustomer,
    });
    clearCartPersistently();
    resetCheckoutForm();
    setPanelOpen(false);
  }

  if (confirmation) {
    return (
      <div className="rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
          Solicitud enviada
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          Referencia #{confirmation.displayNumber}
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          {confirmation.pharmacyName} ha recibido tu solicitud. Precio y
          disponibilidad a confirmar por tu farmacia.
        </p>
        {confirmation.linkedToCustomer ? (
          <p className="mt-2 text-sm text-emerald-800">
            Pedido vinculado a tu cuenta. Puedes consultarlo en{' '}
            <a
              href={`/e/${publicId}/cuenta/pedidos`}
              className="font-medium underline"
            >
              Mis pedidos
            </a>
            .
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            No se ha realizado ningún cobro. Conserva esta referencia.
          </p>
        )}
        <button
          type="button"
          className="mt-6 inline-flex rounded-2xl bg-[#2EC4C7] px-6 py-3 text-sm font-semibold text-white"
          onClick={() => {
            clearCartPersistently();
            resetCheckoutForm();
            setConfirmation(null);
          }}
        >
          Volver al catálogo
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-w-0 overflow-x-hidden pb-28">
      <div className="mb-4">
        <label htmlFor="public-catalog-search" className="sr-only">
          Buscar producto o categoría
        </label>
        <input
          id="public-catalog-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto o categoría"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none ring-[#2EC4C7] focus:ring-2"
        />
      </div>

      {categories.length > 0 ? (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((cat) => {
            const icon = resolveMasterCategoryIcon(cat);
            const active = categoryFilter === cat;
            return (
              <button
                type="button"
                key={cat}
                onClick={() =>
                  setCategoryFilter((prev) => (prev === cat ? null : cat))
                }
                title={cat}
                className={
                  active
                    ? 'inline-flex max-w-full shrink-0 items-center gap-2 rounded-2xl bg-[#2EC4C7] px-3 py-2 text-xs font-semibold text-white'
                    : 'inline-flex max-w-full shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700'
                }
              >
                {icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={icon.iconSrc}
                    alt=""
                    width={22}
                    height={22}
                    className="h-[22px] w-[22px] shrink-0 object-contain"
                  />
                ) : null}
                <span className="whitespace-nowrap sm:max-w-[11rem] sm:truncate">
                  {cat}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {note ? (
        <p className="mb-4 rounded-2xl border border-teal-100 bg-teal-50/60 px-4 py-3 text-sm text-teal-900">
          {note}
        </p>
      ) : null}

      {visibleItems.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          {items.length === 0
            ? 'No hay productos visibles en este catálogo.'
            : 'Ningún producto coincide con la búsqueda.'}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {visibleItems.map((item) => {
            const qty = qtyOf(item.id);
            const disabled =
              !item.requestable || item.availabilityStatus === 'unavailable';
            const categoryIcon = resolveMasterCategoryIcon(item.category);
            const illustration = resolveProductIllustration(
              {
                name: item.name,
                category: item.category,
                subcategory: item.subcategory,
              },
              categoryIcon
                ? { src: categoryIcon.iconSrc, slug: categoryIcon.slug }
                : null
            );
            return (
              <li
                key={item.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
              >
                <button
                  type="button"
                  className="flex aspect-square items-center justify-center bg-[#F2F7F7] p-4 text-left"
                  onClick={() => setDetailItem(item)}
                  aria-label={`Ver ficha de ${item.name}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={illustration.src}
                    alt=""
                    width={160}
                    height={160}
                    className="h-full w-full max-h-[7.5rem] object-contain sm:max-h-[9rem]"
                    data-illustration-kind={illustration.kind}
                    data-illustration-slug={illustration.slug}
                  />
                </button>
                <div className="flex flex-1 flex-col gap-2 p-3 sm:p-3.5">
                  <button
                    type="button"
                    className="line-clamp-2 text-left text-sm font-semibold leading-snug text-[#0F2A2E]"
                    onClick={() => setDetailItem(item)}
                  >
                    {item.name}
                  </button>
                  {item.category ? (
                    <p className="truncate text-xs text-slate-500">
                      {item.category}
                    </p>
                  ) : null}
                  <div className="mt-auto pt-1">
                    {!disabled ? (
                      qty > 0 ? (
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            aria-label={`Quitar uno de ${item.name}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[#0F2A2E]"
                            onClick={() => upsertLine(item, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums text-[#0F2A2E]">
                            {qty}
                          </span>
                          <button
                            type="button"
                            aria-label={`Añadir uno de ${item.name}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#2EC4C7] text-white"
                            onClick={() => upsertLine(item, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Añadir ${item.name} al carrito`}
                          className="inline-flex w-full items-center justify-center rounded-xl bg-[#2EC4C7] px-3 py-2.5 text-xs font-semibold text-white sm:text-sm"
                          onClick={() => upsertLine(item, 1)}
                        >
                          Añadir
                        </button>
                      )
                    ) : (
                      <span className="block rounded-xl bg-slate-100 px-3 py-2.5 text-center text-xs text-slate-400">
                        No disponible
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalUnits > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <ShoppingBag className="h-4 w-4" />
              <span>
                {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'} ·{' '}
                {cart.lines.length}{' '}
                {cart.lines.length === 1 ? 'producto' : 'productos'}
              </span>
            </div>
            <button
              type="button"
              className="rounded-2xl bg-[#2EC4C7] px-5 py-3 text-sm font-semibold text-white"
              onClick={() => setPanelOpen(true)}
            >
              Revisar solicitud
            </button>
          </div>
        </div>
      ) : null}

      {panelOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="public-request-title"
            className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-5">
              <div className="min-w-0">
                <h2
                  id="public-request-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Resumen de solicitud
                </h2>
                <div className="mt-2 flex items-center gap-2">
                  {pharmacyLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pharmacyLogoUrl}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-lg object-contain ring-1 ring-slate-100"
                    />
                  ) : null}
                  <p className="truncate text-xs text-slate-500">
                    {pharmacyName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                onClick={() => setPanelOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              <ul className="mb-4 space-y-2">
                {cart.lines.map((line) => {
                  const catalogItem = items.find((i) => i.id === line.productId);
                  return (
                    <li
                      key={line.productId}
                      className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">{line.name}</span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`Quitar uno de ${line.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white"
                          onClick={() => {
                            if (catalogItem) upsertLine(catalogItem, -1);
                            else {
                              setCart((prev) =>
                                upsertPublicQrCartLine(prev, {
                                  productId: line.productId,
                                  name: line.name,
                                  delta: -1,
                                })
                              );
                            }
                          }}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[1.25rem] text-center font-semibold tabular-nums">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Añadir uno de ${line.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#2EC4C7] text-white"
                          onClick={() => {
                            if (catalogItem) upsertLine(catalogItem, 1);
                            else {
                              setCart((prev) =>
                                upsertPublicQrCartLine(prev, {
                                  productId: line.productId,
                                  name: line.name,
                                  delta: 1,
                                })
                              );
                            }
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {cart.lines.length > 0 ? (
                <button
                  type="button"
                  className="mb-4 text-xs font-medium text-slate-500 underline"
                  onClick={() => {
                    if (
                      typeof window !== 'undefined' &&
                      window.confirm('¿Vaciar la solicitud?')
                    ) {
                      clearCartPersistently();
                      setPanelOpen(false);
                    }
                  }}
                >
                  Vaciar solicitud
                </button>
              ) : null}

              <p className="mb-4 text-xs text-slate-500">
                Precio y disponibilidad a confirmar por tu farmacia. No se
                realiza ningún cobro ahora.
              </p>

              {isAuthenticatedCustomer ? (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700">
                  <p className="font-medium text-slate-900">
                    Estás utilizando tu cuenta de FarmaFácil
                  </p>
                  <p className="mt-1 text-slate-600">
                    Elige cómo completar esta solicitud. No mostramos tus datos
                    personales hasta que lo indiques.
                  </p>
                  {identityMode === 'choose' ? (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#2EC4C7] px-3 py-2.5 text-xs font-semibold text-white"
                        onClick={chooseAccountIdentity}
                      >
                        Usar mis datos
                      </button>
                      <button
                        type="button"
                        className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800"
                        onClick={chooseGuestIdentity}
                      >
                        Pedir como invitado
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
                        {identityMode === 'account'
                          ? 'Pedido con tu cuenta (aparecerá en Mis pedidos)'
                          : 'Pedido como invitado (sin vincular a la cuenta)'}
                      </span>
                      <button
                        type="button"
                        className="text-[11px] font-medium text-[#0F2A2E] underline"
                        onClick={resetIdentityChoice}
                      >
                        Cambiar
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              {showContactForm ? (
                <form
                  id="public-request-form"
                  className="space-y-4 pb-2"
                  onSubmit={(e) => void onSubmit(e)}
                >
                  {identityMode === 'account' ? (
                    <p className="text-[11px] text-slate-500">
                      Nombre y teléfono se usan solo en esta solicitud; no se
                      actualiza tu perfil.
                    </p>
                  ) : null}
                  <div>
                    <label
                      htmlFor="pub-name"
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Nombre
                    </label>
                    <input
                      id="pub-name"
                      type="text"
                      autoComplete="name"
                      required
                      maxLength={80}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-[#2EC4C7]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="pub-phone"
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Teléfono
                    </label>
                    <input
                      id="pub-phone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      required
                      maxLength={20}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="612 345 678 o +34…"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-[#2EC4C7]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="pub-note"
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Nota (opcional)
                    </label>
                    <textarea
                      id="pub-note"
                      maxLength={280}
                      rows={2}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-[#2EC4C7]"
                    />
                  </div>
                  <label className="flex items-start gap-3 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={privacy}
                      onChange={(e) => setPrivacy(e.target.checked)}
                      required
                    />
                    <span>
                      {linkToCustomer
                        ? 'Confirmo que la farmacia puede usar el nombre y teléfono de esta solicitud para gestionar el pedido vinculado a mi cuenta.'
                        : 'He leído y acepto que la farmacia use mi nombre y teléfono únicamente para gestionar esta solicitud de productos. No se creará una cuenta ni se enviarán comunicaciones comerciales desde este formulario.'}
                    </span>
                  </label>

                  {error ? (
                    <p
                      className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700"
                      role="alert"
                    >
                      {error}
                    </p>
                  ) : null}
                </form>
              ) : null}
            </div>

            {showContactForm ? (
              <div className="shrink-0 border-t border-slate-100 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                <button
                  type="submit"
                  form="public-request-form"
                  disabled={busy || cart.lines.length === 0}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-[#2EC4C7] px-6 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy ? 'Enviando…' : 'Enviar solicitud'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {detailItem ? (
        <ProductDetailSheet
          item={detailItem}
          catalogMode={catalogMode}
          quantity={qtyOf(detailItem.id)}
          onClose={() => setDetailItem(null)}
          onChangeQty={(delta) => upsertLine(detailItem, delta)}
        />
      ) : null}
    </div>
  );
}

function ProductDetailSheet({
  item,
  catalogMode,
  quantity,
  onClose,
  onChangeQty,
}: {
  item: PublicCatalogItem;
  catalogMode: PharmacyCatalogMode;
  quantity: number;
  onClose: () => void;
  onChangeQty: (delta: number) => void;
}) {
  const disabled =
    !item.requestable || item.availabilityStatus === 'unavailable';
  const categoryIcon = resolveMasterCategoryIcon(item.category);
  const illustration = resolveProductIllustration(
    {
      name: item.name,
      category: item.category,
      subcategory: item.subcategory,
    },
    categoryIcon ? { src: categoryIcon.iconSrc, slug: categoryIcon.slug } : null
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-title"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Ficha de producto
          </p>
          <button
            type="button"
            aria-label="Cerrar ficha"
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="mx-auto mb-4 flex aspect-square max-w-[14rem] items-center justify-center rounded-2xl bg-[#F2F7F7] p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={illustration.src}
              alt=""
              width={200}
              height={200}
              className="h-full w-full object-contain"
            />
          </div>
          <h2
            id="product-detail-title"
            className="text-xl font-semibold text-[#0F2A2E]"
          >
            {item.name}
          </h2>
          {item.category ? (
            <p className="mt-1 text-sm text-slate-500">{item.category}</p>
          ) : null}
          {item.subcategory ? (
            <p className="text-xs text-slate-400">{item.subcategory}</p>
          ) : null}
          <p className="mt-3 text-sm font-medium text-[#0F766E]">
            {availabilityLabel(item.availabilityStatus)}
          </p>
          {catalogMode === 'generic' ? (
            <p className="mt-2 text-sm text-slate-600">
              Producto del catálogo genérico FarmaFácil. La farmacia confirmará
              la referencia concreta disponible.
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Producto del catálogo de tu farmacia.
            </p>
          )}
        </div>
        <div className="shrink-0 border-t border-slate-100 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {!disabled ? (
            quantity > 0 ? (
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  aria-label={`Quitar uno de ${item.name}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50"
                  onClick={() => onChangeQty(-1)}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="text-base font-semibold tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label={`Añadir uno de ${item.name}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#2EC4C7] text-white"
                  onClick={() => onChangeQty(1)}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[#2EC4C7] px-6 py-3.5 text-sm font-semibold text-white"
                onClick={() => onChangeQty(1)}
              >
                Añadir a la solicitud
              </button>
            )
          ) : (
            <p className="rounded-xl bg-slate-100 px-3 py-3 text-center text-sm text-slate-500">
              No disponible
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
