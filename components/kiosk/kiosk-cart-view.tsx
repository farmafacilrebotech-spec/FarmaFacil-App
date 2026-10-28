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
import { endKioskClientPurchaseSession } from '@/lib/kiosk/end-client-purchase-session';
import { formatEuro } from '@/lib/orders/labels';
import { cn } from '@/lib/utils';

const CLIENT_REQUEST_KEY = 'ff_kiosk_checkout_request_id';

type FarmaFacilKioskBridge = {
  printTicket: (payloadJson: string) => string;
  getBridgeInfo?: () => string;
};

type FarmaFacilKioskPrintAck = {
  status?: string;
  code?: string;
  message?: string;
};

type FarmaFacilKioskPrintResult = {
  ok?: boolean;
  code?: string;
  message?: string;
};

declare global {
  interface Window {
    FarmaFacilKiosk?: FarmaFacilKioskBridge;
    onFarmaFacilKioskPrintResult?: (
      result: FarmaFacilKioskPrintResult
    ) => void;
  }
}

function newClientRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `kiosk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Payload del puente Android (mismo shape que KioskTicketData + qr opcional). */
function ticketPayloadForBridge(ticket: KioskTicketData): string {
  return JSON.stringify({
    displayNumber: ticket.displayNumber,
    pharmacyName: ticket.pharmacyName,
    totalAmount: ticket.totalAmount,
    currency: ticket.currency,
    paymentStatus: ticket.paymentStatus,
    items: ticket.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
  });
}

function humanPrintError(code: string | undefined, fallback: string): string {
  switch (code) {
    case 'printer_disconnected':
      return 'Impresora desconectada. Comprueba el cable USB e inténtalo de nuevo.';
    case 'usb_permission_required':
      return 'Se necesita permiso USB. Confirma el diálogo del sistema y pulsa Imprimir de nuevo.';
    case 'busy':
      return 'Ya hay una impresión en curso. Espera un momento.';
    case 'rate_limited':
      return 'Espera un momento antes de volver a imprimir.';
    case 'not_connected':
    case 'connect_failed':
      return 'No se pudo conectar con la impresora. Revisa USB y permiso, luego reintenta.';
    case 'print_failed':
      return 'Error al imprimir. El pedido no se ha modificado; puedes reintentar.';
    case 'forbidden':
      return 'Impresión no disponible en este contexto.';
    case 'invalid_payload':
      return 'No se pudo preparar el ticket para imprimir.';
    default:
      return fallback;
  }
}

export function KioskCartView({ pharmacyName }: { pharmacyName: string }) {
  const router = useRouter();
  const { cart, displayTotal, setQuantity, removeLine, clear, itemCount } =
    useKioskCart();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ticket, setTicket] = React.useState<KioskTicketData | null>(null);
  const [printError, setPrintError] = React.useState<string | null>(null);
  const [printing, setPrinting] = React.useState(false);

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

    // Nuevo turno de cliente: invalida turno en servidor + limpia storage.
    await endKioskClientPurchaseSession();
    clear();
    try {
      window.sessionStorage.removeItem(CLIENT_REQUEST_KEY);
    } catch {
      // ignore
    }
  }

  React.useEffect(() => {
    if (!ticket) return;
    const previous = window.onFarmaFacilKioskPrintResult;
    window.onFarmaFacilKioskPrintResult = (result) => {
      setPrinting(false);
      if (result?.ok) {
        setPrintError(null);
        return;
      }
      setPrintError(
        humanPrintError(
          result?.code,
          result?.message ||
            'No se pudo imprimir. El pedido sigue creado; puedes reintentar.'
        )
      );
    };
    return () => {
      window.onFarmaFacilKioskPrintResult = previous;
    };
  }, [ticket]);

  function printTicket() {
    if (!ticket || printing) return;

    const bridge = window.FarmaFacilKiosk;
    if (bridge && typeof bridge.printTicket === 'function') {
      setPrintError(null);
      setPrinting(true);
      try {
        const raw = bridge.printTicket(ticketPayloadForBridge(ticket));
        let ack: FarmaFacilKioskPrintAck = {};
        try {
          ack = JSON.parse(raw) as FarmaFacilKioskPrintAck;
        } catch {
          // ack no JSON: asumir encolado; el callback nativo cerrará el estado
        }
        if (ack.status === 'accepted') {
          // Resultado final vía onFarmaFacilKioskPrintResult; no tocar el pedido.
          return;
        }
        setPrinting(false);
        setPrintError(
          humanPrintError(
            ack.code,
            ack.message ||
              'No se pudo iniciar la impresión. El pedido no se ha modificado.'
          )
        );
      } catch {
        setPrinting(false);
        setPrintError(
          'Error al contactar con la impresora. El pedido no se ha modificado; puedes reintentar.'
        );
      }
      return;
    }

    // Navegador normal (sin APK): impresión CSS.
    setPrintError(null);
    window.print();
  }

  if (ticket) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#e8f7f7] print:block print:bg-white">
        <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-8 sm:px-6 lg:max-w-xl print:max-w-none print:px-0 print:py-0">
          <div className="mb-5 text-center print:hidden">
            <p className="text-sm font-medium text-[#1a9a9d] lg:text-base">
              Pedido creado
            </p>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">
              Pasa por mostrador
            </h1>
          </div>

          <KioskOrderTicket ticket={ticket} />

          {printError ? (
            <p
              className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-center text-base text-amber-950 print:hidden lg:text-lg"
              role="alert"
            >
              {printError}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 print:hidden lg:gap-4">
            <button
              type="button"
              onClick={printTicket}
              disabled={printing}
              className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-lg font-semibold text-white active:scale-[0.99] disabled:opacity-60 lg:h-20 lg:text-xl"
            >
              <Printer className="h-6 w-6 lg:h-7 lg:w-7" />
              {printing ? 'Imprimiendo…' : 'Imprimir ticket'}
            </button>
            <Link
              href="/k"
              className="flex h-16 items-center justify-center rounded-2xl bg-[#2EC4C7] text-lg font-semibold text-white active:scale-[0.99] lg:h-20 lg:text-xl"
            >
              Volver al inicio
            </Link>
            <Link
              href="/k/catalogo"
              className="flex h-14 items-center justify-center rounded-2xl border-2 border-[#2EC4C7] text-base font-semibold text-[#1a9a9d] lg:h-16 lg:text-lg"
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
      <header className="sticky top-0 z-20 border-b border-[#2EC4C7]/25 bg-[#2EC4C7] px-4 pb-4 pt-4 text-white shadow-md sm:px-6 sm:pb-5 sm:pt-5 lg:px-8 lg:pb-6 lg:pt-6">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3 lg:max-w-2xl lg:gap-4">
          <Link
            href="/k/catalogo"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 active:scale-95 lg:h-16 lg:w-16"
            aria-label="Volver al catálogo"
          >
            <ArrowLeft className="h-7 w-7 lg:h-8 lg:w-8" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold lg:text-3xl">Mi carrito</h1>
            <p className="truncate text-sm text-white/80 lg:text-base">
              {pharmacyName}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-5 sm:px-6 lg:max-w-2xl lg:py-6">
        {cart.lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="w-full rounded-3xl bg-white px-6 py-14 text-center shadow lg:px-8 lg:py-16">
              <p className="text-xl font-semibold text-slate-800 lg:text-2xl">
                El carrito está vacío
              </p>
              <p className="mt-2 text-sm text-slate-500 lg:text-base">
                Añade productos desde el buscador.
              </p>
              <Link
                href="/k/catalogo"
                className="mt-8 inline-flex h-14 w-full items-center justify-center rounded-2xl bg-[#2EC4C7] px-8 text-base font-semibold text-white lg:h-16 lg:text-lg"
              >
                Buscar producto
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ul className="space-y-3 lg:space-y-4">
              {cart.lines.map((line) => (
                <li
                  key={line.productId}
                  className="rounded-3xl bg-white p-4 shadow-sm sm:p-5 lg:p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-slate-900 lg:text-xl">
                        {line.name}
                      </p>
                      {line.brand ? (
                        <p className="text-sm text-slate-500 lg:text-base">
                          {line.brand}
                        </p>
                      ) : null}
                      <p className="mt-1 text-base font-medium text-[#1a9a9d] lg:text-lg">
                        {formatEuro(line.unitPrice)} / ud.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(line.productId)}
                      className="flex h-12 w-12 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 lg:h-14 lg:w-14"
                      aria-label={`Eliminar ${line.name}`}
                    >
                      <Trash2 className="h-5 w-5 lg:h-6 lg:w-6" />
                    </button>
                  </div>

                  <div className="mt-4 flex items-center justify-between lg:mt-5">
                    <div className="flex items-center gap-2 lg:gap-3">
                      <button
                        type="button"
                        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-800 active:scale-95 lg:h-16 lg:w-16"
                        onClick={() =>
                          setQuantity(line.productId, line.quantity - 1)
                        }
                        aria-label="Quitar uno"
                      >
                        <Minus className="h-6 w-6 lg:h-7 lg:w-7" />
                      </button>
                      <span className="min-w-[3rem] text-center text-2xl font-bold lg:min-w-[3.5rem] lg:text-3xl">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-800 active:scale-95 disabled:opacity-40 lg:h-16 lg:w-16"
                        disabled={line.quantity >= Math.min(99, line.stock)}
                        onClick={() =>
                          setQuantity(line.productId, line.quantity + 1)
                        }
                        aria-label="Añadir uno"
                      >
                        <Plus className="h-6 w-6 lg:h-7 lg:w-7" />
                      </button>
                    </div>
                    <p className="text-xl font-bold text-slate-900 lg:text-2xl">
                      {formatEuro(
                        Math.round(line.unitPrice * line.quantity * 100) / 100
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {error ? (
              <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-base text-red-700 lg:text-lg">
                {error}
              </p>
            ) : null}

            <div className="sticky bottom-0 mt-auto border-t border-slate-200/80 bg-[#e8f7f7]/95 pb-4 pt-4 backdrop-blur lg:pb-5 lg:pt-5">
              <div className="mb-3 flex items-end justify-between px-1 lg:mb-4">
                <div>
                  <p className="text-sm text-slate-500 lg:text-base">
                    {itemCount} {itemCount === 1 ? 'artículo' : 'artículos'}
                  </p>
                  <p className="text-3xl font-black text-slate-900 lg:text-4xl">
                    {formatEuro(displayTotal)}
                  </p>
                  <p className="text-xs text-slate-500 lg:text-sm">
                    Precio orientativo · se confirma en servidor
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void confirmOrder()}
                className={cn(
                  'flex h-16 w-full items-center justify-center rounded-2xl text-lg font-bold text-white shadow-md active:scale-[0.99] disabled:opacity-60 lg:h-20 lg:text-xl',
                  'bg-[#2EC4C7]'
                )}
              >
                {submitting ? 'Confirmando…' : 'Confirmar pedido'}
              </button>
              <p className="mt-2 text-center text-sm text-amber-800 lg:text-base">
                Pagarás en el mostrador · sin cobro en el kiosko
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
