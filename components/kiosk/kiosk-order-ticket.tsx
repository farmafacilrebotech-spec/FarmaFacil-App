'use client';

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
  createdLabel?: string;
};

/**
 * Vista de ticket imprimible (CSS @media print).
 * No depende de la impresora Android POS todavía.
 */
export function KioskOrderTicket({ ticket }: { ticket: KioskTicketData }) {
  return (
    <div
      id="kiosk-order-ticket"
      className="rounded-3xl bg-white p-6 text-slate-900 shadow-lg print:rounded-none print:shadow-none"
    >
      <div className="border-b border-dashed border-slate-300 pb-4 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          FarmaFácil
        </p>
        <h2 className="mt-1 text-2xl font-bold">{ticket.pharmacyName}</h2>
        <p className="mt-3 text-sm text-slate-500">Número de pedido</p>
        <p className="text-5xl font-black tracking-tight text-[#1a9a9d]">
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
                {formatEuro(item.lineTotal, ticket.currency)}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              {formatEuro(item.unitPrice, ticket.currency)} / ud.
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between text-xl font-bold">
        <span>Total</span>
        <span>{formatEuro(ticket.totalAmount, ticket.currency)}</span>
      </div>

      <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-4 text-center">
        <p className="text-lg font-bold text-amber-900">
          Pago pendiente en mostrador
        </p>
        <p className="mt-1 text-sm text-amber-800">
          Enseña este número en caja. No se ha cobrado ningún importe en el
          kiosko.
        </p>
      </div>

      {ticket.createdLabel ? (
        <p className="mt-4 text-center text-xs text-slate-400">
          {ticket.createdLabel}
        </p>
      ) : null}
    </div>
  );
}
