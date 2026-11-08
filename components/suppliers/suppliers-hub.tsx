'use client';

import * as React from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import {
  archiveSupplierAction,
  convertApprovedQuoteToKioskPurchaseAction,
  upsertSupplierAction,
  upsertSupplierContactAction,
  upsertSupplierQuoteAction,
} from '@/app/(app)/proveedores/actions';
import { PurchasesPanel } from '@/components/kiosk-inventory/purchases-panel';
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
import type {
  KioskPurchaseDocumentMeta,
  KioskPurchaseOrderFinancial,
  KioskPurchaseOrderOperational,
} from '@/lib/kiosk-inventory/purchase-types';
import {
  SUPPLIER_QUOTE_STATUS_LABELS,
  SUPPLIER_QUOTE_STATUSES,
  type MaterialOfferCompareRow,
  type SupplierActivityRow,
  type SupplierContactRow,
  type SupplierQuoteRow,
  type SupplierQuoteStatus,
  type SupplierRow,
} from '@/lib/suppliers/types';

function eurosToCents(raw: string): number {
  const n = Number(raw.trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

type Tab = 'directorio' | 'presupuestos' | 'compras' | 'comparar';

export function SuppliersHub({
  suppliers,
  quotes,
  contactsBySupplier,
  activityBySupplier,
  compareOffers,
  compareKey,
  purchases,
  documentsByOrderId,
  canWrite,
  canPurchasingWrite,
  canReceive,
  canSeeFinancial,
  loadError,
  purchasesError,
}: {
  suppliers: SupplierRow[];
  quotes: SupplierQuoteRow[];
  contactsBySupplier: Record<string, SupplierContactRow[]>;
  activityBySupplier: Record<string, SupplierActivityRow[]>;
  compareOffers: MaterialOfferCompareRow[];
  compareKey: string;
  purchases: Array<KioskPurchaseOrderOperational | KioskPurchaseOrderFinancial>;
  documentsByOrderId: Record<string, KioskPurchaseDocumentMeta[]>;
  canWrite: boolean;
  canPurchasingWrite: boolean;
  canReceive: boolean;
  canSeeFinancial: boolean;
  loadError?: string | null;
  purchasesError?: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>('directorio');
  const [busy, setBusy] = React.useState(false);
  const lock = React.useRef(false);

  const [selectedId, setSelectedId] = React.useState<string | null>(
    suppliers[0]?.id ?? null
  );
  const [legalName, setLegalName] = React.useState('');
  const [tradeName, setTradeName] = React.useState('');
  const [taxId, setTaxId] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [paymentTerms, setPaymentTerms] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const [contactName, setContactName] = React.useState('');
  const [contactEmail, setContactEmail] = React.useState('');
  const [contactPhone, setContactPhone] = React.useState('');

  const [quoteTitle, setQuoteTitle] = React.useState('');
  const [quoteSupplierId, setQuoteSupplierId] = React.useState(
    suppliers[0]?.id ?? ''
  );
  const [quoteStatus, setQuoteStatus] =
    React.useState<SupplierQuoteStatus>('recibido');
  const [lineMaterial, setLineMaterial] = React.useState('kiosk');
  const [lineDesc, setLineDesc] = React.useState('');
  const [lineQty, setLineQty] = React.useState('1');
  const [linePrice, setLinePrice] = React.useState('');
  const [lineLead, setLineLead] = React.useState('');
  const [shipping, setShipping] = React.useState('');
  const [materialCompare, setMaterialCompare] = React.useState(compareKey || 'kiosk');

  const selected = suppliers.find((s) => s.id === selectedId) ?? null;

  React.useEffect(() => {
    if (!selected) {
      setLegalName('');
      setTradeName('');
      setTaxId('');
      setCategory('');
      setEmail('');
      setPhone('');
      setPaymentTerms('');
      setNotes('');
      return;
    }
    setLegalName(selected.legalName);
    setTradeName(selected.tradeName ?? '');
    setTaxId(selected.taxId ?? '');
    setCategory(selected.category ?? '');
    setEmail(selected.email ?? '');
    setPhone(selected.phone ?? '');
    setPaymentTerms(selected.paymentTerms ?? '');
    setNotes(selected.notes ?? '');
  }, [selected]);

  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['directorio', 'Directorio'],
            ['presupuestos', 'Presupuestos'],
            ['compras', 'Compras'],
            ['comparar', 'Comparar materiales'],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={tab === id ? 'default' : 'outline'}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {loadError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {tab === 'directorio' ? (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Proveedores</h2>
              {canWrite ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={busy}
                  onClick={() => {
                    setSelectedId(null);
                    setLegalName('');
                    setTradeName('');
                    setTaxId('');
                    setCategory('');
                    setEmail('');
                    setPhone('');
                    setPaymentTerms('');
                    setNotes('');
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Nuevo
                </Button>
              ) : null}
            </div>
            <ul className="max-h-[480px] space-y-1 overflow-y-auto rounded-xl border border-border bg-card p-2">
              {suppliers.length === 0 ? (
                <li className="px-2 py-4 text-sm text-muted-foreground">
                  Sin proveedores. Alta manual (sin datos ficticios).
                </li>
              ) : (
                suppliers.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                        selectedId === s.id
                          ? 'bg-primary/10 font-medium text-foreground'
                          : 'hover:bg-muted/60'
                      }`}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <span className="block truncate">{s.legalName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.category ?? s.status}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <h2 className="text-base font-semibold">
              {selected ? 'Ficha proveedor' : 'Alta de proveedor'}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sup-legal">Razón social</Label>
                <Input
                  id="sup-legal"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  disabled={!canWrite || busy}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sup-trade">Nombre comercial</Label>
                <Input
                  id="sup-trade"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  disabled={!canWrite || busy}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sup-tax">NIF / CIF</Label>
                <Input
                  id="sup-tax"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  disabled={!canWrite || busy}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sup-cat">Categoría</Label>
                <Input
                  id="sup-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={!canWrite || busy}
                  placeholder="kioskos, material, logística…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sup-email">Email</Label>
                <Input
                  id="sup-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!canWrite || busy}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sup-phone">Teléfono</Label>
                <Input
                  id="sup-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!canWrite || busy}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sup-terms">Condiciones</Label>
                <Input
                  id="sup-terms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  disabled={!canWrite || busy}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sup-notes">Notas</Label>
                <Textarea
                  id="sup-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!canWrite || busy}
                  rows={3}
                />
              </div>
            </div>
            {canWrite ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const res = await upsertSupplierAction({
                        id: selectedId,
                        legalName,
                        tradeName,
                        taxId,
                        category,
                        email,
                        phone,
                        paymentTerms,
                        notes,
                      });
                      if (!res.ok) {
                        toast.error(res.error);
                        return;
                      }
                      toast.success(selectedId ? 'Proveedor actualizado' : 'Proveedor creado');
                      setSelectedId(res.id);
                      router.refresh();
                    })
                  }
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Guardar
                </Button>
                {selectedId ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const res = await archiveSupplierAction(selectedId);
                        if (!res.ok) {
                          toast.error(res.error);
                          return;
                        }
                        toast.success('Proveedor archivado');
                        setSelectedId(null);
                        router.refresh();
                      })
                    }
                  >
                    Archivar
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Solo lectura.</p>
            )}

            {selectedId ? (
              <div className="space-y-3 border-t border-border pt-4">
                <h3 className="text-sm font-semibold">Contactos</h3>
                <ul className="space-y-1 text-sm">
                  {(contactsBySupplier[selectedId] ?? []).map((c) => (
                    <li key={c.id} className="text-muted-foreground">
                      {c.fullName}
                      {c.email ? ` · ${c.email}` : ''}
                      {c.phone ? ` · ${c.phone}` : ''}
                    </li>
                  ))}
                </ul>
                {canWrite ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input
                      placeholder="Nombre"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                    />
                    <Input
                      placeholder="Email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                    <Input
                      placeholder="Teléfono"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="sm:col-span-3"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const res = await upsertSupplierContactAction({
                            supplierId: selectedId,
                            fullName: contactName,
                            email: contactEmail,
                            phone: contactPhone,
                            isPrimary: true,
                          });
                          if (!res.ok) {
                            toast.error(res.error);
                            return;
                          }
                          setContactName('');
                          setContactEmail('');
                          setContactPhone('');
                          toast.success('Contacto añadido');
                          router.refresh();
                        })
                      }
                    >
                      Añadir contacto
                    </Button>
                  </div>
                ) : null}

                <h3 className="text-sm font-semibold">Actividad</h3>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                  {(activityBySupplier[selectedId] ?? []).map((a) => (
                    <li key={a.id}>
                      {a.createdAt
                        ? new Date(a.createdAt).toLocaleString('es-ES')
                        : '—'}{' '}
                      — {a.summary}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'presupuestos' ? (
        <div className="space-y-6">
          {canWrite ? (
            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <h2 className="text-base font-semibold">Registrar presupuesto</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Proveedor</Label>
                  <Select
                    value={quoteSupplierId}
                    onValueChange={setQuoteSupplierId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.legalName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Estado</Label>
                  <Select
                    value={quoteStatus}
                    onValueChange={(v) =>
                      setQuoteStatus(v as SupplierQuoteStatus)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPLIER_QUOTE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {SUPPLIER_QUOTE_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Título</Label>
                  <Input
                    value={quoteTitle}
                    onChange={(e) => setQuoteTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Material (clave)</Label>
                  <Input
                    value={lineMaterial}
                    onChange={(e) => setLineMaterial(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Descripción línea</Label>
                  <Input
                    value={lineDesc}
                    onChange={(e) => setLineDesc(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Cantidad</Label>
                  <Input
                    value={lineQty}
                    onChange={(e) => setLineQty(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Precio unitario (€)</Label>
                  <Input
                    value={linePrice}
                    onChange={(e) => setLinePrice(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Plazo (días)</Label>
                  <Input
                    value={lineLead}
                    onChange={(e) => setLineLead(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Transporte (€)</Label>
                  <Input
                    value={shipping}
                    onChange={(e) => setShipping(e.target.value)}
                  />
                </div>
              </div>
              <Button
                type="button"
                disabled={busy || !quoteSupplierId}
                onClick={() =>
                  run(async () => {
                    const qty = Number(lineQty);
                    const res = await upsertSupplierQuoteAction({
                      supplierId: quoteSupplierId,
                      title: quoteTitle,
                      status: quoteStatus,
                      shippingCents: shipping ? eurosToCents(shipping) : null,
                      lines:
                        lineMaterial.trim() && lineDesc.trim()
                          ? [
                              {
                                materialKey: lineMaterial,
                                description: lineDesc,
                                quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
                                unitPriceCents: eurosToCents(linePrice),
                                leadDays: lineLead
                                  ? Number(lineLead)
                                  : null,
                              },
                            ]
                          : [],
                    });
                    if (!res.ok) {
                      toast.error(res.error);
                      return;
                    }
                    toast.success('Presupuesto registrado');
                    setQuoteTitle('');
                    setLineDesc('');
                    setLinePrice('');
                    router.refresh();
                  })
                }
              >
                Guardar presupuesto
              </Button>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">Título</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Transporte</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {quotes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-muted-foreground"
                    >
                      Sin presupuestos registrados.
                    </td>
                  </tr>
                ) : (
                  quotes.map((q) => (
                    <tr key={q.id} className="border-b border-border/70">
                      <td className="px-3 py-2">{q.supplierName ?? '—'}</td>
                      <td className="px-3 py-2">{q.title}</td>
                      <td className="px-3 py-2">
                        {SUPPLIER_QUOTE_STATUS_LABELS[q.status]}
                      </td>
                      <td className="px-3 py-2">
                        {q.shippingCents == null
                          ? '—'
                          : formatCents(q.shippingCents)}
                      </td>
                      <td className="px-3 py-2">
                        {canWrite && q.status === 'aprobado' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                const res =
                                  await convertApprovedQuoteToKioskPurchaseAction(
                                    {
                                      quoteId: q.id,
                                      quantity: 1,
                                      model: q.title,
                                    }
                                  );
                                if (!res.ok) {
                                  toast.error(res.error);
                                  return;
                                }
                                toast.success(
                                  'Pedido de compra creado (compras kioskos)'
                                );
                                setTab('compras');
                                router.refresh();
                              })
                            }
                          >
                            Convertir en pedido
                          </Button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'compras' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pedidos operativos reutilizan <code className="text-xs">kiosk_purchase_orders</code>{' '}
            (WIP 068 → migración 076). Documentos privados; importes solo con
            permiso de compras.
          </p>
          {purchasesError ? (
            <p className="text-sm text-destructive">{purchasesError}</p>
          ) : (
            <PurchasesPanel
              orders={purchases}
              canSeeFinancial={canSeeFinancial}
              canWritePurchasing={canPurchasingWrite}
              canReceive={canReceive}
              documentsByOrderId={documentsByOrderId}
            />
          )}
        </div>
      ) : null}

      {tab === 'comparar' ? (
        <div className="space-y-4">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              const params = new URLSearchParams(window.location.search);
              params.set('material', materialCompare.trim().toLowerCase());
              params.set('tab', 'comparar');
              router.push(`/proveedores?${params.toString()}`);
            }}
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="mat-key">Clave de material</Label>
              <Input
                id="mat-key"
                value={materialCompare}
                onChange={(e) => setMaterialCompare(e.target.value)}
              />
            </div>
            <Button type="submit">Comparar</Button>
          </form>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">Presupuesto</th>
                  <th className="px-3 py-2">Precio u.</th>
                  <th className="px-3 py-2">Plazo</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {compareOffers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                      No hay ofertas para «{compareKey || materialCompare}».
                    </td>
                  </tr>
                ) : (
                  compareOffers.map((o) => (
                    <tr
                      key={`${o.quoteId}-${o.supplierId}-${o.unitPriceCents}`}
                      className="border-b border-border/70"
                    >
                      <td className="px-3 py-2">{o.supplierName}</td>
                      <td className="px-3 py-2">{o.quoteTitle}</td>
                      <td className="px-3 py-2">
                        {formatCents(o.unitPriceCents)}
                      </td>
                      <td className="px-3 py-2">
                        {o.leadDays == null ? '—' : `${o.leadDays} d`}
                      </td>
                      <td className="px-3 py-2">
                        {SUPPLIER_QUOTE_STATUS_LABELS[o.quoteStatus]}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
