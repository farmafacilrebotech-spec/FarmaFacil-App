'use client';

import * as React from 'react';
import { Loader2, Paperclip, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import {
  getKioskPurchaseDocumentSignedUrlAction,
  receiveAgainstPurchaseOrderAction,
  uploadKioskPurchaseDocumentAction,
  upsertKioskPurchaseOrderAction,
} from '@/app/(app)/inventario-kioskos/purchase-actions';
import { Button } from '@/components/ui/button';
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
}: {
  orders: Array<KioskPurchaseOrderOperational | KioskPurchaseOrderFinancial>;
  canSeeFinancial: boolean;
  canWritePurchasing: boolean;
  canReceive: boolean;
  loadError?: string | null;
  documentsByOrderId: Record<string, KioskPurchaseDocumentMeta[]>;
  /** Vista Proveedores: no crear compra económica independiente. */
  extensionOnly?: boolean;
}) {
  const router = useRouter();
  const lock = React.useRef(false);
  const [busy, setBusy] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(
    orders[0]?.id ?? null
  );

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

  const selected = orders.find((o) => o.id === selectedId) ?? null;
  const etaPreview = computeEstimatedDeliveryAt(
    orderedAt || null,
    leadMonths
  );

  React.useEffect(() => {
    if (!selectedId && orders[0]) setSelectedId(orders[0].id);
  }, [orders, selectedId]);

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
      setSupplierName('');
      setOrderNumber('');
      setModel('');
      setQuantity(1);
      setOrderedAt('');
      setUnitPrice('');
      setShipping('');
      setTotal('');
      setNotes('');
      setSelectedId(result.id);
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
      toast.success(
        `Recepción registrada. Activos: ${(result.codes ?? []).join(', ')}`
      );
      setRecvSerials('');
      router.refresh();
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          Pedidos y compras de kioskos
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {extensionOnly
            ? 'Vista operativa de extensiones kiosk vinculadas a pedidos generales. El número visible es el del pedido económico. No se crea una compra independiente aquí. Recepción de activos KSK requiere migración 065 (ausente en staging).'
            : 'Pedidos al proveedor (independientes del presupuesto comercial a farmacias). La recepción crea activos KSK-… sin duplicarlos.'}
          {!canSeeFinancial
            ? ' Los importes, presupuestos y facturas no son visibles con tu perfil.'
            : null}
        </p>
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

      {canWritePurchasing && !extensionOnly ? (
        <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
          <p className="text-xs font-medium text-foreground">Nuevo pedido</p>
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
          <div className="flex flex-wrap gap-2">
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
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy || !supplierName.trim()}
              onClick={() => void createOrder(true)}
            >
              Guardar como pedido
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-3 py-2 font-medium text-muted-foreground">
                Nº pedido
              </th>
              <th className="px-3 py-2 font-medium text-muted-foreground">
                Proveedor
              </th>
              <th className="px-3 py-2 font-medium text-muted-foreground">
                Estado
              </th>
              <th className="px-3 py-2 font-medium text-muted-foreground">
                Ud.
              </th>
              <th className="px-3 py-2 font-medium text-muted-foreground">
                ETA
              </th>
              {canSeeFinancial && !extensionOnly ? (
                <th className="px-3 py-2 font-medium text-muted-foreground">
                  Total
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td
                  colSpan={canSeeFinancial && !extensionOnly ? 6 : 5}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  Aún no hay extensiones kiosk. Crea el pedido en «Pedidos de
                  compra».
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr
                  key={o.id}
                  className={`cursor-pointer border-b border-border/70 last:border-0 hover:bg-muted/30 ${
                    selectedId === o.id ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => setSelectedId(o.id)}
                >
                  <td className="px-3 py-2 font-mono text-xs">
                    {o.orderNumber || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{o.supplierName}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.model || 'Sin modelo'}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">
                      {KIOSK_PO_STATUS_LABELS[o.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {o.receivedQuantity}/{o.quantity}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {o.estimatedDeliveryAt
                      ? new Date(
                          `${o.estimatedDeliveryAt}T12:00:00Z`
                        ).toLocaleDateString('es-ES')
                      : '—'}
                  </td>
                  {canSeeFinancial && !extensionOnly ? (
                    <td className="px-3 py-2 tabular-nums">
                      {isFinancial(o) ? formatCents(o.totalCents) : '—'}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold">Detalle del pedido</h3>
            <dl className="grid gap-1 text-sm sm:grid-cols-2">
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
          </div>

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
    </section>
  );
}
