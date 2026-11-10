'use client';

import * as React from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import {
  archiveSupplierAction,
  confirmGeneralPurchaseOrderAction,
  createPurchaseFromQuoteAction,
  getSupplierDocSignedUrlAction,
  loadSupplierPurchaseDetailAction,
  loadSupplierQuoteDetailAction,
  uploadPurchaseDocumentAction,
  uploadSupplierQuoteDocumentAction,
  upsertGeneralPurchaseOrderAction,
  upsertSupplierAction,
  upsertSupplierContactAction,
  upsertSupplierQuoteAction,
} from '@/app/(app)/proveedores/actions';
import {
  DEFAULT_PO_UNIT_PRICE_NOTE,
  DEFAULT_VAT_BPS,
  validatePurchaseDraft,
  vatBpsToPercent,
  vatPercentToBps,
  withDefaultPoNoteOnCreate,
} from '@/lib/suppliers/purchase-math';
import {
  cheapestFullQuoteId,
  cheapestLineOfferId,
  collectFullQuoteOffers,
  collectLineOffers,
  equivalenceWarningsForLines,
  equivalenceWarningsForQuotes,
  filterLineOffersByMaterialKey,
  type QuoteCompareMode,
} from '@/lib/suppliers/quote-compare';
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
  SUPPLIER_CATEGORIES,
  SUPPLIER_CATEGORY_LABELS,
  SUPPLIER_PO_DOC_LABELS,
  SUPPLIER_PO_DOC_TYPES,
  SUPPLIER_PO_STATUS_LABELS,
  SUPPLIER_QUOTE_STATUS_LABELS,
  SUPPLIER_QUOTE_UI_STATUSES,
  type SupplierActivityRow,
  type SupplierCategory,
  type SupplierContactRow,
  type SupplierPurchaseDocType,
  type SupplierPurchaseDocumentRow,
  type SupplierPurchaseLineRow,
  type SupplierPurchaseOrderRow,
  type SupplierPurchaseStatus,
  type SupplierQuoteDocumentRow,
  type SupplierQuoteLineRow,
  type SupplierQuoteRow,
  type SupplierQuoteStatus,
  type SupplierRow,
} from '@/lib/suppliers/types';

function newClientRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function centsToEurosInput(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}

type QuoteLineDraft = {
  key: string;
  materialKey: string;
  description: string;
  quantity: string;
  unitPrice: string;
  leadDays: string;
};

function newLineKey(): string {
  return `ln-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyQuoteLine(): QuoteLineDraft {
  return {
    key: newLineKey(),
    materialKey: '',
    description: '',
    quantity: '1',
    unitPrice: '',
    leadDays: '',
  };
}

type PoLineDraft = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  vatPercent: string;
};

function emptyPoLine(): PoLineDraft {
  return {
    key: newLineKey(),
    description: '',
    quantity: '1',
    unitPrice: '',
    vatPercent: '21',
  };
}

function eurosToCents(raw: string): number {
  const n = Number(raw.trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

type Tab =
  | 'directorio'
  | 'presupuestos'
  | 'pedidos'
  | 'compras-kioskos'
  | 'comparar';

export function SuppliersHub({
  suppliers,
  quotes,
  quoteDocumentsById,
  quoteLinesById,
  generalPurchases,
  purchaseDocumentsById,
  purchaseLinesById,
  contactsBySupplier,
  activityBySupplier,
  compareOffers: _compareOffers,
  compareKey,
  purchases,
  documentsByOrderId,
  canWrite,
  canApprove,
  canPurchasingWrite,
  canReceive,
  canSeeFinancial,
  initialTab,
  initialQuoteId,
  initialPoId,
  loadError,
  purchasesError,
  generalPurchasesError,
}: {
  suppliers: SupplierRow[];
  quotes: SupplierQuoteRow[];
  quoteDocumentsById: Record<string, SupplierQuoteDocumentRow[]>;
  quoteLinesById: Record<string, SupplierQuoteLineRow[]>;
  generalPurchases: SupplierPurchaseOrderRow[];
  purchaseDocumentsById: Record<string, SupplierPurchaseDocumentRow[]>;
  purchaseLinesById: Record<string, SupplierPurchaseLineRow[]>;
  contactsBySupplier: Record<string, SupplierContactRow[]>;
  activityBySupplier: Record<string, SupplierActivityRow[]>;
  compareOffers?: unknown[];
  compareKey: string;
  purchases: Array<KioskPurchaseOrderOperational | KioskPurchaseOrderFinancial>;
  documentsByOrderId: Record<string, KioskPurchaseDocumentMeta[]>;
  canWrite: boolean;
  canApprove: boolean;
  canPurchasingWrite: boolean;
  canReceive: boolean;
  canSeeFinancial: boolean;
  initialTab?: string;
  initialQuoteId?: string | null;
  initialPoId?: string | null;
  loadError?: string | null;
  purchasesError?: string | null;
  generalPurchasesError?: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>(() => {
    if (
      initialTab === 'presupuestos' ||
      initialTab === 'pedidos' ||
      initialTab === 'directorio' ||
      initialTab === 'compras-kioskos' ||
      initialTab === 'comparar'
    ) {
      return initialTab;
    }
    if (initialQuoteId) return 'presupuestos';
    if (initialPoId) return 'pedidos';
    return 'directorio';
  });
  const [busy, setBusy] = React.useState(false);
  const lock = React.useRef(false);
  const quoteFormRef = React.useRef<HTMLDivElement | null>(null);
  const poFormRef = React.useRef<HTMLDivElement | null>(null);
  const bootstrappedQuote = React.useRef<string | null>(null);
  const bootstrappedPo = React.useRef<string | null>(null);

  function syncUrl(next: {
    tab?: Tab;
    quote?: string | null;
    po?: string | null;
  }) {
    const params = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : ''
    );
    const t = next.tab ?? tab;
    params.set('tab', t);
    if (next.quote === null) params.delete('quote');
    else if (next.quote) params.set('quote', next.quote);
    if (next.po === null) params.delete('po');
    else if (next.po) params.set('po', next.po);
    const qs = params.toString();
    router.replace(qs ? `/proveedores?${qs}` : '/proveedores', {
      scroll: false,
    });
  }

  const [selectedId, setSelectedId] = React.useState<string | null>(
    suppliers[0]?.id ?? null
  );
  const [legalName, setLegalName] = React.useState('');
  const [tradeName, setTradeName] = React.useState('');
  const [taxId, setTaxId] = React.useState('');
  const [category, setCategory] = React.useState<SupplierCategory>('otros');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [paymentTerms, setPaymentTerms] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const [contactName, setContactName] = React.useState('');
  const [contactEmail, setContactEmail] = React.useState('');
  const [contactPhone, setContactPhone] = React.useState('');

  const [selectedQuoteId, setSelectedQuoteId] = React.useState<string | null>(
    initialQuoteId ?? null
  );
  const [quoteTitle, setQuoteTitle] = React.useState('');
  const [quoteNumber, setQuoteNumber] = React.useState('');
  const [quoteNotes, setQuoteNotes] = React.useState('');
  const [quoteRejectionReason, setQuoteRejectionReason] = React.useState('');
  const [quoteSupplierId, setQuoteSupplierId] = React.useState(
    suppliers[0]?.id ?? ''
  );
  const [quoteStatus, setQuoteStatus] =
    React.useState<SupplierQuoteStatus>('recibido');
  const [shipping, setShipping] = React.useState('');
  const [quoteLinesDraft, setQuoteLinesDraft] = React.useState<QuoteLineDraft[]>(
    [emptyQuoteLine()]
  );
  const [compareMode, setCompareMode] =
    React.useState<QuoteCompareMode>('lines');
  const [compareSelectedIds, setCompareSelectedIds] = React.useState<string[]>(
    () => (compareKey ? quotes.map((q) => q.id).slice(0, 8) : [])
  );
  const [compareMaterialFilter, setCompareMaterialFilter] = React.useState(
    compareKey || ''
  );
  const [acceptQuoteConfirmId, setAcceptQuoteConfirmId] = React.useState<
    string | null
  >(null);

  const [showPoForm, setShowPoForm] = React.useState(Boolean(initialPoId));
  const [editingPurchaseId, setEditingPurchaseId] = React.useState<
    string | null
  >(null);
  const [editingPurchaseNumber, setEditingPurchaseNumber] = React.useState<
    string | null
  >(null);
  const [poSourceQuoteId, setPoSourceQuoteId] = React.useState<string>('none');
  const [poQuoteId, setPoQuoteId] = React.useState<string | null>(null);
  const [poClientRequestId, setPoClientRequestId] = React.useState(() =>
    newClientRequestId()
  );
  const [poSupplierId, setPoSupplierId] = React.useState('');
  const [poCategory, setPoCategory] = React.useState<SupplierCategory>('otros');
  const [poTitle, setPoTitle] = React.useState('');
  const [poStatus, setPoStatus] =
    React.useState<SupplierPurchaseStatus>('borrador');
  const [poOrderedAt, setPoOrderedAt] = React.useState('');
  const [poExpected, setPoExpected] = React.useState('');
  const [poShipping, setPoShipping] = React.useState('');
  const [poShippingIncludesVat, setPoShippingIncludesVat] =
    React.useState(false);
  const [poShippingVatPercent, setPoShippingVatPercent] = React.useState('21');
  const [poNotes, setPoNotes] = React.useState('');
  const [poLinesDraft, setPoLinesDraft] = React.useState<PoLineDraft[]>([
    emptyPoLine(),
  ]);
  const [selectedPurchaseId, setSelectedPurchaseId] = React.useState<
    string | null
  >(null);
  const [poDocType, setPoDocType] =
    React.useState<SupplierPurchaseDocType>('invoice');
  const [confirmPedidoOpen, setConfirmPedidoOpen] = React.useState(false);

  const selected = suppliers.find((s) => s.id === selectedId) ?? null;
  const acceptedQuotes = quotes.filter((q) => q.status === 'aprobado');
  const quotesWithActivePo = new Set(
    generalPurchases
      .filter((o) => o.quoteId && o.status !== 'cancelado')
      .map((o) => o.quoteId as string)
  );

  const poParsedLines = poLinesDraft.map((l) => ({
    description: l.description,
    quantity: Number(l.quantity.replace(',', '.')),
    unitPriceCents: l.unitPrice.trim() ? eurosToCents(l.unitPrice) : 0,
    vatBps: vatPercentToBps(Number(l.vatPercent.replace(',', '.'))),
  }));
  const poShippingCents = poShipping.trim() ? eurosToCents(poShipping) : 0;
  const poShippingVatBps = vatPercentToBps(
    Number(poShippingVatPercent.replace(',', '.') || '21')
  );
  const poValidation = validatePurchaseDraft({
    supplierId: poSupplierId,
    title: poTitle,
    orderedAt: poOrderedAt,
    lines: poParsedLines,
    shippingCents: poShippingCents,
    shippingIncludesVat: poShippingIncludesVat,
    shippingVatBps: poShippingVatBps,
    requireShippingInformed: true,
    shippingInformed: poShipping.trim() !== '',
  });
  const poMoney = poValidation.money;
  const poPending = poValidation.issues.filter((i) => i.blockingForConfirm);
  const poTotalQty =
    poMoney?.lines.reduce((a, l) => a + l.quantity, 0) ?? 0;
  const poUnitCostCents =
    poMoney && poTotalQty > 0
      ? Math.round(
          (poMoney.subtotalCents + poMoney.shippingNetCents) / poTotalQty
        )
      : null;

  const compareLineOffersRaw = collectLineOffers(
    quotes,
    quoteLinesById,
    compareSelectedIds
  );
  const compareLineOffers = filterLineOffersByMaterialKey(
    compareLineOffersRaw,
    compareMaterialFilter
  );
  const compareFullOffers = collectFullQuoteOffers(
    quotes,
    quoteLinesById,
    compareSelectedIds
  );
  const compareLineCheapestId = cheapestLineOfferId(compareLineOffers);
  const compareFullCheapestId = cheapestFullQuoteId(compareFullOffers);
  const compareWarnings =
    compareMode === 'lines'
      ? equivalenceWarningsForLines(compareLineOffers)
      : equivalenceWarningsForQuotes(compareFullOffers);

  function toggleCompareQuote(quoteId: string) {
    setCompareSelectedIds((prev) =>
      prev.includes(quoteId)
        ? prev.filter((id) => id !== quoteId)
        : [...prev, quoteId]
    );
  }

  async function acceptQuoteFromCompare(quoteId: string) {
    const q = quotes.find((x) => x.id === quoteId);
    if (!q) {
      toast.error('Presupuesto no encontrado');
      return;
    }
    if (!canApprove) {
      toast.error('Sin permiso para aceptar presupuestos');
      return;
    }
    const res = await upsertSupplierQuoteAction({
      id: q.id,
      supplierId: q.supplierId,
      title: q.title,
      quoteNumber: q.quoteNumber,
      status: 'aprobado',
      shippingCents: q.shippingCents,
      notes: q.notes,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      'Oferta aceptada. No se ha generado pedido automáticamente.'
    );
    setAcceptQuoteConfirmId(null);
    router.refresh();
  }

  function applyQuoteToForm(
    quote: SupplierQuoteRow,
    lines: SupplierQuoteLineRow[]
  ) {
    setSelectedQuoteId(quote.id);
    setQuoteSupplierId(quote.supplierId);
    setQuoteTitle(quote.title);
    setQuoteNumber(quote.quoteNumber ?? '');
    setQuoteNotes(quote.notes ?? '');
    setQuoteRejectionReason(quote.rejectionReason ?? '');
    setQuoteStatus(quote.status);
    setShipping(centsToEurosInput(quote.shippingCents));
    if (lines.length === 0) {
      setQuoteLinesDraft([emptyQuoteLine()]);
    } else {
      setQuoteLinesDraft(
        lines.map((l) => ({
          key: l.id || newLineKey(),
          materialKey: l.materialKey,
          description: l.description,
          quantity: String(l.quantity),
          unitPrice: centsToEurosInput(l.unitPriceCents),
          leadDays: l.leadDays != null ? String(l.leadDays) : '',
        }))
      );
    }
  }

  function resetQuoteForm() {
    setSelectedQuoteId(null);
    setQuoteTitle('');
    setQuoteNumber('');
    setQuoteNotes('');
    setQuoteRejectionReason('');
    setQuoteStatus('recibido');
    setShipping('');
    setQuoteLinesDraft([emptyQuoteLine()]);
    setQuoteSupplierId(suppliers[0]?.id ?? '');
    syncUrl({ tab: 'presupuestos', quote: null });
  }

  async function openQuoteById(quoteId: string) {
    setTab('presupuestos');
    syncUrl({ tab: 'presupuestos', quote: quoteId });
    // Precarga inmediata desde props (si existen) para feedback UI.
    const cached = quotes.find((x) => x.id === quoteId);
    if (cached) {
      applyQuoteToForm(cached, quoteLinesById[quoteId] ?? []);
    }
    quoteFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const res = await loadSupplierQuoteDetailAction(quoteId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    applyQuoteToForm(res.quote, res.lines);
    quoteFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openQuote(q: SupplierQuoteRow) {
    void openQuoteById(q.id);
  }

  function resetPoForm(opts?: { keepRequestId?: boolean; open?: boolean }) {
    setEditingPurchaseId(null);
    setEditingPurchaseNumber(null);
    setSelectedPurchaseId(null);
    setPoSourceQuoteId('none');
    setPoQuoteId(null);
    if (!opts?.keepRequestId) setPoClientRequestId(newClientRequestId());
    setPoSupplierId('');
    setPoCategory('otros');
    setPoTitle('');
    setPoStatus('borrador');
    setPoOrderedAt('');
    setPoExpected('');
    setPoShipping('');
    setPoShippingIncludesVat(false);
    setPoShippingVatPercent('21');
    setPoNotes(DEFAULT_PO_UNIT_PRICE_NOTE);
    setPoLinesDraft([emptyPoLine()]);
    setConfirmPedidoOpen(false);
    setShowPoForm(opts?.open ?? false);
    syncUrl({ tab: 'pedidos', po: null });
  }

  function startNewPurchase() {
    resetPoForm({ open: true });
    setShowPoForm(true);
    setPoOrderedAt(new Date().toISOString().slice(0, 10));
    setPoShipping('0');
    setTimeout(
      () =>
        poFormRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        }),
      50
    );
  }

  function applyPurchaseToForm(
    o: SupplierPurchaseOrderRow,
    lines: SupplierPurchaseLineRow[]
  ) {
    setShowPoForm(true);
    setSelectedPurchaseId(o.id);
    setEditingPurchaseId(o.id);
    setEditingPurchaseNumber(o.orderNumber);
    setPoQuoteId(o.quoteId);
    setPoSourceQuoteId(o.quoteId ?? 'none');
    setPoSupplierId(o.supplierId);
    setPoCategory(o.category);
    setPoTitle(o.title);
    setPoStatus(o.status);
    setPoOrderedAt(o.orderedAt ? o.orderedAt.slice(0, 10) : '');
    setPoExpected(o.expectedDeliveryAt ? o.expectedDeliveryAt.slice(0, 10) : '');
    setPoShipping(centsToEurosInput(o.shippingCents));
    setPoShippingIncludesVat(Boolean(o.shippingIncludesVat));
    setPoShippingVatPercent('21');
    setPoNotes(o.notes ?? '');
    if (lines.length === 0) {
      setPoLinesDraft([emptyPoLine()]);
    } else {
      setPoLinesDraft(
        lines.map((l) => ({
          key: l.id || newLineKey(),
          description: l.description,
          quantity: String(l.quantity),
          unitPrice: centsToEurosInput(l.unitPriceCents),
          vatPercent: String(vatBpsToPercent(l.vatBps || DEFAULT_VAT_BPS)),
        }))
      );
    }
  }

  async function openPurchaseById(purchaseId: string) {
    setTab('pedidos');
    setShowPoForm(true);
    syncUrl({ tab: 'pedidos', po: purchaseId });
    const cached = generalPurchases.find((x) => x.id === purchaseId);
    if (cached) {
      applyPurchaseToForm(cached, purchaseLinesById[purchaseId] ?? []);
    }
    poFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const res = await loadSupplierPurchaseDetailAction(purchaseId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    applyPurchaseToForm(res.order, res.lines);
    poFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openPurchase(o: SupplierPurchaseOrderRow) {
    void openPurchaseById(o.id);
  }

  function preloadFromAcceptedQuote(quoteId: string) {
    if (quoteId === 'none') {
      setPoSourceQuoteId('none');
      setPoQuoteId(null);
      setPoClientRequestId(newClientRequestId());
      setPoNotes(DEFAULT_PO_UNIT_PRICE_NOTE);
      return;
    }
    const q = quotes.find((x) => x.id === quoteId);
    if (!q) return;
    setPoSourceQuoteId(quoteId);
    setPoQuoteId(quoteId);
    setEditingPurchaseId(null);
    setPoClientRequestId(newClientRequestId());
    setPoSupplierId(q.supplierId);
    setPoCategory(q.supplierCategory ?? 'otros');
    setPoTitle(q.title);
    setPoStatus('borrador');
    setPoShipping(centsToEurosInput(q.shippingCents));
    setPoShippingIncludesVat(false);
    setPoNotes(
      withDefaultPoNoteOnCreate(
        [
          q.notes ? `Condiciones: ${q.notes}` : null,
          `Origen presupuesto: ${q.title}`,
        ]
          .filter(Boolean)
          .join('\n')
      )
    );
    const lines = quoteLinesById[q.id] ?? [];
    if (lines.length === 0) {
      setPoLinesDraft([emptyPoLine()]);
    } else {
      setPoLinesDraft(
        lines.map((l) => ({
          key: l.id || newLineKey(),
          description: l.description || l.materialKey,
          quantity: String(l.quantity),
          unitPrice: centsToEurosInput(l.unitPriceCents),
          vatPercent: String(vatBpsToPercent(l.vatBps || DEFAULT_VAT_BPS)),
        }))
      );
    }
  }

  async function savePurchaseOrder(opts: {
    status: SupplierPurchaseStatus;
    requireComplete: boolean;
    confirm?: boolean;
  }) {
    if (opts.requireComplete && poPending.length > 0) {
      toast.error(poPending[0]!.message);
      return;
    }
    if (!poSupplierId) {
      toast.error('Selecciona proveedor');
      return;
    }
    if (!poTitle.trim()) {
      toast.error('Indica un título');
      return;
    }
    const lines = poParsedLines
      .filter((l) => l.description.trim() && l.quantity > 0)
      .map((l) => ({
        description: l.description.trim(),
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        vatBps: l.vatBps,
      }));
    // Confirmación: guardar datos en borrador y luego RPC de número.
    const persistStatus: SupplierPurchaseStatus =
      opts.confirm || opts.status === 'pedido'
        ? poStatus === 'borrador' || !editingPurchaseId
          ? 'borrador'
          : poStatus
        : opts.status;
    const res = await upsertGeneralPurchaseOrderAction({
      id: editingPurchaseId,
      supplierId: poSupplierId,
      quoteId: poQuoteId,
      category: poCategory,
      title: poTitle,
      status: persistStatus,
      orderedAt: poOrderedAt || null,
      expectedDeliveryAt: poExpected || null,
      subtotalCents: poMoney?.subtotalCents ?? null,
      taxCents: poMoney?.taxCents ?? null,
      shippingCents: poShipping.trim() === '' ? null : poShippingCents,
      shippingIncludesVat: poShippingIncludesVat,
      totalCents: poMoney?.totalCents ?? null,
      notes: poNotes || null,
      clientRequestId: editingPurchaseId ? null : poClientRequestId,
      replaceLines: true,
      lines,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    if (opts.confirm) {
      const orderedAt =
        poOrderedAt.trim() || new Date().toISOString().slice(0, 10);
      const confirmed = await confirmGeneralPurchaseOrderAction({
        id: res.id,
        orderedAt,
        expectedDeliveryAt: poExpected || null,
      });
      if (!confirmed.ok) {
        toast.error(confirmed.error);
        await openPurchaseById(res.id);
        router.refresh();
        return;
      }
      toast.success(
        confirmed.alreadyConfirmed
          ? `Pedido ya confirmado: ${confirmed.orderNumber}`
          : `Pedido confirmado: ${confirmed.orderNumber}`
      );
      setPoStatus('pedido');
      setConfirmPedidoOpen(false);
      setPoClientRequestId(newClientRequestId());
      await openPurchaseById(confirmed.id);
      router.refresh();
      return;
    }

    toast.success(
      editingPurchaseId
        ? 'Borrador actualizado'
        : 'Borrador guardado (sin número; compra no confirmada)'
    );
    setPoClientRequestId(newClientRequestId());
    setConfirmPedidoOpen(false);
    await openPurchaseById(res.id);
    router.refresh();
  }

  React.useEffect(() => {
    if (!initialQuoteId || bootstrappedQuote.current === initialQuoteId) return;
    bootstrappedQuote.current = initialQuoteId;
    void openQuoteById(initialQuoteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuoteId]);

  React.useEffect(() => {
    if (!initialPoId || bootstrappedPo.current === initialPoId) return;
    bootstrappedPo.current = initialPoId;
    void openPurchaseById(initialPoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPoId]);

  React.useEffect(() => {
    if (!selected) {
      setLegalName('');
      setTradeName('');
      setTaxId('');
      setCategory('otros');
      setEmail('');
      setPhone('');
      setPaymentTerms('');
      setNotes('');
      return;
    }
    setLegalName(selected.legalName);
    setTradeName(selected.tradeName ?? '');
    setTaxId(selected.taxId ?? '');
    setCategory(selected.category);
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

  async function openSigned(path: string) {
    const res = await getSupplierDocSignedUrlAction(path);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    window.open(res.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['directorio', 'Directorio'],
            ['presupuestos', 'Presupuestos'],
            ['pedidos', 'Pedidos de compra'],
            ['compras-kioskos', 'Compras de kioskos'],
            ['comparar', 'Comparar presupuestos'],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={tab === id ? 'default' : 'outline'}
            onClick={() => {
              setTab(id);
              syncUrl({
                tab: id,
                quote: id === 'presupuestos' ? selectedQuoteId : null,
                po: id === 'pedidos' ? selectedPurchaseId : null,
              });
            }}
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
                    setCategory('otros');
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
                        {SUPPLIER_CATEGORY_LABELS[s.category]}
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
                <Label>Categoría</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as SupplierCategory)}
                  disabled={!canWrite || busy}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {SUPPLIER_CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                      toast.success(
                        selectedId ? 'Proveedor actualizado' : 'Proveedor creado'
                      );
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
            <div
              ref={quoteFormRef}
              className="space-y-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">
                    {selectedQuoteId
                      ? 'Editar presupuesto'
                      : 'Registrar presupuesto'}
                  </h2>
                  {selectedQuoteId ? (
                    <p className="text-xs text-muted-foreground">
                      ID: {selectedQuoteId}
                    </p>
                  ) : null}
                </div>
                {selectedQuoteId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => resetQuoteForm()}
                  >
                    Nuevo presupuesto
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Proveedor</Label>
                  <Select
                    value={quoteSupplierId}
                    onValueChange={setQuoteSupplierId}
                    disabled={Boolean(selectedQuoteId)}
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
                    disabled={
                      (quoteStatus === 'aprobado' ||
                        quoteStatus === 'rechazado') &&
                      !canApprove
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPLIER_QUOTE_UI_STATUSES.map((s) => (
                        <SelectItem
                          key={s}
                          value={s}
                          disabled={
                            (s === 'aprobado' || s === 'rechazado') &&
                            !canApprove
                          }
                        >
                          {SUPPLIER_QUOTE_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                      {quoteStatus === 'caducado' ? (
                        <SelectItem value="caducado">
                          {SUPPLIER_QUOTE_STATUS_LABELS.caducado}
                        </SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Nº presupuesto</Label>
                  <Input
                    value={quoteNumber}
                    onChange={(e) => setQuoteNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Título</Label>
                  <Input
                    value={quoteTitle}
                    onChange={(e) => setQuoteTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Transporte (€)</Label>
                  <Input
                    value={shipping}
                    onChange={(e) => setShipping(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Notas / condiciones</Label>
                  <Textarea
                    value={quoteNotes}
                    onChange={(e) => setQuoteNotes(e.target.value)}
                    rows={2}
                  />
                </div>
                {quoteStatus === 'rechazado' ? (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Motivo de rechazo</Label>
                    <Textarea
                      value={quoteRejectionReason}
                      onChange={(e) => setQuoteRejectionReason(e.target.value)}
                      rows={2}
                      required
                    />
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Líneas</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setQuoteLinesDraft((prev) => [...prev, emptyQuoteLine()])
                    }
                  >
                    Añadir línea
                  </Button>
                </div>
                {quoteLinesDraft.map((line, idx) => (
                  <div
                    key={line.key}
                    className="grid gap-2 rounded-lg border border-border/70 p-3 sm:grid-cols-6"
                  >
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Material</Label>
                      <Input
                        value={line.materialKey}
                        onChange={(e) =>
                          setQuoteLinesDraft((prev) =>
                            prev.map((l, i) =>
                              i === idx
                                ? { ...l, materialKey: e.target.value }
                                : l
                            )
                          )
                        }
                        placeholder="ej. flyer-a5"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Descripción</Label>
                      <Input
                        value={line.description}
                        onChange={(e) =>
                          setQuoteLinesDraft((prev) =>
                            prev.map((l, i) =>
                              i === idx
                                ? { ...l, description: e.target.value }
                                : l
                            )
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cantidad</Label>
                      <Input
                        value={line.quantity}
                        onChange={(e) =>
                          setQuoteLinesDraft((prev) =>
                            prev.map((l, i) =>
                              i === idx
                                ? { ...l, quantity: e.target.value }
                                : l
                            )
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Precio u. (€)</Label>
                      <Input
                        value={line.unitPrice}
                        onChange={(e) =>
                          setQuoteLinesDraft((prev) =>
                            prev.map((l, i) =>
                              i === idx
                                ? { ...l, unitPrice: e.target.value }
                                : l
                            )
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Plazo (días)</Label>
                      <Input
                        value={line.leadDays}
                        onChange={(e) =>
                          setQuoteLinesDraft((prev) =>
                            prev.map((l, i) =>
                              i === idx
                                ? { ...l, leadDays: e.target.value }
                                : l
                            )
                          )
                        }
                      />
                    </div>
                    <div className="flex items-end sm:col-span-4">
                      {quoteLinesDraft.length > 1 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setQuoteLinesDraft((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                        >
                          Quitar línea
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busy || !quoteSupplierId}
                  onClick={() =>
                    run(async () => {
                      const lines = quoteLinesDraft
                        .filter(
                          (l) => l.materialKey.trim() || l.description.trim()
                        )
                        .map((l) => {
                          const qty = Number(l.quantity.replace(',', '.'));
                          return {
                            materialKey:
                              l.materialKey.trim() ||
                              l.description.trim().toLowerCase().slice(0, 40),
                            description:
                              l.description.trim() || l.materialKey.trim(),
                            quantity:
                              Number.isFinite(qty) && qty > 0 ? qty : 1,
                            unitPriceCents: eurosToCents(l.unitPrice),
                            leadDays: l.leadDays
                              ? Number(l.leadDays)
                              : null,
                          };
                        });
                      const res = await upsertSupplierQuoteAction({
                        id: selectedQuoteId,
                        supplierId: quoteSupplierId,
                        title: quoteTitle,
                        quoteNumber: quoteNumber || null,
                        status: quoteStatus,
                        shippingCents: shipping
                          ? eurosToCents(shipping)
                          : null,
                        notes: quoteNotes || null,
                        rejectionReason:
                          quoteStatus === 'rechazado'
                            ? quoteRejectionReason
                            : null,
                        replaceLines: true,
                        lines,
                      });
                      if (!res.ok) {
                        toast.error(res.error);
                        return;
                      }
                      toast.success(
                        selectedQuoteId
                          ? 'Cambios guardados en el presupuesto'
                          : 'Presupuesto registrado'
                      );
                      setSelectedQuoteId(res.id);
                      syncUrl({ tab: 'presupuestos', quote: res.id });
                      // Recargar ficha completa desde servidor (mismo ID).
                      const detail = await loadSupplierQuoteDetailAction(res.id);
                      if (detail.ok) {
                        applyQuoteToForm(detail.quote, detail.lines);
                      }
                      router.refresh();
                    })
                  }
                >
                  {selectedQuoteId ? 'Guardar cambios' : 'Guardar presupuesto'}
                </Button>
                {selectedQuoteId && quoteStatus === 'aprobado' ? (
                  quotesWithActivePo.has(selectedQuoteId) ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        const po = generalPurchases.find(
                          (o) =>
                            o.quoteId === selectedQuoteId &&
                            o.status !== 'cancelado'
                        );
                        if (po) void openPurchaseById(po.id);
                        else setTab('pedidos');
                      }}
                    >
                      Ver pedido
                    </Button>
                  ) : canWrite ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const res = await createPurchaseFromQuoteAction({
                            quoteId: selectedQuoteId,
                            clientRequestId: newClientRequestId(),
                          });
                          if (!res.ok) {
                            toast.error(res.error);
                            return;
                          }
                          toast.success(
                            res.alreadyExisted
                              ? 'Pedido ya vinculado; abierto'
                              : 'Pedido de compra creado en borrador (compra no confirmada)'
                          );
                          await openPurchaseById(res.id);
                          router.refresh();
                        })
                      }
                    >
                      Crear pedido de compra
                    </Button>
                  ) : null
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">Título</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Adjuntos</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {quotes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                      Sin presupuestos registrados.
                    </td>
                  </tr>
                ) : (
                  quotes.map((q) => (
                    <tr
                      key={q.id}
                      className={`border-b border-border/70 align-top cursor-pointer ${
                        selectedQuoteId === q.id ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => openQuote(q)}
                    >
                      <td className="px-3 py-2">{q.supplierName ?? '—'}</td>
                      <td className="px-3 py-2">{q.title}</td>
                      <td className="px-3 py-2">
                        {SUPPLIER_QUOTE_STATUS_LABELS[q.status] ?? q.status}
                        {q.status === 'rechazado' && q.rejectionReason ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {q.rejectionReason}
                          </p>
                        ) : null}
                      </td>
                      <td
                        className="px-3 py-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ul className="space-y-1 text-xs">
                          {(quoteDocumentsById[q.id] ?? []).map((d) => (
                            <li key={d.id}>
                              <button
                                type="button"
                                className="text-primary underline-offset-2 hover:underline"
                                onClick={() => openSigned(d.storagePath)}
                              >
                                {d.fileName}
                              </button>
                            </li>
                          ))}
                          {(quoteDocumentsById[q.id] ?? []).length === 0 ? (
                            <li className="text-muted-foreground">Sin archivos</li>
                          ) : null}
                        </ul>
                        {canWrite ? (
                          <label className="mt-2 inline-flex cursor-pointer text-xs text-primary underline-offset-2 hover:underline">
                            Adjuntar PDF/Excel/imagen
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.xls,.xlsx,.png,.jpg,.jpeg,application/pdf,image/*,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (!file) return;
                                run(async () => {
                                  const fd = new FormData();
                                  fd.set('quoteId', q.id);
                                  fd.set('file', file);
                                  const res =
                                    await uploadSupplierQuoteDocumentAction(fd);
                                  if (!res.ok) {
                                    toast.error(res.error);
                                    return;
                                  }
                                  toast.success('Adjunto subido');
                                  router.refresh();
                                });
                              }}
                            />
                          </label>
                        ) : null}
                      </td>
                      <td
                        className="px-3 py-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-col gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openQuote(q)}
                          >
                            Abrir / editar
                          </Button>
                          {q.status === 'aprobado' &&
                          quotesWithActivePo.has(q.id) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => {
                                const po = generalPurchases.find(
                                  (o) =>
                                    o.quoteId === q.id &&
                                    o.status !== 'cancelado'
                                );
                                if (po) void openPurchaseById(po.id);
                                else setTab('pedidos');
                              }}
                            >
                              Ver pedido
                            </Button>
                          ) : canWrite && q.status === 'aprobado' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() =>
                                run(async () => {
                                  const res =
                                    await createPurchaseFromQuoteAction({
                                      quoteId: q.id,
                                      clientRequestId: newClientRequestId(),
                                    });
                                  if (!res.ok) {
                                    toast.error(res.error);
                                    return;
                                  }
                                  toast.success(
                                    res.alreadyExisted
                                      ? 'Pedido ya vinculado; abierto'
                                      : 'Pedido de compra creado en borrador (compra no confirmada)'
                                  );
                                  await openPurchaseById(res.id);
                                  router.refresh();
                                })
                              }
                            >
                              Crear pedido de compra
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'pedidos' ? (
        <div className="space-y-6">
          {generalPurchasesError ? (
            <p className="text-sm text-destructive">{generalPurchasesError}</p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Pedidos de compra</h2>
              <p className="text-xs text-muted-foreground">
                Listado de pedidos generales. Abre uno para editarlo o crea un
                borrador nuevo.
              </p>
            </div>
            {canWrite ? (
              <Button type="button" size="sm" onClick={() => startNewPurchase()}>
                <Plus className="mr-1 h-4 w-4" />
                Nuevo pedido
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Nº</th>
                    <th className="px-3 py-2">Proveedor</th>
                    <th className="px-3 py-2">Título</th>
                    <th className="px-3 py-2">Origen</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {generalPurchases.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-6 text-muted-foreground"
                      >
                        Sin pedidos de compra.
                      </td>
                    </tr>
                  ) : (
                    generalPurchases.map((o) => (
                      <tr
                        key={o.id}
                        className={`border-b border-border/70 ${
                          selectedPurchaseId === o.id ||
                          editingPurchaseId === o.id
                            ? 'bg-primary/5'
                            : ''
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-xs">
                          {o.orderNumber ?? '—'}
                        </td>
                        <td className="px-3 py-2">{o.supplierName ?? '—'}</td>
                        <td className="px-3 py-2">{o.title}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {o.quoteTitle
                            ? `Presupuesto: ${o.quoteTitle}`
                            : 'Sin presupuesto'}
                        </td>
                        <td className="px-3 py-2">
                          {SUPPLIER_PO_STATUS_LABELS[o.status]}
                        </td>
                        <td className="px-3 py-2">
                          {formatCents(o.totalCents)}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openPurchase(o)}
                          >
                            Abrir / editar
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">Documentos / facturas</h3>
              {!selectedPurchaseId ? (
                <p className="text-sm text-muted-foreground">
                  Abre un pedido para ver o subir documentos.
                </p>
              ) : (
                <>
                  <ul className="space-y-1 text-sm">
                    {(purchaseDocumentsById[selectedPurchaseId] ?? []).map(
                      (d) => (
                        <li key={d.id}>
                          <button
                            type="button"
                            className="text-primary underline-offset-2 hover:underline"
                            onClick={() => openSigned(d.storagePath)}
                          >
                            [{SUPPLIER_PO_DOC_LABELS[d.docType]}] {d.fileName}
                          </button>
                        </li>
                      )
                    )}
                    {(purchaseDocumentsById[selectedPurchaseId] ?? []).length ===
                    0 ? (
                      <li className="text-muted-foreground">Sin documentos.</li>
                    ) : null}
                  </ul>
                  {canWrite ? (
                    <div className="space-y-2">
                      <Select
                        value={poDocType}
                        onValueChange={(v) =>
                          setPoDocType(v as SupplierPurchaseDocType)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPLIER_PO_DOC_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {SUPPLIER_PO_DOC_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <label className="inline-flex cursor-pointer text-sm text-primary underline-offset-2 hover:underline">
                        Subir documento
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.xls,.xlsx,.png,.jpg,.jpeg,application/pdf,image/*,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file || !selectedPurchaseId) return;
                            run(async () => {
                              const fd = new FormData();
                              fd.set('purchaseOrderId', selectedPurchaseId);
                              fd.set('docType', poDocType);
                              fd.set('file', file);
                              const res = await uploadPurchaseDocumentAction(fd);
                              if (!res.ok) {
                                toast.error(res.error);
                                return;
                              }
                              toast.success('Documento subido');
                              router.refresh();
                            });
                          }}
                        />
                      </label>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {canWrite && showPoForm ? (
            <div
              ref={poFormRef}
              className="space-y-4 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">
                    {editingPurchaseId
                      ? 'Editar pedido de compra'
                      : 'Nuevo pedido de compra'}
                  </h2>
                  {editingPurchaseNumber ? (
                    <p className="text-sm font-medium">
                      Nº pedido:{' '}
                      <span className="font-mono">{editingPurchaseNumber}</span>
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (inmutable)
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Borrador sin número. El correlativo YYYY/######## se
                      asigna solo al confirmar Pedido.
                    </p>
                  )}
                  {editingPurchaseId ? (
                    <p className="text-[10px] text-muted-foreground">
                      ID interno: {editingPurchaseId}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => resetPoForm()}
                >
                  Cerrar formulario
                </Button>
              </div>

              {!editingPurchaseId ? (
                <div className="space-y-1.5">
                  <Label>Origen</Label>
                  <Select
                    value={poSourceQuoteId}
                    onValueChange={(v) => preloadFromAcceptedQuote(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pedido sin presupuesto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        Pedido sin presupuesto
                      </SelectItem>
                      {acceptedQuotes.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.supplierName ?? 'Proveedor'} · {q.title}
                          {quotesWithActivePo.has(q.id) ? ' (ya vinculado)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Desde presupuesto aceptado se precargan proveedor, líneas e
                    importes. No confirma la compra.
                  </p>
                </div>
              ) : poQuoteId ? (
                <p className="text-xs text-muted-foreground">
                  Vinculado a presupuesto origen ·{' '}
                  {generalPurchases.find((o) => o.id === editingPurchaseId)
                    ?.quoteTitle ?? poQuoteId}
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Proveedor</Label>
                  <Select
                    value={poSupplierId}
                    onValueChange={setPoSupplierId}
                    disabled={Boolean(poQuoteId)}
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
                  <Label>Categoría</Label>
                  <Select
                    value={poCategory}
                    onValueChange={(v) => setPoCategory(v as SupplierCategory)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPLIER_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {SUPPLIER_CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Estado</Label>
                  <Input
                    value={SUPPLIER_PO_STATUS_LABELS[poStatus] ?? poStatus}
                    readOnly
                    className="bg-muted/40"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Título</Label>
                  <Input
                    value={poTitle}
                    onChange={(e) => setPoTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha pedido</Label>
                  <Input
                    type="date"
                    value={poOrderedAt}
                    onChange={(e) => setPoOrderedAt(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Entrega prevista</Label>
                  <Input
                    type="date"
                    value={poExpected}
                    onChange={(e) => setPoExpected(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Líneas</h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPoLinesDraft((prev) => [...prev, emptyPoLine()])
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Añadir línea
                  </Button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[960px] text-left text-sm">
                    <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2">Descripción</th>
                        <th className="px-2 py-2">Cant.</th>
                        <th className="px-2 py-2">P. unit. s/IVA</th>
                        <th className="px-2 py-2">IVA %</th>
                        <th className="px-2 py-2">Base</th>
                        <th className="px-2 py-2">Cuota IVA</th>
                        <th className="px-2 py-2">Total línea</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {poLinesDraft.map((line, idx) => {
                        const qty = Number(line.quantity.replace(',', '.'));
                        const unitCents = line.unitPrice.trim()
                          ? eurosToCents(line.unitPrice)
                          : 0;
                        const vatBps = vatPercentToBps(
                          Number(line.vatPercent.replace(',', '.') || '21')
                        );
                        const canCalc = Number.isFinite(qty) && qty > 0;
                        const netCents = canCalc
                          ? Math.round(qty * unitCents)
                          : null;
                        const vatCents =
                          netCents != null
                            ? Math.round((netCents * vatBps) / 10000)
                            : null;
                        const lineTotalCents =
                          netCents != null && vatCents != null
                            ? netCents + vatCents
                            : null;
                        return (
                          <tr
                            key={line.key}
                            className="border-b border-border/70 align-top"
                          >
                            <td className="px-2 py-2">
                              <Input
                                value={line.description}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setPoLinesDraft((prev) =>
                                    prev.map((l, i) =>
                                      i === idx ? { ...l, description: v } : l
                                    )
                                  );
                                }}
                              />
                            </td>
                            <td className="px-2 py-2 w-24">
                              <Input
                                value={line.quantity}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setPoLinesDraft((prev) =>
                                    prev.map((l, i) =>
                                      i === idx ? { ...l, quantity: v } : l
                                    )
                                  );
                                }}
                                inputMode="decimal"
                              />
                            </td>
                            <td className="px-2 py-2 w-32">
                              <Input
                                value={line.unitPrice}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setPoLinesDraft((prev) =>
                                    prev.map((l, i) =>
                                      i === idx ? { ...l, unitPrice: v } : l
                                    )
                                  );
                                }}
                                inputMode="decimal"
                              />
                            </td>
                            <td className="px-2 py-2 w-24">
                              <Input
                                value={line.vatPercent}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setPoLinesDraft((prev) =>
                                    prev.map((l, i) =>
                                      i === idx ? { ...l, vatPercent: v } : l
                                    )
                                  );
                                }}
                                inputMode="decimal"
                              />
                            </td>
                            <td className="px-2 py-2 text-muted-foreground">
                              {formatCents(netCents)}
                            </td>
                            <td className="px-2 py-2 text-muted-foreground">
                              {formatCents(vatCents)}
                            </td>
                            <td className="px-2 py-2 text-muted-foreground">
                              {formatCents(lineTotalCents)}
                            </td>
                            <td className="px-2 py-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={poLinesDraft.length <= 1}
                                onClick={() =>
                                  setPoLinesDraft((prev) =>
                                    prev.length <= 1
                                      ? prev
                                      : prev.filter((_, i) => i !== idx)
                                  )
                                }
                              >
                                Quitar
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Transporte (€)</Label>
                  <Input
                    value={poShipping}
                    onChange={(e) => setPoShipping(e.target.value)}
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>IVA transporte (%)</Label>
                  <Input
                    value={poShippingVatPercent}
                    onChange={(e) => setPoShippingVatPercent(e.target.value)}
                    inputMode="decimal"
                    disabled={poShippingIncludesVat}
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={poShippingIncludesVat}
                      onChange={(e) =>
                        setPoShippingIncludesVat(e.target.checked)
                      }
                    />
                    El transporte incluye IVA
                  </label>
                </div>
              </div>

              <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Base imponible productos
                  </p>
                  <p className="text-sm font-medium">
                    {formatCents(poMoney?.subtotalCents)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">IVA productos</p>
                  <p className="text-sm font-medium">
                    {formatCents(poMoney?.productVatCents)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Transporte sin IVA
                  </p>
                  <p className="text-sm font-medium">
                    {formatCents(poMoney?.shippingNetCents)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    IVA del transporte
                  </p>
                  <p className="text-sm font-medium">
                    {formatCents(poMoney?.shippingVatCents)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Total pedido con IVA
                  </p>
                  <p className="text-sm font-semibold">
                    {formatCents(poMoney?.totalCents)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Coste unit. s/IVA c/ transporte
                  </p>
                  <p className="text-sm font-medium">
                    {formatCents(poUnitCostCents)}
                  </p>
                </div>
              </div>

              {poPending.length > 0 ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                  <p className="font-medium">Campos pendientes</p>
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {poPending.map((i) => (
                      <li key={i.field}>{i.message}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs">
                    Puedes guardar como borrador. Para confirmar Pedido debes
                    completarlos.
                  </p>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label>Notas</Label>
                <Textarea
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !poSupplierId || !poTitle.trim()}
                  onClick={() =>
                    run(async () => {
                      await savePurchaseOrder({
                        status: 'borrador',
                        requireComplete: false,
                      });
                    })
                  }
                >
                  Guardar borrador
                </Button>
                {poStatus === 'borrador' || !editingPurchaseId ? (
                  <Button
                    type="button"
                    disabled={busy || poPending.length > 0}
                    onClick={() => {
                      if (!poOrderedAt.trim()) {
                        setPoOrderedAt(new Date().toISOString().slice(0, 10));
                      }
                      if (poShipping.trim() === '') setPoShipping('0');
                      setConfirmPedidoOpen(true);
                    }}
                  >
                    Confirmar Pedido
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={busy || poPending.length > 0}
                    onClick={() =>
                      run(async () => {
                        await savePurchaseOrder({
                          status: poStatus === 'cancelado' ? 'pedido' : poStatus,
                          requireComplete: true,
                        });
                      })
                    }
                  >
                    Guardar cambios
                  </Button>
                )}
              </div>

              {confirmPedidoOpen ? (
                <div className="space-y-3 rounded-lg border border-border bg-background p-3">
                  <p className="text-sm">
                    ¿Confirmar este borrador como Pedido? Se validarán proveedor,
                    fecha, líneas, precios e impuestos. Se asignará un número
                    correlativo anual (p. ej. 2026/00000001) en la misma
                    operación. No se puede deshacer la numeración.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await savePurchaseOrder({
                            status: 'pedido',
                            requireComplete: true,
                            confirm: true,
                          });
                        })
                      }
                    >
                      Sí, confirmar Pedido
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setConfirmPedidoOpen(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'compras-kioskos' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Vista operativa de pedidos de compra con categoría kioskos
            (extensión 1:1 de{' '}
            <code className="text-xs">platform_supplier_purchase_orders</code>
            ). Los importes canónicos viven en «Pedidos de compra»; aquí se
            gestionan modelo, unidades, plazo y recepción a inventario. La
            recepción real de activos KSK requiere la migración 065 (ausente en
            staging).
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
              extensionOnly
            />
          )}
        </div>
      ) : null}

      {tab === 'comparar' ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold">Comparar presupuestos</h2>
            <p className="text-sm text-muted-foreground">
              Compara ofertas de proveedores para productos, materiales, hardware
              y servicios. No incluye presupuestos comerciales enviados a
              farmacias. Aceptar una oferta no genera pedido automáticamente.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Presupuestos</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setCompareSelectedIds(
                      compareSelectedIds.length === quotes.length
                        ? []
                        : quotes.map((q) => q.id)
                    )
                  }
                >
                  {compareSelectedIds.length === quotes.length
                    ? 'Quitar todos'
                    : 'Seleccionar todos'}
                </Button>
              </div>
              {quotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay presupuestos de proveedores.
                </p>
              ) : (
                <ul className="max-h-[420px] space-y-2 overflow-y-auto text-sm">
                  {quotes.map((q) => (
                    <li key={q.id}>
                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={compareSelectedIds.includes(q.id)}
                          onChange={() => toggleCompareQuote(q.id)}
                        />
                        <span>
                          <span className="font-medium">
                            {q.supplierName ?? 'Proveedor'}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {q.title} ·{' '}
                            {SUPPLIER_QUOTE_STATUS_LABELS[q.status]}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label>Modo</Label>
                  <Select
                    value={compareMode}
                    onValueChange={(v) =>
                      setCompareMode(v as QuoteCompareMode)
                    }
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lines">
                        Líneas equivalentes
                      </SelectItem>
                      <SelectItem value="quotes">
                        Presupuestos completos
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[200px] flex-1 space-y-1.5">
                  <Label>
                    Filtro opcional (clave material / descripción)
                  </Label>
                  <Input
                    value={compareMaterialFilter}
                    onChange={(e) =>
                      setCompareMaterialFilter(e.target.value)
                    }
                    placeholder="Compatible con claves ya guardadas"
                  />
                </div>
              </div>

              {compareWarnings.length > 0 ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-50">
                  <p className="font-medium">Atención: ofertas no equivalentes</p>
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {compareWarnings.map((w) => (
                      <li key={`${w.code}-${w.groupKey ?? ''}`}>
                        {w.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {compareMode === 'lines' ? (
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full min-w-[1100px] text-left text-sm">
                    <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Grupo</th>
                        <th className="px-3 py-2">Proveedor</th>
                        <th className="px-3 py-2">Descripción</th>
                        <th className="px-3 py-2">Cant.</th>
                        <th className="px-3 py-2">P. unit. s/IVA</th>
                        <th className="px-3 py-2">Impuestos</th>
                        <th className="px-3 py-2">Transporte</th>
                        <th className="px-3 py-2">Coste u. real</th>
                        <th className="px-3 py-2">Plazo</th>
                        <th className="px-3 py-2">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareSelectedIds.length === 0 ? (
                        <tr>
                          <td
                            colSpan={10}
                            className="px-3 py-6 text-muted-foreground"
                          >
                            Selecciona uno o más presupuestos para comparar.
                          </td>
                        </tr>
                      ) : compareLineOffers.length === 0 ? (
                        <tr>
                          <td
                            colSpan={10}
                            className="px-3 py-6 text-muted-foreground"
                          >
                            Sin líneas que coincidan con el filtro o la
                            selección.
                          </td>
                        </tr>
                      ) : (
                        compareLineOffers.map((o) => {
                          const rowId = `${o.quoteId}:${o.lineId}`;
                          const isBest = rowId === compareLineCheapestId;
                          return (
                            <tr
                              key={rowId}
                              className={`border-b border-border/70 ${
                                isBest ? 'bg-emerald-500/10' : ''
                              }`}
                            >
                              <td className="px-3 py-2 text-xs">
                                {o.groupLabel}
                                {isBest ? (
                                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                    Más económica
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-2">{o.supplierName}</td>
                              <td className="px-3 py-2">
                                <div>{o.description || '—'}</div>
                                <div className="text-xs text-muted-foreground">
                                  {o.quoteTitle}
                                  {o.materialKey
                                    ? ` · ${o.materialKey}`
                                    : ''}
                                </div>
                              </td>
                              <td className="px-3 py-2">{o.quantity}</td>
                              <td className="px-3 py-2">
                                {formatCents(o.unitPriceCents)}
                              </td>
                              <td className="px-3 py-2">
                                {formatCents(o.taxCents)}
                                <span className="block text-[10px] text-muted-foreground">
                                  {o.vatBps / 100}%
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {formatCents(o.shippingCents)}
                                <span className="block text-[10px] text-muted-foreground">
                                  cuota {formatCents(o.shippingShareCents)}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-medium">
                                {formatCents(o.unitCostExVatWithShippingCents)}
                              </td>
                              <td className="px-3 py-2">
                                {o.leadDays == null
                                  ? '—'
                                  : `${o.leadDays} d`}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-col gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void openQuoteById(o.quoteId)}
                                  >
                                    Abrir
                                  </Button>
                                  {(quoteDocumentsById[o.quoteId] ?? []).map(
                                    (d) => (
                                      <button
                                        key={d.id}
                                        type="button"
                                        className="text-left text-xs text-primary underline-offset-2 hover:underline"
                                        onClick={() =>
                                          openSigned(d.storagePath)
                                        }
                                      >
                                        {d.fileName}
                                      </button>
                                    )
                                  )}
                                  {canApprove &&
                                  o.quoteStatus !== 'aprobado' &&
                                  o.quoteStatus !== 'archivado' ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      disabled={busy}
                                      onClick={() =>
                                        setAcceptQuoteConfirmId(o.quoteId)
                                      }
                                    >
                                      Aceptar oferta
                                    </Button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full min-w-[960px] text-left text-sm">
                    <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Proveedor</th>
                        <th className="px-3 py-2">Presupuesto</th>
                        <th className="px-3 py-2">Líneas</th>
                        <th className="px-3 py-2">Base s/IVA</th>
                        <th className="px-3 py-2">Impuestos</th>
                        <th className="px-3 py-2">Transporte</th>
                        <th className="px-3 py-2">Total comparable</th>
                        <th className="px-3 py-2">Coste u. real</th>
                        <th className="px-3 py-2">Plazo</th>
                        <th className="px-3 py-2">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareFullOffers.length === 0 ? (
                        <tr>
                          <td
                            colSpan={10}
                            className="px-3 py-6 text-muted-foreground"
                          >
                            Selecciona presupuestos para comparar.
                          </td>
                        </tr>
                      ) : (
                        compareFullOffers.map((o) => {
                          const isBest = o.quoteId === compareFullCheapestId;
                          return (
                            <tr
                              key={o.quoteId}
                              className={`border-b border-border/70 ${
                                isBest ? 'bg-emerald-500/10' : ''
                              }`}
                            >
                              <td className="px-3 py-2">
                                {o.supplierName}
                                {isBest ? (
                                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                    Más económica
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-2">
                                {o.quoteTitle}
                                <span className="block text-xs text-muted-foreground">
                                  {SUPPLIER_QUOTE_STATUS_LABELS[o.quoteStatus]}
                                </span>
                              </td>
                              <td className="px-3 py-2">{o.lineCount}</td>
                              <td className="px-3 py-2">
                                {formatCents(o.subtotalCents)}
                              </td>
                              <td className="px-3 py-2">
                                {formatCents(o.taxCents)}
                              </td>
                              <td className="px-3 py-2">
                                {formatCents(o.shippingCents)}
                              </td>
                              <td className="px-3 py-2 font-medium">
                                {formatCents(o.comparableTotalExVatCents)}
                              </td>
                              <td className="px-3 py-2">
                                {formatCents(o.unitCostExVatWithShippingCents)}
                              </td>
                              <td className="px-3 py-2">
                                {o.leadDaysMin == null
                                  ? '—'
                                  : o.leadDaysMin === o.leadDaysMax
                                    ? `${o.leadDaysMin} d`
                                    : `${o.leadDaysMin}–${o.leadDaysMax} d`}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-col gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void openQuoteById(o.quoteId)}
                                  >
                                    Abrir
                                  </Button>
                                  {(quoteDocumentsById[o.quoteId] ?? []).map(
                                    (d) => (
                                      <button
                                        key={d.id}
                                        type="button"
                                        className="text-left text-xs text-primary underline-offset-2 hover:underline"
                                        onClick={() =>
                                          openSigned(d.storagePath)
                                        }
                                      >
                                        {d.fileName}
                                      </button>
                                    )
                                  )}
                                  {canApprove &&
                                  o.quoteStatus !== 'aprobado' &&
                                  o.quoteStatus !== 'archivado' ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      disabled={busy}
                                      onClick={() =>
                                        setAcceptQuoteConfirmId(o.quoteId)
                                      }
                                    >
                                      Aceptar oferta
                                    </Button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {acceptQuoteConfirmId ? (
                <div className="space-y-3 rounded-lg border border-border bg-background p-3">
                  <p className="text-sm">
                    ¿Aceptar esta oferta? Se marcará el presupuesto como
                    Aceptado. No se creará ningún pedido de compra.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await acceptQuoteFromCompare(acceptQuoteConfirmId);
                        })
                      }
                    >
                      Sí, aceptar oferta
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setAcceptQuoteConfirmId(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
