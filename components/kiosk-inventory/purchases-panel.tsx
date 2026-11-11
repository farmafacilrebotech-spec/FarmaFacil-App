'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2, Paperclip, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import {
  getKioskPurchaseDocumentSignedUrlAction,
  receiveAgainstPurchaseOrderAction,
  uploadKioskPurchaseDocumentAction,
  upsertKioskPurchaseOrderAction,
} from '@/app/(app)/inventario-kioskos/purchase-actions';
import { AdminWideDialog } from '@/components/shared/admin-wide-dialog';
import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  DEFAULT_KIOSK_DELIVERY_LEAD_MONTHS,
  KIOSK_PO_DOC_LABELS,
  KIOSK_PO_DOC_TYPES,
  KIOSK_PO_STATUS_LABELS,
  computeEstimatedDeliveryAt,
  type KioskPurchaseDocType,
  type KioskPurchaseDocumentMeta,
  type KioskPurchaseOrderFinancial,
  type KioskPurchaseOrderOperational,
} from '@/lib/kiosk-inventory/purchase-types';

function eurosInputToCents(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES');
}

function tsOf(iso: string | null | undefined): number {
  if (!iso) return Number.NEGATIVE_INFINITY;
  const t = Date.parse(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

function cmpDesc(a: number, b: number): number {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

function isFinancial(
  o: KioskPurchaseOrderOperational | KioskPurchaseOrderFinancial
): o is KioskPurchaseOrderFinancial {
  return 'unitPriceCents' in o;
}

export function PurchasesPanel({
  orders,
  canSeeFinancial,
  canWritePurchasing,
  canReceive,
  loadError,
  documentsByOrderId,
  extensionOnly = false,
  onOpenGeneralOrder,
}: {
  orders: Array<KioskPurchaseOrderOperational | KioskPurchaseOrderFinancial>;
  canSeeFinancial: boolean;
  canWritePurchasing: boolean;
  canReceive: boolean;
  loadError?: string | null;
  documentsByOrderId: Record<string, KioskPurchaseDocumentMeta[]>;
  /** Vista Proveedores: no crear compra económica independiente. */
  extensionOnly?: boolean;
  /** Abre el pedido económico (Pedidos de compra) vinculado a esta extensión. */
  onOpenGeneralOrder?: (generalPurchaseOrderId: string) => void;
}) {
  const router = useRouter();
  const lock = React.useRef(false);
  const [busy, setBusy] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  /** Códigos KSK creados en esta sesión (el listado completo vive en Inventario). */
  const [receivedCodes, setReceivedCodes] = React.useState<
    Record<string, string[]>
  >({});

  const [supplierName, setSupplierName] = React.useState('');
  const [orderNumber, setOrderNumber] = React.useState('');
  const [model, setModel] = React.useState('');
  const [quantity, setQuantity] = React.useState(1);
  const [orderedAt, setOrderedAt] = React.useState('');
  const [leadMonths, setLeadMonths] = React.useState(
    DEFAULT_KIOSK_DELIVERY_LEAD_MONTHS
  );
  const [unitPrice, setUnitPrice] = React.useState('');
  const [shipping, setShipping] = React.useState('');
  const [total, setTotal] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const [recvCount, setRecvCount] = React.useState(1);
  const [recvSerials, setRecvSerials] = React.useState('');
  const [recvNotes, setRecvNotes] = React.useState('');
  const [docType, setDocType] =
    React.useState<KioskPurchaseDocType>('supplier_quote');

  const sortedOrders = React.useMemo(
    () =>
      [...orders].sort(
        (a, b) =>
          cmpDesc(tsOf(a.orderedAt), tsOf(b.orderedAt)) ||
          cmpDesc(tsOf(a.createdAt), tsOf(b.createdAt)) ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      ),
    [orders]
  );

  const selected = orders.find((o) => o.id === detailId) ?? null;
  const etaPreview = computeEstimatedDeliveryAt(
    orderedAt || null,
    leadMonths
  );

  const createDirty =
    createOpen &&
    Boolean(
      supplierName.trim() ||
        orderNumber.trim() ||
        model.trim() ||
        orderedAt ||
        unitPrice.trim() ||
        shipping.trim() ||
        total.trim() ||
        notes.trim() ||
        quantity !== 1
    );
  const detailDirty = Boolean(
    detailId && (recvSerials.trim() || recvNotes.trim())
  );

  function resetCreateForm() {
    setSupplierName('');
    setOrderNumber('');
    setModel('');
    setQuantity(1);
    setOrderedAt('');
    setLeadMonths(DEFAULT_KIOSK_DELIVERY_LEAD_MONTHS);
    setUnitPrice('');
    setShipping('');
    setTotal('');
    setNotes('');
  }

  function openDetail(id: string) {
    setRecvCount(1);
    setRecvSerials('');
    setRecvNotes('');
    setDetailId(id);
  }

  function closeDetail() {
    setDetailId(null);
    setRecvSerials('');
    setRecvNotes('');
  }

  async function createOrder(markAsOrdered: boolean) {
    if (!canWritePurchasing || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await upsertKioskPurchaseOrderAction({
        supplierName,
        orderNumber: orderNumber || null,
        model: model || null,
        quantity,
        orderedAt: orderedAt || null,
        deliveryLeadMonths: leadMonths,
        unitPriceCents: eurosInputToCents(unitPrice),
        shippingCents: eurosInputToCents(shipping),
        totalCents: eurosInputToCents(total),
        notes: notes || null,
        markAsOrdered,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Pedido guardado.');
      resetCreateForm();
      setCreateOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  async function onUpload(file: File | null) {
    if (!selected || !file || !canWritePurchasing || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const base64 = btoa(binary);
      const existing = (documentsByOrderId[selected.id] ?? []).find(
        (d) => d.docType === docType
      );
      const result = await uploadKioskPurchaseDocumentAction({
        purchaseOrderId: selected.id,
        docType,
        fileName: file.name,
        mimeType: file.type || null,
        base64,
        replaceDocumentId: existing?.id ?? null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        existing ? 'Documento sustituido.' : 'Documento adjuntado.'
      );
      router.refresh();
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  async function openDoc(documentId: string) {
    const result = await getKioskPurchaseDocumentSignedUrlAction({
      documentId,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    window.open(result.url, '_blank', 'noopener,noreferrer');
  }

  async function receiveSelected() {
    if (!selected || !canReceive || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await receiveAgainstPurchaseOrderAction({
        purchaseOrderId: selected.id,
        count: recvCount,
        serialsText: recvSerials,
        notes: recvNotes,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const codes = result.codes ?? [];
      toast.success(`Recepción registrada. Activos: ${codes.join(', ')}`);
      setReceivedCodes((prev) => ({
        ...prev,
        [selected.id]: [...(prev[selected.id] ?? []), ...codes],
      }));
      setRecvSerials('');
      setRecvNotes('');
      router.refresh();
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  const showTotal = canSeeFinancial && !extensionOnly;
  const colCount = showTotal ? 10 : 9;
  const sessionCodes = selected ? receivedCodes[selected.id] ?? [] : [];

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Pedidos y compras de kioskos
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {extensionOnly
              ? 'Vista operativa de extensiones kiosk vinculadas a pedidos generales. El número visible es el del pedido económico. No se crea una compra independiente aquí. Doble clic en una fila (o «Abrir») para ver el detalle y registrar recepciones.'
              : 'Pedidos al proveedor (independientes del presupuesto comercial a farmacias). La recepción crea activos KSK-… sin duplicarlos. Doble clic en una fila (o «Abrir») para ver el detalle.'}
            {!canSeeFinancial
              ? ' Los importes, presupuestos y facturas no son visibles con tu perfil.'
              : null}
          </p>
        </div>
        {canWritePurchasing && !extensionOnly ? (
          <Button
            type="button"
            size="sm"
            className="gap-1"
            onClick={() => {
              resetCreateForm();
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nuevo pedido
          </Button>
        ) : null}
      </div>

      {loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : null}

      {extensionOnly ? (
        <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Para una nueva compra de kioskos: crea/confirma el pedido en «Pedidos
          de compra» con categoría Kioskos. Aquí solo se completan modelo,
          unidades, ETA y recepción.
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs">
              <th className="px-3 py-2 font-medium text-muted-foreground">
                N.º
              </th>
              <th className="px-3 py-2 font-medium text-muted-foreground">
                Fecha
              </th>
              <th className="px-3 py-2 font-medium text-muted-foreground">
                Proveedor
              </th>
              <th className="px-3 py-2 font-medium text-muted-foreground">
                Modelo
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Ud. pedidas
              </th>
              <th className="px-3 py-2 font-medium text-muted-foreground">
                Recibidas / pendientes
              </th>
              <th className="px-3 py-2 font-medium text-muted-foreground">
                ETA
              </th>
              <th className="px-3 py-2 font-medium text-muted-foreground">
                Estado
              </th>
              {showTotal ? (
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                  Total
                </th>
              ) : null}
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Abrir
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  {extensionOnly
                    ? 'Aún no hay extensiones kiosk. Crea el pedido en «Pedidos de compra».'
                    : 'Aún no hay pedidos de kioskos.'}
                </td>
              </tr>
            ) : (
              sortedOrders.map((o) => (
                <tr
                  key={o.id}
                  className={`cursor-pointer border-b border-border/70 last:border-0 hover:bg-muted/30 ${
                    detailId === o.id ? 'bg-primary/5' : ''
                  }`}
                  onDoubleClick={() => openDetail(o.id)}
                  title="Doble clic para abrir el detalle"
                >
                  <td className="px-3 py-2 font-mono text-xs">
                    {o.orderNumber || (
                      <span className="font-sans text-muted-foreground">
                        Sin número
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatDate(o.orderedAt)}
                  </td>
                  <td className="px-3 py-2 font-medium">{o.supplierName}</td>
                  <td className="px-3 py-2">
                    {o.model || (
                      <span className="text-muted-foreground">Sin modelo</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {o.quantity}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {o.receivedQuantity} rec. · {o.remainingQuantity} pend.
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {formatDate(o.estimatedDeliveryAt)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">
                      {KIOSK_PO_STATUS_LABELS[o.status]}
                    </Badge>
                  </td>
                  {showTotal ? (
                    <td className="px-3 py-2 text-right tabular-nums">
                      {isFinancial(o) ? formatCents(o.totalCents) : '—'}
                    </td>
                  ) : null}
                  <td
                    className="px-3 py-2 text-right"
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(o.id);
                      }}
                    >
                      Abrir
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminWideDialog
        open={Boolean(selected)}
        onOpenChange={(o) => {
          if (!o) closeDetail();
        }}
        title={
          selected
            ? `Compra de kioskos · ${selected.orderNumber || 'Sin número'}`
            : 'Compra de kioskos'
        }
        description={
          selected
            ? `${selected.supplierName}${selected.model ? ` · ${selected.model}` : ''}`
            : undefined
        }
        dirty={detailDirty}
        size="2xl"
        footer={
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cerrar
            </Button>
          </DialogClose>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Estado</dt>
                <dd className="font-medium">
                  {KIOSK_PO_STATUS_LABELS[selected.status]}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Modelo</dt>
                <dd className="font-medium">{selected.model || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Fecha de pedido
                </dt>
                <dd className="font-medium">{formatDate(selected.orderedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Unidades pedidas
                </dt>
                <dd className="font-medium">{selected.quantity}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Recibidas</dt>
                <dd className="font-medium">{selected.receivedQuantity}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Pendientes</dt>
                <dd className="font-medium">{selected.remainingQuantity}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Plazo</dt>
                <dd className="font-medium">
                  {selected.deliveryLeadMonths} mes(es)
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">ETA</dt>
                <dd className="font-medium">
                  {formatDate(selected.estimatedDeliveryAt)}
                </dd>
              </div>
              {canSeeFinancial && isFinancial(selected) ? (
                <>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Precio unitario
                    </dt>
                    <dd className="font-medium">
                      {formatCents(selected.unitPriceCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Envío</dt>
                    <dd className="font-medium">
                      {formatCents(selected.shippingCents)}
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>

            {selected.notes ? (
              <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
                {selected.notes}
              </p>
            ) : null}

            {selected.generalPurchaseOrderId && onOpenGeneralOrder ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <span>
                  Los importes y la factura se gestionan en el pedido de compra
                  económico (no se crea una segunda compra aquí).
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const id = selected.generalPurchaseOrderId!;
                    closeDetail();
                    onOpenGeneralOrder(id);
                  }}
                >
                  Ver pedido económico
                </Button>
              </div>
            ) : null}

            <div className="space-y-2 border-t border-border pt-3">
              <h3 className="text-sm font-semibold">Activos KSK</h3>
              {sessionCodes.length > 0 ? (
                <p className="text-sm">
                  Creados en esta sesión:{' '}
                  <span className="font-mono text-xs">
                    {sessionCodes.join(', ')}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {selected.receivedQuantity > 0
                    ? `${selected.receivedQuantity} activo(s) KSK creados contra este pedido.`
                    : 'Aún no hay activos creados contra este pedido.'}
                </p>
              )}
              <Link
                href="/inventario-kioskos"
                className="inline-block text-xs text-primary underline-offset-2 hover:underline"
              >
                Ver inventario de kioskos
              </Link>
            </div>


            {canSeeFinancial ? (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-medium">Documentos</p>
                <ul className="space-y-1 text-sm">
                  {(documentsByOrderId[selected.id] ?? []).map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2">
                      <span>
                        {KIOSK_PO_DOC_LABELS[d.docType]} · {d.fileName}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void openDoc(d.id)}
                      >
                        Abrir
                      </Button>
                    </li>
                  ))}
                  {(documentsByOrderId[selected.id] ?? []).length === 0 ? (
                    <li className="text-muted-foreground">Sin documentos.</li>
                  ) : null}
                </ul>
                {canWritePurchasing ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1.5">
                      <Label>Tipo</Label>
                      <Select
                        value={docType}
                        onValueChange={(v) =>
                          setDocType(v as KioskPurchaseDocType)
                        }
                      >
                        <SelectTrigger className="w-[220px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {KIOSK_PO_DOC_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {KIOSK_PO_DOC_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm">
                      <Paperclip className="h-4 w-4" />
                      Adjuntar / sustituir
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,application/pdf"
                        onChange={(e) =>
                          void onUpload(e.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Documentos financieros ocultos para tu perfil.
              </p>
            )}

          {canReceive &&
          selected.status !== 'cancelado' &&
          selected.remainingQuantity > 0 ? (
            <div className="space-y-3 rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold">
                Recepción contra este pedido
              </h3>
              <p className="text-xs text-muted-foreground">
                Crea activos nuevos y actualiza el estado del pedido. No
                reutiliza códigos KSK.
              </p>
              <div className="space-y-1.5">
                <Label>Unidades a recibir</Label>
                <Input
                  type="number"
                  min={1}
                  max={selected.remainingQuantity}
                  value={recvCount}
                  onChange={(e) => setRecvCount(Number(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Series (opcional, una por línea)</Label>
                <Textarea
                  value={recvSerials}
                  onChange={(e) => setRecvSerials(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Notas</Label>
                <Input
                  value={recvNotes}
                  onChange={(e) => setRecvNotes(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void receiveSelected()}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Registrar recepción
              </Button>
            </div>
          ) : null}
          </div>
        ) : null}
      </AdminWideDialog>

      <AdminWideDialog
        open={createOpen}
        onOpenChange={(o) => {
          if (!o) {
            setCreateOpen(false);
            resetCreateForm();
          }
        }}
        title="Nuevo pedido de kioskos"
        dirty={createDirty}
        size="2xl"
        footer={
          <>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy || !supplierName.trim()}
              onClick={() => void createOrder(true)}
            >
              Guardar como pedido
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={busy || !supplierName.trim()}
              onClick={() => void createOrder(false)}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Guardar preparado
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Nombre del proveedor"
              />
            </div>
            <div className="space-y-1.5">
              <Label>N.º pedido</Label>
              <Input
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unidades</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de pedido</Label>
              <Input
                type="date"
                value={orderedAt}
                onChange={(e) => setOrderedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Plazo entrega (meses)</Label>
              <Input
                type="number"
                min={0}
                max={24}
                value={leadMonths}
                onChange={(e) =>
                  setLeadMonths(Number(e.target.value) || 0)
                }
              />
              <p className="text-[11px] text-muted-foreground">
                ETA:{' '}
                {etaPreview
                  ? new Date(`${etaPreview}T12:00:00Z`).toLocaleDateString(
                      'es-ES'
                    )
                  : '— (indica fecha de pedido)'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Precio unitario (€)</Label>
              <Input
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gastos de envío (€)</Label>
              <Input
                value={shipping}
                onChange={(e) => setShipping(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Coste total (€)</Label>
              <Input
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </AdminWideDialog>
    </section>
  );
}
