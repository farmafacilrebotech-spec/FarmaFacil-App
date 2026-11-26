import type { Metadata } from 'next';

import { BrandLogo } from '@/components/brand';
import {
  PRICE_COPY,
  formatLinePriceLabel,
  isPricePending,
} from '@/lib/catalog/price-display';
import { getOrderByAccessToken } from '@/lib/orders/order-access-token';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Estado del pedido · FarmaFácil',
  description: 'Consulta el estado de tu pedido de farmacia.',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

function statusLabel(status: string): string {
  switch (status) {
    case 'pending_payment':
      return 'Pago pendiente en mostrador';
    case 'preparing':
      return 'En preparación';
    case 'ready':
      return 'Listo para recoger';
    case 'delivered':
      return 'Entregado';
    case 'cancelled':
      return 'Cancelado';
    default:
      return status;
  }
}

export default async function PublicOrderStatusPage({
  params,
}: {
  params: { token: string };
}) {
  const token = decodeURIComponent(params.token ?? '').trim();
  const result = await getOrderByAccessToken(token);

  const hasPending =
    result.ok &&
    result.order.items.some((item) => isPricePending(item.unitPrice));
  const valuedSubtotal = result.ok
    ? result.order.items
        .filter((item) => !isPricePending(item.unitPrice))
        .reduce((sum, item) => sum + item.lineTotal, 0)
    : 0;

  return (
    <div className="min-h-screen bg-[#F7F9FA] px-4 py-8">
      <div className="mx-auto mb-6 flex w-full max-w-lg items-center justify-between">
        <BrandLogo size={48} />
      </div>

      {!result.ok ? (
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-[#0B0B0B]">
            Enlace no disponible
          </h1>
          <p className="mt-2 text-sm text-slate-600">{result.error}</p>
          <p className="mt-4 text-sm text-slate-500">
            Acércate al mostrador de tu farmacia si necesitas ayuda.
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-center text-sm font-medium text-[#1ABBB3]">
            {result.order.pharmacyName}
          </p>
          <h1 className="mt-2 text-center text-2xl font-bold text-[#0B0B0B]">
            Pedido {result.order.displayNumber}
          </h1>
          <p className="mt-2 text-center text-base text-slate-700">
            {statusLabel(result.order.orderStatus)}
          </p>

          <ul className="mt-6 space-y-3 border-t border-dashed border-slate-200 pt-4">
            {result.order.items.map((item, idx) => (
              <li
                key={`${item.productName}-${idx}`}
                className="flex justify-between gap-3 text-base"
              >
                <span className="font-medium text-[#0B0B0B]">
                  {item.quantity}× {item.productName}
                </span>
                <span className="shrink-0 font-semibold text-slate-800">
                  {formatLinePriceLabel(item.unitPrice)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t border-dashed border-slate-200 pt-4">
            {hasPending ? (
              <>
                <div className="flex justify-between text-base font-semibold">
                  <span>{PRICE_COPY.valuedSubtotal}</span>
                  <span>
                    {new Intl.NumberFormat('es-ES', {
                      style: 'currency',
                      currency: result.order.currency || 'EUR',
                    }).format(valuedSubtotal)}
                  </span>
                </div>
                <p className="mt-2 text-center text-sm text-amber-800">
                  {PRICE_COPY.definitivePending}
                </p>
              </>
            ) : (
              <div className="flex justify-between text-xl font-bold">
                <span>Total</span>
                <span>
                  {new Intl.NumberFormat('es-ES', {
                    style: 'currency',
                    currency: result.order.currency || 'EUR',
                  }).format(result.order.totalAmount)}
                </span>
              </div>
            )}
          </div>

          {result.order.paymentStatus === 'unpaid' ? (
            <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-center text-base font-semibold text-amber-950">
              Pago pendiente en mostrador
            </p>
          ) : null}

          <p className="mt-6 text-center text-sm text-slate-500">
            Tu farmacia, más cerca de tus clientes
          </p>
        </div>
      )}
    </div>
  );
}
