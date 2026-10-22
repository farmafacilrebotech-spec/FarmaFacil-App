'use client';

import * as React from 'react';
import { MessageCircle, RefreshCw } from 'lucide-react';

import {
  confirmPharmacyOrderAmountAction,
  getPharmacyOrderDetailAction,
  listPharmacyOrdersAction,
  updatePharmacyOrderPaymentStatusAction,
  updatePharmacyOrderStatusAction,
} from '@/app/f/[pharmacyId]/pedidos/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ORDER_SOURCE_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatOrderAmount,
  formatEuro,
  isPublicQrAmountPending,
  nextOrderStatusOptions,
  nextPaymentStatusOptionsForOrder,
} from '@/lib/orders/labels';
import { canConfirmOrderAmount } from '@/lib/orders/public-qr-display';
import type {
  OrderStatus,
  PaymentStatus,
  PharmacyOrderDetail,
  PharmacyOrderSummary,
} from '@/lib/orders/types';
import { buildManualPickupWhatsAppLink } from '@/lib/orders/whatsapp-notify';
import { cn } from '@/lib/utils';

const STATUS_FILTERS: Array<{ value: OrderStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'request_pending', label: 'Solicitudes' },
  { value: 'pending_payment', label: 'Pago pendiente' },
  { value: 'preparing', label: 'Preparación' },
  { value: 'ready', label: 'Listos' },
  { value: 'delivered', label: 'Entregados' },
  { value: 'cancelled', label: 'Cancelados' },
];

function statusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case 'request_pending':
      return 'bg-violet-50 text-violet-900 border-violet-200';
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

function amountInputDefault(order: PharmacyOrderDetail): string {
  if (!order.amountConfirmedAt) return '';
  return order.totalAmount.toFixed(2);
}

export function PharmacyOrdersPanel({
  pharmacyId,
  pharmacyName,
  initialOrders,
  canManage,
}: {
  pharmacyId: string;
  pharmacyName: string;
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
  const [amountDraft, setAmountDraft] = React.useState('');
  const [whatsappError, setWhatsappError] = React.useState<string | null>(null);

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
      setWhatsappError(null);
      const result = await getPharmacyOrderDetailAction(pharmacyId, selectedId!);
      if (cancelled) return;
      setLoadingDetail(false);
      if (!result.ok) {
        setError(result.error);
        setDetail(null);
        return;
      }
      setDetail(result.order);
      setAmountDraft(amountInputDefault(result.order));
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

  async function confirmAmount() {
    if (!detail || !canManage) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    const result = await confirmPharmacyOrderAmountAction({
      pharmacyId,
      orderId: detail.id,
      amount: Number(String(amountDraft).trim().replace(',', '.')),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(
      result.unchanged
        ? 'Importe ya confirmado (sin cambios).'
        : `Importe total confirmado: ${formatEuro(result.totalAmount, detail.currency)}. El pedido sigue sin cobrar.`
    );
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            totalAmount: result.totalAmount,
            paymentStatus: result.paymentStatus,
            status: result.status,
            amountConfirmedAt: result.amountConfirmedAt,
          }
        : prev
    );
    setAmountDraft(result.totalAmount.toFixed(2));
    await refreshList();
  }

  function openWhatsApp() {
    if (!detail) return;
    setWhatsappError(null);
    const confirmed =
      detail.amountConfirmedAt != null ? detail.totalAmount : null;
    const built = buildManualPickupWhatsAppLink({
      pharmacyName,
      displayNumber: detail.displayNumber,
      customerPhone: detail.customerPhone,
      confirmedAmountEuro: confirmed,
      currency: detail.currency,
    });
    if (!built.ok) {
      setWhatsappError(built.error);
      return;
    }
    window.open(built.href, '_blank', 'noopener,noreferrer');
  }

  const amountPending = detail
    ? isPublicQrAmountPending({
        amount: detail.totalAmount,
        source: detail.source,
        paymentStatus: detail.paymentStatus,
        orderStatus: detail.status,
        amountConfirmedAt: detail.amountConfirmedAt,
      })
    : false;

  const showConfirmAmount =
    canManage &&
    detail &&
    detail.source === 'public_qr' &&
    canConfirmOrderAmount(detail.status);

  const showWhatsApp =
    detail &&
    detail.source === 'public_qr' &&
    detail.status === 'ready';

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
                      {ORDER_SOURCE_LABELS[order.source] ?? order.source}
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
                  <p className="shrink-0 max-w-[11rem] text-right text-sm font-semibold leading-snug">
                    {formatOrderAmount({
                      amount: order.totalAmount,
                      currency: order.currency,
                      source: order.source,
                      paymentStatus: order.paymentStatus,
                      orderStatus: order.status,
                      amountConfirmedAt: order.amountConfirmedAt,
                    })}
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
          <div className="space-y-2 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No se ha podido cargar el pedido.
            </p>
            {error ? (
              <p className="mx-auto max-w-sm text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {detail.source === 'public_qr' ? 'Solicitud' : 'Pedido'}
              </p>
              <h2 className="text-2xl font-bold tabular-nums">
                #{detail.displayNumber}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {ORDER_SOURCE_LABELS[detail.source] ?? detail.source} ·{' '}
                {new Date(detail.createdAt).toLocaleString('es-ES')}
              </p>
              {detail.amountConfirmedAt ? (
                <div className="mt-2 space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">
                    Importe total confirmado:{' '}
                    {formatEuro(detail.totalAmount, detail.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Confirmado el{' '}
                    {new Date(detail.amountConfirmedAt).toLocaleString('es-ES')}
                    . Sigue sin cobrar hasta que marques «Cobrado» en mostrador.
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm font-medium text-foreground">
                  {formatOrderAmount({
                    amount: detail.totalAmount,
                    currency: detail.currency,
                    source: detail.source,
                    paymentStatus: detail.paymentStatus,
                    orderStatus: detail.status,
                    amountConfirmedAt: detail.amountConfirmedAt,
                  })}
                </p>
              )}
            </div>

            {(detail.customerName ||
              detail.customerPhone ||
              detail.customerNote) && (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Contacto (catálogo QR)
                </p>
                {detail.customerName ? (
                  <p className="mt-1 text-sm font-semibold">{detail.customerName}</p>
                ) : null}
                {detail.customerPhone ? (
                  <p className="mt-0.5 text-sm tabular-nums text-foreground">
                    {detail.customerPhone}
                  </p>
                ) : null}
                {detail.customerNote ? (
                  <p className="mt-2 text-sm text-foreground">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Nota:{' '}
                    </span>
                    {detail.customerNote}
                  </p>
                ) : null}
              </div>
            )}

            {detail.source === 'public_qr' &&
            detail.status === 'request_pending' &&
            amountPending ? (
              <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-950">
                Solicitud: confirma disponibilidad pasando a «En preparación» y
                confirma el importe total cuando lo tengas. El 0 € técnico no es
                un precio. Tras confirmar el importe el pedido sigue sin cobrar.
              </p>
            ) : null}

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
                      {detail.source === 'public_qr' && amountPending
                        ? 'Pendiente'
                        : formatEuro(item.lineTotal, detail.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {showConfirmAmount ? (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Importe total confirmado</p>
                <p className="text-xs text-muted-foreground">
                  Introduce el total en euros (2 decimales). No modifica precios
                  del catálogo. Tras confirmar, el pedido permanece sin cobrar.
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[8rem] flex-1">
                    <label
                      htmlFor={`confirm-amount-${detail.id}`}
                      className="sr-only"
                    >
                      Importe total en euros
                    </label>
                    <Input
                      id={`confirm-amount-${detail.id}`}
                      type="text"
                      inputMode="decimal"
                      placeholder="12,50"
                      value={amountDraft}
                      disabled={busy}
                      onChange={(e) => setAmountDraft(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || !amountDraft.trim()}
                    onClick={() => void confirmAmount()}
                  >
                    {detail.amountConfirmedAt
                      ? 'Actualizar importe'
                      : 'Confirmar importe'}
                  </Button>
                </div>
              </div>
            ) : null}

            {showWhatsApp ? (
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={openWhatsApp}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Avisar al cliente por WhatsApp
                </Button>
                <p className="text-xs text-muted-foreground">
                  Abre WhatsApp con un mensaje editable. No se envía solo ni se
                  marca como enviado.
                </p>
                {whatsappError ? (
                  <p className="text-sm text-red-700" role="alert">
                    {whatsappError}
                  </p>
                ) : null}
              </div>
            ) : null}

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
                    {nextPaymentStatusOptionsForOrder({
                      source: detail.source,
                      paymentStatus: detail.paymentStatus,
                      totalAmount: detail.totalAmount,
                      orderStatus: detail.status,
                      amountConfirmedAt: detail.amountConfirmedAt,
                    }).map((next) => (
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
                    ))}
                    {nextPaymentStatusOptionsForOrder({
                      source: detail.source,
                      paymentStatus: detail.paymentStatus,
                      totalAmount: detail.totalAmount,
                      orderStatus: detail.status,
                      amountConfirmedAt: detail.amountConfirmedAt,
                    }).length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Sin transiciones de pago disponibles.
                      </p>
                    ) : null}
                  </div>
                  {amountPending ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Confirma el importe total antes de poder marcar «Cobrado».
                      Mientras tanto puedes usar «Sin cobrar» o «Exento».
                    </p>
                  ) : null}
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
