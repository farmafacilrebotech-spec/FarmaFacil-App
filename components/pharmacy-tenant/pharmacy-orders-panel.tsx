'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';

import {
  getPharmacyOrderDetailAction,
  listPharmacyOrdersAction,
  updatePharmacyOrderPaymentStatusAction,
  updatePharmacyOrderStatusAction,
} from '@/app/f/[pharmacyId]/pedidos/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatEuro,
  nextOrderStatusOptions,
  nextPaymentStatusOptions,
} from '@/lib/orders/labels';
import type {
  OrderStatus,
  PaymentStatus,
  PharmacyOrderDetail,
  PharmacyOrderSummary,
} from '@/lib/orders/types';
import { cn } from '@/lib/utils';

const STATUS_FILTERS: Array<{ value: OrderStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'pending_payment', label: 'Pago pendiente' },
  { value: 'preparing', label: 'Preparación' },
  { value: 'ready', label: 'Listos' },
  { value: 'delivered', label: 'Entregados' },
  { value: 'cancelled', label: 'Cancelados' },
];

function statusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case 'pending_payment':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'preparing':
      return 'bg-sky-50 text-sky-900 border-sky-200';
    case 'ready':
      return 'bg-emerald-50 text-emerald-900 border-emerald-200';
    case 'delivered':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'cancelled':
      return 'bg-red-50 text-red-800 border-red-200';
    default:
      return '';
  }
}

export function PharmacyOrdersPanel({
  pharmacyId,
  initialOrders,
  canManage,
}: {
  pharmacyId: string;
  initialOrders: PharmacyOrderSummary[];
  canManage: boolean;
}) {
  const [orders, setOrders] = React.useState(initialOrders);
  const [filter, setFilter] = React.useState<OrderStatus | 'all'>('all');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<PharmacyOrderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const visible =
    filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  async function refreshList() {
    setError(null);
    const result = await listPharmacyOrdersAction(pharmacyId, { limit: 80 });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOrders(result.orders);
  }

  React.useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoadingDetail(true);
      setError(null);
      const result = await getPharmacyOrderDetailAction(pharmacyId, selectedId!);
      if (cancelled) return;
      setLoadingDetail(false);
      if (!result.ok) {
        setError(result.error);
        setDetail(null);
        return;
      }
      setDetail(result.order);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [pharmacyId, selectedId]);

  async function changeStatus(next: OrderStatus) {
    if (!detail || !canManage) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    const result = await updatePharmacyOrderStatusAction({
      pharmacyId,
      orderId: detail.id,
      newStatus: next,
      currentStatus: detail.status,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(
      result.unchanged
        ? 'Sin cambios.'
        : `Estado operativo → ${ORDER_STATUS_LABELS[result.status]}`
    );
    setDetail((prev) =>
      prev
        ? { ...prev, status: result.status, paymentStatus: result.paymentStatus }
        : prev
    );
    await refreshList();
  }

  async function changePayment(next: PaymentStatus) {
    if (!detail || !canManage) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    const result = await updatePharmacyOrderPaymentStatusAction({
      pharmacyId,
      orderId: detail.id,
      newPaymentStatus: next,
      currentPaymentStatus: detail.paymentStatus,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(
      result.unchanged
        ? 'Sin cambios.'
        : `Pago → ${PAYMENT_STATUS_LABELS[result.paymentStatus]}`
    );
    setDetail((prev) =>
      prev
        ? { ...prev, status: result.status, paymentStatus: result.paymentStatus }
        : prev
    );
    await refreshList();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition',
                  filter === f.value
                    ? 'bg-teal-700 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refreshList()}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Actualizar
          </Button>
        </div>

        {visible.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            No hay pedidos en este filtro para esta farmacia.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(order.id)}
                  className={cn(
                    'flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition hover:bg-muted/40',
                    selectedId === order.id && 'bg-muted/50'
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-semibold tabular-nums text-foreground">
                      #{order.displayNumber}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleString('es-ES')} ·{' '}
                      {order.source}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={statusBadgeClass(order.status)}
                      >
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                      <Badge variant="secondary">
                        {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                      </Badge>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">
                    {formatEuro(order.totalAmount, order.currency)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="min-w-0 p-5">
        {!selectedId ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Selecciona un pedido para ver el detalle.
          </p>
        ) : loadingDetail ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Cargando detalle…
          </p>
        ) : !detail ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No se ha podido cargar el pedido.
          </p>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pedido
              </p>
              <h2 className="text-2xl font-bold tabular-nums">
                #{detail.displayNumber}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatEuro(detail.totalAmount, detail.currency)} ·{' '}
                {new Date(detail.createdAt).toLocaleString('es-ES')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Estado operativo</p>
                <p className="mt-1 font-semibold">
                  {ORDER_STATUS_LABELS[detail.status]}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Estado de pago</p>
                <p className="mt-1 font-semibold">
                  {PAYMENT_STATUS_LABELS[detail.paymentStatus]}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Líneas</p>
              <ul className="space-y-2">
                {detail.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm"
                  >
                    <span>
                      {item.quantity}× {item.productName}
                    </span>
                    <span className="shrink-0 font-medium">
                      {formatEuro(item.lineTotal, detail.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {canManage ? (
              <div className="space-y-4 border-t border-border pt-4">
                <div>
                  <p className="mb-2 text-sm font-medium">Cambiar estado operativo</p>
                  <div className="flex flex-wrap gap-2">
                    {nextOrderStatusOptions(detail.status).map((next) => (
                      <Button
                        key={next}
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void changeStatus(next)}
                      >
                        {ORDER_STATUS_LABELS[next]}
                      </Button>
                    ))}
                    {nextOrderStatusOptions(detail.status).length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Sin transiciones disponibles.
                      </p>
                    ) : null}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Cambiar estado de pago</p>
                  <div className="flex flex-wrap gap-2">
                    {nextPaymentStatusOptions(detail.paymentStatus).map(
                      (next) => (
                        <Button
                          key={next}
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void changePayment(next)}
                        >
                          {PAYMENT_STATUS_LABELS[next]}
                        </Button>
                      )
                    )}
                    {nextPaymentStatusOptions(detail.paymentStatus).length ===
                    0 ? (
                      <p className="text-xs text-muted-foreground">
                        Sin transiciones de pago disponibles.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Tu rol puede ver pedidos, pero no cambiar estados
                (`orders.manage`).
              </p>
            )}

            {message ? (
              <p className="text-sm text-emerald-700">{message}</p>
            ) : null}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
          </div>
        )}
      </Card>
    </div>
  );
}
