'use client';

import * as React from 'react';
import { ArrowLeft, MessageCircle, RefreshCw } from 'lucide-react';

import {
  confirmPublicQrLineValuationAction,
  getPharmacyOrderDetailAction,
  issuePublicQrQuoteLinkAction,
  listPharmacyOrderQuoteEventsAction,
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
import {
  filterOrderStatusOptionsForPublicQr,
  isLegacyTotalOnlyPublicQr,
  validatePublicQrLineValuation,
} from '@/lib/orders/line-valuation';
import { canConfirmOrderAmount } from '@/lib/orders/public-qr-display';
import { QUOTE_EVENT_TYPE_LABELS } from '@/lib/orders/quote-event-labels';
import type { PharmacyOrderQuoteEvent } from '@/lib/orders/quote-events';
import {
  QUOTE_BUDGET_STATUS_LABELS,
  canIssueQuoteLink,
  deriveQuoteBudgetStatus,
  valuationLockedByStatus,
  valuationNeedsExplicitRevision,
} from '@/lib/orders/quote-status';
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

type LineDraft = {
  availability: 'available' | 'unavailable' | 'pending';
  unitPrice: string;
  staffNote: string;
};

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

function draftsFromOrder(order: PharmacyOrderDetail): Record<string, LineDraft> {
  const next: Record<string, LineDraft> = {};
  for (const item of order.items) {
    const availability =
      item.availabilityStatus === 'available' ||
      item.availabilityStatus === 'unavailable'
        ? item.availabilityStatus
        : 'pending';
    next[item.id] = {
      availability,
      unitPrice:
        availability === 'available' && item.unitPrice > 0
          ? item.unitPrice.toFixed(2)
          : '',
      staffNote: item.staffNote ?? '',
    };
  }
  return next;
}

function previewTotal(
  order: PharmacyOrderDetail,
  drafts: Record<string, LineDraft>
): number | null {
  const submitted = order.items.map((item) => {
    const d = drafts[item.id];
    const availability =
      d?.availability === 'available' || d?.availability === 'unavailable'
        ? d.availability
        : null;
    const unitPrice = Number(String(d?.unitPrice ?? '').trim().replace(',', '.'));
    return {
      itemId: item.id,
      availability: availability as 'available' | 'unavailable',
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
      staffNote: d?.staffNote ?? null,
    };
  });
  if (submitted.some((s) => !s.availability)) return null;
  const validated = validatePublicQrLineValuation({
    existingLines: order.items.map((i) => ({
      itemId: i.id,
      quantity: i.quantity,
    })),
    submitted: submitted.map((s) => ({
      itemId: s.itemId,
      availability: s.availability!,
      unitPrice: s.unitPrice,
      staffNote: s.staffNote,
    })),
  });
  return validated.ok ? validated.totalAmount : null;
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
  /** Pedido en vista detalle; null = vista listado. */
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  /** Resaltado en listado tras «Volver» (no abre detalle). */
  const [lastViewedId, setLastViewedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<PharmacyOrderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [quoteLinkUrl, setQuoteLinkUrl] = React.useState<string | null>(null);
  const [quoteEvents, setQuoteEvents] = React.useState<
    PharmacyOrderQuoteEvent[]
  >([]);
  const [quoteEventsAvailable, setQuoteEventsAvailable] = React.useState(false);
  const [confirmRevision, setConfirmRevision] = React.useState(false);
  const [whatsappError, setWhatsappError] = React.useState<string | null>(null);
  const [lineDrafts, setLineDrafts] = React.useState<Record<string, LineDraft>>(
    {}
  );
  const rootRef = React.useRef<HTMLDivElement>(null);
  const savedScrollYRef = React.useRef(0);

  const visible =
    filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  const showingDetail = selectedId != null;

  function openOrder(orderId: string) {
    savedScrollYRef.current = window.scrollY;
    setLastViewedId(orderId);
    setSelectedId(orderId);
    setLoadingDetail(true);
    setDetail(null);
    setError(null);
    setMessage(null);
    requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function backToList() {
    setSelectedId(null);
    setDetail(null);
    setLoadingDetail(false);
    setError(null);
    setWhatsappError(null);
    setQuoteLinkUrl(null);
    setQuoteEvents([]);
    setQuoteEventsAvailable(false);
    setConfirmRevision(false);
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollYRef.current, behavior: 'auto' });
    });
  }

  async function refreshList(options?: { preserveSuccessMessage?: boolean }) {
    const result = await listPharmacyOrdersAction(pharmacyId, { limit: 80 });
    if (!result.ok) {
      // No pisar un OK de valoración con un fallo de listado.
      if (!options?.preserveSuccessMessage) {
        setError(result.error);
      }
      return;
    }
    setOrders(result.orders);
  }

  React.useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setLoadingDetail(false);
      setQuoteEvents([]);
      setQuoteEventsAvailable(false);
      return;
    }
    let cancelled = false;
    const orderId = selectedId;
    async function load() {
      setLoadingDetail(true);
      setError(null);
      setWhatsappError(null);
      setQuoteLinkUrl(null);
      setQuoteEvents([]);
      setQuoteEventsAvailable(false);
      setConfirmRevision(false);
      try {
        const result = await getPharmacyOrderDetailAction(pharmacyId, orderId);
        if (cancelled) return;
        if (!result.ok) {
          setError(result.error);
          setDetail(null);
          return;
        }
        setDetail(result.order);
        setLineDrafts(draftsFromOrder(result.order));
        if (result.order.source === 'public_qr') {
          const hist = await listPharmacyOrderQuoteEventsAction({
            pharmacyId,
            orderId: result.order.id,
          });
          if (cancelled) return;
          if (hist.ok) {
            setQuoteEvents(hist.events);
            setQuoteEventsAvailable(hist.available);
          }
        }
      } catch {
        if (cancelled) return;
        setError('No se ha podido cargar el detalle del pedido.');
        setDetail(null);
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
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

  async function confirmValuation() {
    if (!detail || !canManage) return;
    setBusy(true);
    setMessage(null);
    setError(null);

    const lines = detail.items.map((item) => {
      const d = lineDrafts[item.id];
      const availability =
        d?.availability === 'available' || d?.availability === 'unavailable'
          ? d.availability
          : ('pending' as const);
      const unitPrice = Number(
        String(d?.unitPrice ?? '')
          .trim()
          .replace(',', '.')
      );
      return {
        itemId: item.id,
        availability,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
        staffNote: d?.staffNote?.trim() ? d.staffNote.trim() : null,
      };
    });

    if (lines.some((l) => l.availability === 'pending')) {
      setBusy(false);
      setError('Indica disponibilidad en todas las líneas antes de confirmar.');
      return;
    }

    const needsRevision = valuationNeedsExplicitRevision({
      source: detail.source,
      customerAcceptedAt: detail.customerAcceptedAt,
      status: detail.status,
    });
    if (needsRevision && !confirmRevision) {
      setBusy(false);
      setError(
        'Este presupuesto ya fue aceptado. Marca «Confirmar revisión» para invalidar la aceptación y generar una nueva versión.'
      );
      return;
    }

    const result = await confirmPublicQrLineValuationAction({
      pharmacyId,
      orderId: detail.id,
      expectedUpdatedAt: detail.updatedAt,
      allowRevision: needsRevision && confirmRevision,
      lines: lines.map((l) => ({
        itemId: l.itemId,
        availability: l.availability as 'available' | 'unavailable',
        unitPrice: l.unitPrice,
        staffNote: l.staffNote,
      })),
    });

    if (!result.ok) {
      // Conflicto real: recargar datos del servidor sin sobrescribir a ciegas.
      if (result.code === 'concurrent_modification') {
        const latest = await getPharmacyOrderDetailAction(
          pharmacyId,
          detail.id
        );
        if (latest.ok) {
          setDetail(latest.order);
          setLineDrafts(draftsFromOrder(latest.order));
        }
        await refreshList();
      }
      setBusy(false);
      setError(result.error);
      return;
    }

    const successMessage = result.awaitingCustomerAcceptance
      ? `Valoración confirmada: ${formatEuro(result.totalAmount, detail.currency)}. Presupuesto pendiente de aceptación del cliente (sin cobro).`
      : `Valoración confirmada: ${formatEuro(result.totalAmount, detail.currency)}.`;

    // Siempre rehidratar desde servidor para sincronizar updatedAt / líneas / total.
    const refreshed = await getPharmacyOrderDetailAction(pharmacyId, detail.id);
    if (refreshed.ok) {
      setDetail(refreshed.order);
      setLineDrafts(draftsFromOrder(refreshed.order));
    } else {
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              totalAmount: result.totalAmount,
              paymentStatus: result.paymentStatus,
              status: result.status,
              amountConfirmedAt: result.amountConfirmedAt,
              linesValuedAt: result.linesValuedAt,
              customerAcceptedAt: result.customerAcceptedAt,
              // Evita falsos concurrent_modification en el siguiente guardado.
              updatedAt: result.updatedAt ?? prev.updatedAt,
            }
          : prev
      );
    }

    setMessage(successMessage);
    setError(null);
    setConfirmRevision(false);
    setQuoteLinkUrl(null);
    const histAfterValuation = await listPharmacyOrderQuoteEventsAction({
      pharmacyId,
      orderId: detail.id,
    });
    if (histAfterValuation.ok) {
      setQuoteEvents(histAfterValuation.events);
      setQuoteEventsAvailable(histAfterValuation.available);
    }
    await refreshList({ preserveSuccessMessage: true });
    setBusy(false);
  }

  async function copyQuoteLink() {
    if (!detail || !canManage) return;
    setBusy(true);
    setError(null);
    const result = await issuePublicQrQuoteLinkAction({
      pharmacyId,
      orderId: detail.id,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setQuoteLinkUrl(result.url);
    const histAfterIssue = await listPharmacyOrderQuoteEventsAction({
      pharmacyId,
      orderId: detail.id,
    });
    if (histAfterIssue.ok) {
      setQuoteEvents(histAfterIssue.events);
      setQuoteEventsAvailable(histAfterIssue.available);
    }
    try {
      await navigator.clipboard.writeText(result.url);
      setMessage(
        `Enlace copiado (v${result.quoteVersion}). Caduca: ${new Date(result.expiresAt).toLocaleString('es-ES')}. No se envía automáticamente.`
      );
    } catch {
      setMessage(
        `Enlace generado (v${result.quoteVersion}). Cópialo manualmente; no se envía automáticamente.`
      );
    }
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

  const legacyTotalOnly = detail
    ? isLegacyTotalOnlyPublicQr({
        source: detail.source,
        quoteLegacyTotalOnly: detail.quoteLegacyTotalOnly,
        amountConfirmedAt: detail.amountConfirmedAt,
        linesValuedAt: detail.linesValuedAt,
        items: detail.items,
      })
    : false;

  const quoteStatus = detail
    ? deriveQuoteBudgetStatus({
        source: detail.source,
        quoteLegacyTotalOnly: detail.quoteLegacyTotalOnly,
        linesValuedAt: detail.linesValuedAt,
        customerAcceptedAt: detail.customerAcceptedAt,
        customerRejectedAt: detail.customerRejectedAt,
        quoteExpiresAt: detail.quoteExpiresAt,
      })
    : null;

  const showLineValuation =
    canManage &&
    detail &&
    detail.source === 'public_qr' &&
    canConfirmOrderAmount(detail.status) &&
    !legacyTotalOnly &&
    !valuationLockedByStatus(detail.status);

  const showQuoteLink =
    canManage &&
    detail &&
    canIssueQuoteLink({
      source: detail.source,
      quoteLegacyTotalOnly: detail.quoteLegacyTotalOnly,
      linesValuedAt: detail.linesValuedAt,
      customerAcceptedAt: detail.customerAcceptedAt,
      customerRejectedAt: detail.customerRejectedAt,
      quoteExpiresAt: detail.quoteExpiresAt,
      status: detail.status,
    });

  const showWhatsApp =
    detail && detail.source === 'public_qr' && detail.status === 'ready';

  const statusOptions = detail
    ? (filterOrderStatusOptionsForPublicQr({
        source: detail.source,
        status: detail.status,
        linesValuedAt: detail.linesValuedAt,
        customerAcceptedAt: detail.customerAcceptedAt,
        customerRejectedAt: detail.customerRejectedAt,
        quoteLegacyTotalOnly: detail.quoteLegacyTotalOnly,
        options: nextOrderStatusOptions(detail.status),
      }) as OrderStatus[])
    : [];

  const liveTotal =
    detail && showLineValuation ? previewTotal(detail, lineDrafts) : null;

  return (
    <div ref={rootRef} className="min-w-0 space-y-4">
      {!showingDetail ? (
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
                  onClick={() => openOrder(order.id)}
                  className={cn(
                    'flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition hover:bg-muted/40',
                    lastViewedId === order.id && 'bg-muted/50'
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
                      {order.source === 'public_qr'
                        ? (() => {
                            const qs = deriveQuoteBudgetStatus({
                              source: order.source,
                              quoteLegacyTotalOnly: order.quoteLegacyTotalOnly,
                              linesValuedAt: order.linesValuedAt,
                              customerAcceptedAt: order.customerAcceptedAt,
                              customerRejectedAt: order.customerRejectedAt,
                              quoteExpiresAt: order.quoteExpiresAt,
                            });
                            if (
                              qs === 'not_applicable' ||
                              qs === 'legacy'
                            ) {
                              return null;
                            }
                            return (
                              <Badge variant="outline" className="text-[10px]">
                                {QUOTE_BUDGET_STATUS_LABELS[qs]}
                              </Badge>
                            );
                          })()
                        : null}
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
      ) : (
      <Card className="min-w-0 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={backToList}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a pedidos
          </Button>
          {detail ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              #{detail.displayNumber}
            </p>
          ) : null}
        </div>

        {loadingDetail ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Cargando detalle…
          </p>
        ) : error && !detail ? (
          <div className="space-y-4 py-6 text-center">
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
            <p className="text-sm text-muted-foreground">
              No se ha podido cargar el detalle.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={backToList}>
              Volver a pedidos
            </Button>
          </div>
        ) : !detail ? (
          <div className="space-y-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              No se ha podido cargar el detalle.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={backToList}>
              Volver a pedidos
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {detail.source === 'public_qr' ? 'Solicitud' : 'Pedido'}
              </p>
              <h2 className="text-xl font-semibold tabular-nums">
                #{detail.displayNumber}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {ORDER_SOURCE_LABELS[detail.source]} ·{' '}
                {new Date(detail.createdAt).toLocaleString('es-ES')}
              </p>
            </div>

            {detail.source === 'public_qr' &&
            (detail.customerName || detail.customerPhone) ? (
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                {detail.customerName ? (
                  <p className="text-sm font-medium text-foreground">
                    {detail.customerName}
                  </p>
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
            ) : null}

            {detail.source === 'public_qr' && quoteStatus && quoteStatus !== 'not_applicable' ? (
              <div className="space-y-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">Presupuesto:</span>
                  <Badge variant="outline" className="text-xs">
                    {QUOTE_BUDGET_STATUS_LABELS[quoteStatus]}
                  </Badge>
                  {detail.quoteVersion > 0 ? (
                    <span className="text-muted-foreground">
                      Versión {detail.quoteVersion}
                    </span>
                  ) : null}
                </div>
                {detail.quoteExpiresAt ? (
                  <p className="text-muted-foreground">
                    Caducidad:{' '}
                    {new Date(detail.quoteExpiresAt).toLocaleString('es-ES')}
                  </p>
                ) : null}
                {detail.customerAcceptedAt ? (
                  <p className="text-emerald-800">
                    Aceptado:{' '}
                    {new Date(detail.customerAcceptedAt).toLocaleString('es-ES')}
                  </p>
                ) : null}
                {detail.customerRejectedAt ? (
                  <p className="text-rose-800">
                    Rechazado:{' '}
                    {new Date(detail.customerRejectedAt).toLocaleString('es-ES')}
                  </p>
                ) : null}
                {quoteStatus === 'pending_acceptance' ? (
                  <p className="text-amber-950">
                    La valoración no implica cobro. No se puede pasar a
                    preparación hasta que el cliente acepte.
                  </p>
                ) : null}
                {quoteEventsAvailable && quoteEvents.length > 0 ? (
                  <div className="mt-2 border-t border-border pt-2">
                    <p className="mb-1 font-medium text-foreground">
                      Historial de presupuesto
                    </p>
                    <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px] text-muted-foreground">
                      {quoteEvents.map((ev) => (
                        <li key={ev.id} className="flex flex-wrap gap-x-2">
                          <span className="tabular-nums">
                            {new Date(ev.createdAt).toLocaleString('es-ES')}
                          </span>
                          <span>
                            {QUOTE_EVENT_TYPE_LABELS[ev.eventType] ??
                              ev.eventType}
                          </span>
                          <span>v{ev.quoteVersion}</span>
                          {ev.totalAmount != null ? (
                            <span className="tabular-nums">
                              {formatEuro(ev.totalAmount, detail.currency)}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {legacyTotalOnly ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
                Pedido histórico: importe total confirmado (
                {formatEuro(detail.totalAmount, detail.currency)}) sin desglose
                por línea. No se modifica automáticamente.
              </p>
            ) : null}

            {detail.source === 'public_qr' &&
            detail.status === 'request_pending' &&
            amountPending &&
            !legacyTotalOnly ? (
              <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-950">
                Indica disponibilidad y precio unitario de cada producto. El
                total se calcula automáticamente. El 0 € técnico no es un precio.
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

            {showLineValuation ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">Valoración por producto</p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Producto</th>
                        <th className="px-3 py-2 font-medium">Cant.</th>
                        <th className="px-3 py-2 font-medium">Disponibilidad</th>
                        <th className="px-3 py-2 font-medium">P. unitario</th>
                        <th className="px-3 py-2 font-medium">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detail.items.map((item) => {
                        const draft = lineDrafts[item.id] ?? {
                          availability: 'pending' as const,
                          unitPrice: '',
                          staffNote: '',
                        };
                        const unit = Number(
                          String(draft.unitPrice).trim().replace(',', '.')
                        );
                        const sub =
                          draft.availability === 'available' &&
                          Number.isFinite(unit) &&
                          unit > 0
                            ? Math.round(unit * item.quantity * 100) / 100
                            : null;
                        return (
                          <React.Fragment key={item.id}>
                            <tr>
                              <td className="px-3 py-2 align-top">
                                <p className="font-medium text-foreground">
                                  {item.productName}
                                </p>
                              </td>
                              <td className="px-3 py-2 align-top tabular-nums">
                                {item.quantity}
                              </td>
                              <td className="px-3 py-2 align-top">
                                <select
                                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                                  value={draft.availability}
                                  disabled={busy}
                                  onChange={(e) => {
                                    const availability = e.target
                                      .value as LineDraft['availability'];
                                    setLineDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...draft,
                                        availability,
                                        unitPrice:
                                          availability === 'unavailable'
                                            ? ''
                                            : draft.unitPrice,
                                      },
                                    }));
                                  }}
                                >
                                  <option value="pending">Pendiente</option>
                                  <option value="available">Disponible</option>
                                  <option value="unavailable">
                                    No disponible
                                  </option>
                                </select>
                              </td>
                              <td className="px-3 py-2 align-top">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="0,00"
                                  disabled={
                                    busy || draft.availability !== 'available'
                                  }
                                  value={draft.unitPrice}
                                  onChange={(e) =>
                                    setLineDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...draft,
                                        unitPrice: e.target.value,
                                      },
                                    }))
                                  }
                                  className="h-8 w-[6.5rem] text-xs"
                                />
                              </td>
                              <td className="px-3 py-2 align-top tabular-nums text-xs font-medium">
                                {draft.availability === 'unavailable'
                                  ? '—'
                                  : sub != null
                                    ? formatEuro(sub, detail.currency)
                                    : '—'}
                              </td>
                            </tr>
                            <tr className="bg-muted/10">
                              <td colSpan={5} className="px-3 pb-3">
                                <label className="sr-only" htmlFor={`note-${item.id}`}>
                                  Observación {item.productName}
                                </label>
                                <Input
                                  id={`note-${item.id}`}
                                  type="text"
                                  maxLength={280}
                                  placeholder="Observación opcional"
                                  disabled={busy}
                                  value={draft.staffNote}
                                  onChange={(e) =>
                                    setLineDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...draft,
                                        staffNote: e.target.value,
                                      },
                                    }))
                                  }
                                  className="h-8 text-xs"
                                />
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {valuationNeedsExplicitRevision({
                  source: detail.source,
                  customerAcceptedAt: detail.customerAcceptedAt,
                  status: detail.status,
                }) ? (
                  <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={confirmRevision}
                      disabled={busy}
                      onChange={(e) => setConfirmRevision(e.target.checked)}
                    />
                    <span>
                      Confirmar revisión: invalidará la aceptación del cliente y
                      creará una nueva versión del presupuesto (caducidad 72 h).
                    </span>
                  </label>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold">
                    Total calculado:{' '}
                    {liveTotal != null
                      ? formatEuro(liveTotal, detail.currency)
                      : '—'}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || liveTotal == null}
                    onClick={() => void confirmValuation()}
                  >
                    {detail.linesValuedAt
                      ? 'Actualizar valoración'
                      : 'Confirmar valoración'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  El total lo calcula el servidor a partir de las líneas
                  disponibles. No se realiza ningún cobro al confirmar.
                </p>
              </div>
            ) : (
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
                        {item.availabilityStatus === 'unavailable' ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (no disponible)
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 font-medium">
                        {detail.source === 'public_qr' && amountPending
                          ? 'Pendiente'
                          : formatEuro(item.lineTotal, detail.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
                {legacyTotalOnly ? (
                  <p className="mt-3 text-sm font-semibold">
                    Total histórico:{' '}
                    {formatEuro(detail.totalAmount, detail.currency)}
                  </p>
                ) : detail.source !== 'public_qr' || detail.amountConfirmedAt ? (
                  <p className="mt-3 text-sm font-semibold">
                    Total:{' '}
                    {formatOrderAmount({
                      amount: detail.totalAmount,
                      currency: detail.currency,
                      source: detail.source,
                      paymentStatus: detail.paymentStatus,
                      orderStatus: detail.status,
                      amountConfirmedAt: detail.amountConfirmedAt,
                    })}
                  </p>
                ) : null}
              </div>
            )}

            {showQuoteLink ? (
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void copyQuoteLink()}
                >
                  Copiar enlace del presupuesto
                </Button>
                <p className="text-xs text-muted-foreground">
                  Genera un enlace seguro para el cliente. No se envía
                  automáticamente (WhatsApp/SMS/email). Regenerar no amplía la
                  caducidad de esta versión.
                </p>
                {quoteLinkUrl ? (
                  <p className="break-all rounded-md bg-muted/40 px-2 py-1 font-mono text-[11px] text-foreground">
                    {quoteLinkUrl}
                  </p>
                ) : null}
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
                  <p className="mb-2 text-sm font-medium">
                    Cambiar estado operativo
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((next) => (
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
                    {statusOptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Sin transiciones disponibles.
                      </p>
                    ) : null}
                  </div>
                  {detail.source === 'public_qr' &&
                  detail.status === 'request_pending' &&
                  !statusOptions.includes('preparing') ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      «En preparación» está bloqueado hasta valorar el pedido y
                      hasta que el cliente acepte el presupuesto.
                      {detail.customerRejectedAt
                        ? ' El cliente rechazó este presupuesto.'
                        : ''}
                    </p>
                  ) : null}
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
                  </div>
                  {amountPending ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Confirma la valoración antes de poder marcar «Cobrado».
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
      )}
    </div>
  );
}
