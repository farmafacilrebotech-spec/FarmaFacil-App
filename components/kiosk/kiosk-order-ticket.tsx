'use client';

import { BrandLogo } from '@/components/brand';
import { ScannableQr } from '@/components/kiosk/scannable-qr';
import {
  PRICE_COPY,
  formatLinePriceLabel,
  isPricePending,
} from '@/lib/catalog/price-display';
import { formatEuro } from '@/lib/orders/labels';

export type KioskTicketData = {
  displayNumber: string;
  pharmacyName: string;
  totalAmount: number;
  currency: string;
  paymentStatus: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  /** URL opaca /o/{token} para el QR. */
  accessUrl?: string | null;
  createdLabel?: string;
};

/**
 * Vista de ticket (pantalla + CSS @media print).
 * El ticket térmico nativo (ICOD) usa el mismo contenido vía bridge.
 */
export function KioskOrderTicket({ ticket }: { ticket: KioskTicketData }) {
  const hasPending = ticket.items.some((item) =>
    isPricePending(item.unitPrice)
  );
  const valuedSubtotal = ticket.items
    .filter((item) => !isPricePending(item.unitPrice))
    .reduce((sum, item) => sum + item.lineTotal, 0);
  const unpaid = ticket.paymentStatus === 'unpaid' || !ticket.paymentStatus;

  return (
    <div
      id="kiosk-order-ticket"
      className="rounded-3xl bg-white p-6 text-[#0B0B0B] shadow-lg print:rounded-none print:shadow-none"
    >
      <div className="border-b border-dashed border-slate-300 pb-4 text-center">
        <div className="flex justify-center">
          <BrandLogo size={72} />
        </div>
        <h2 className="mt-3 text-2xl font-bold">{ticket.pharmacyName}</h2>
        <p className="mt-3 text-sm text-slate-500">Número de pedido</p>
        <p className="text-5xl font-black tracking-tight text-[#1ABBB3]">
          {ticket.displayNumber}
        </p>
      </div>

      <ul className="mt-4 space-y-3 border-b border-dashed border-slate-300 pb-4">
        {ticket.items.map((item, idx) => (
          <li key={`${item.productName}-${idx}`} className="text-base">
            <div className="flex justify-between gap-3">
              <span className="font-medium">
                {item.quantity}× {item.productName}
              </span>
              <span className="shrink-0 font-semibold">
                {formatLinePriceLabel(item.unitPrice)}
              </span>
            </div>
            {!isPricePending(item.unitPrice) ? (
              <p className="text-sm text-slate-500">
                {formatEuro(item.unitPrice, ticket.currency)} / ud.
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-2">
        {hasPending ? (
          <>
            <div className="flex items-center justify-between text-lg font-bold">
              <span>{PRICE_COPY.valuedSubtotal}</span>
              <span>{formatEuro(valuedSubtotal, ticket.currency)}</span>
            </div>
            <p className="text-center text-sm font-medium text-amber-800">
              {PRICE_COPY.definitivePending}
            </p>
          </>
        ) : (
          <div className="flex items-center justify-between text-xl font-bold">
            <span>Total</span>
            <span>{formatEuro(ticket.totalAmount, ticket.currency)}</span>
          </div>
        )}
      </div>

      {unpaid ? (
        <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-4 text-center">
          <p className="text-lg font-bold text-amber-900">
            Pago pendiente en mostrador
          </p>
        </div>
      ) : null}

      {ticket.accessUrl ? (
        <div className="mt-6 flex flex-col items-center gap-3">
          <ScannableQr value={ticket.accessUrl} size={200} />
          <p className="text-center text-base font-medium text-slate-700">
            Consulta el estado de tu pedido
          </p>
        </div>
      ) : (
        <p className="mt-6 text-center text-sm text-amber-800">
          El enlace seguro de seguimiento no está disponible en este momento.
          El ticket se imprimirá sin QR.
        </p>
      )}

      <p className="mt-5 text-center text-sm italic text-slate-500">
        Tu farmacia, más cerca de tus clientes
      </p>

      {ticket.createdLabel ? (
        <p className="mt-4 text-center text-xs text-slate-400">
          {ticket.createdLabel}
        </p>
      ) : null}
    </div>
  );
}
