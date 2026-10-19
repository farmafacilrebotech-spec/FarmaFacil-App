'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Minus,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import {
  createKioskOrderAction,
  getKioskOrderAction,
} from '@/app/k/orders/actions';
import { useKioskCart } from '@/components/kiosk/kiosk-cart-provider';
import {
  KioskOrderTicket,
  type KioskTicketData,
} from '@/components/kiosk/kiosk-order-ticket';
import { formatEuro } from '@/lib/orders/labels';
import { cn } from '@/lib/utils';

const CLIENT_REQUEST_KEY = 'ff_kiosk_checkout_request_id';

function newClientRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `kiosk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function KioskCartView({ pharmacyName }: { pharmacyName: string }) {
  const router = useRouter();
  const { cart, displayTotal, setQuantity, removeLine, clear, itemCount } =
    useKioskCart();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ticket, setTicket] = React.useState<KioskTicketData | null>(null);

  async function confirmOrder() {
    if (cart.lines.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);

    let requestId =
      typeof window !== 'undefined'
        ? window.sessionStorage.getItem(CLIENT_REQUEST_KEY)
        : null;
    if (!requestId) {
      requestId = newClientRequestId();
      try {
        window.sessionStorage.setItem(CLIENT_REQUEST_KEY, requestId);
      } catch {
        // ignore
      }
    }

    const created = await createKioskOrderAction({
      clientRequestId: requestId,
      lines: cart.lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        // Informativo: si difiere del servidor, cart-validation en RPC no lo usa;
        // no enviamos clientUnitPrice para no forzar price_mismatch en pre-check.
      })),
    });

    if (!created.ok) {
      setSubmitting(false);
      if (
        created.code === 'session_missing' ||
        created.code === 'session_invalid' ||
        created.code === 'session_revoked'
      ) {
        router.replace('/k/pair');
        return;
      }
      if (created.code === 'commercially_blocked') {
        router.replace('/k');
        return;
      }
      setError(created.message);
      return;
    }

    const detail = await getKioskOrderAction(created.orderId);
    setSubmitting(false);

    if (!detail.ok) {
      // Pedido creado: mostrar al menos número/total del create
      setTicket({
        displayNumber: created.displayNumber,
        pharmacyName,
        totalAmount: created.totalAmount,
        currency: created.currency,
        paymentStatus: created.paymentStatus,
        items: cart.lines.map((l) => ({
          productName: l.name,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: Math.round(l.unitPrice * l.quantity * 100) / 100,
        })),
      });
    } else {
      setTicket({
        displayNumber: detail.order.displayNumber,
        pharmacyName,
        totalAmount: detail.order.totalAmount,
        currency: detail.order.currency,
        paymentStatus: detail.order.paymentStatus,
        items: detail.order.items,
      });
    }

    clear();
    try {
      window.sessionStorage.removeItem(CLIENT_REQUEST_KEY);
    } catch {
      // ignore
    }
  }

  function printTicket() {
    window.print();
  }

  if (ticket) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#e8f7f7] print:block print:bg-white">
        <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0">
          <div className="mb-5 text-center print:hidden">
            <p className="text-sm font-medium text-[#1a9a9d]">Pedido creado</p>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Pasa por mostrador
            </h1>
          </div>

          <KioskOrderTicket ticket={ticket} />

          <div className="mt-6 flex flex-col gap-3 print:hidden">
            <button
              type="button"
              onClick={printTicket}
              className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-lg font-semibold text-white active:scale-[0.99]"
            >
              <Printer className="h-6 w-6" />
              Imprimir ticket
            </button>
            <Link
              href="/k"
              className="flex h-16 items-center justify-center rounded-2xl bg-[#2EC4C7] text-lg font-semibold text-white active:scale-[0.99]"
            >
              Volver al inicio
            </Link>
            <Link
              href="/k/catalogo"
              className="flex h-14 items-center justify-center rounded-2xl border-2 border-[#2EC4C7] text-base font-semibold text-[#1a9a9d]"
            >
              Seguir comprando
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#e8f7f7]">
      <header className="sticky top-0 z-20 border-b border-[#2EC4C7]/25 bg-[#2EC4C7] px-4 pb-4 pt-4 text-white shadow-md sm:px-6 sm:pb-5 sm:pt-5">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3">
          <Link
            href="/k/catalogo"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 active:scale-95"
            aria-label="Volver al catálogo"
          >
            <ArrowLeft className="h-7 w-7" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">Mi carrito</h1>
            <p className="truncate text-sm text-white/80">{pharmacyName}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-5 sm:px-6">
        {cart.lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="w-full rounded-3xl bg-white px-6 py-14 text-center shadow">
              <p className="text-xl font-semibold text-slate-800">
                El carrito está vacío
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Añade productos desde el buscador.
              </p>
              <Link
                href="/k/catalogo"
                className="mt-8 inline-flex h-14 w-full items-center justify-center rounded-2xl bg-[#2EC4C7] px-8 text-base font-semibold text-white"
              >
                Buscar producto
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {cart.lines.map((line) => (
                <li
                  key={line.productId}
                  className="rounded-3xl bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-slate-900">
                        {line.name}
                      </p>
                      {line.brand ? (
                        <p className="text-sm text-slate-500">{line.brand}</p>
                      ) : null}
                      <p className="mt-1 text-base font-medium text-[#1a9a9d]">
                        {formatEuro(line.unitPrice)} / ud.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(line.productId)}
                      className="flex h-12 w-12 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Eliminar ${line.name}`}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-800 active:scale-95"
                        onClick={() =>
                          setQuantity(line.productId, line.quantity - 1)
                        }
                        aria-label="Quitar uno"
                      >
                        <Minus className="h-6 w-6" />
                      </button>
                      <span className="min-w-[3rem] text-center text-2xl font-bold">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-800 active:scale-95 disabled:opacity-40"
                        disabled={line.quantity >= Math.min(99, line.stock)}
                        onClick={() =>
                          setQuantity(line.productId, line.quantity + 1)
                        }
                        aria-label="Añadir uno"
                      >
                        <Plus className="h-6 w-6" />
                      </button>
                    </div>
                    <p className="text-xl font-bold text-slate-900">
                      {formatEuro(
                        Math.round(line.unitPrice * line.quantity * 100) / 100
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {error ? (
              <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-base text-red-700">
                {error}
              </p>
            ) : null}

            <div className="sticky bottom-0 mt-auto border-t border-slate-200/80 bg-[#e8f7f7]/95 pb-4 pt-4 backdrop-blur">
              <div className="mb-3 flex items-end justify-between px-1">
                <div>
                  <p className="text-sm text-slate-500">
                    {itemCount} {itemCount === 1 ? 'artículo' : 'artículos'}
                  </p>
                  <p className="text-3xl font-black text-slate-900">
                    {formatEuro(displayTotal)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Precio orientativo · se confirma en servidor
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void confirmOrder()}
                className={cn(
                  'flex h-16 w-full items-center justify-center rounded-2xl text-lg font-bold text-white shadow-md active:scale-[0.99] disabled:opacity-60',
                  'bg-[#2EC4C7]'
                )}
              >
                {submitting ? 'Confirmando…' : 'Confirmar pedido'}
              </button>
              <p className="mt-2 text-center text-sm text-amber-800">
                Pagarás en el mostrador · sin cobro en el kiosko
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
