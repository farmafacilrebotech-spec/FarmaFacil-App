'use client';

import * as React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  Plus,
  Search,
} from 'lucide-react';
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
import { AdminWideDialog } from '@/components/shared/admin-wide-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
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
  SUPPLIER_QUOTE_STATUSES,
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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES');
}

/** Timestamp comparable; null/invalid → -Infinity (va al final en orden desc). */
function tsOf(iso: string | null | undefined): number {
  if (!iso) return Number.NEGATIVE_INFINITY;
  const t = Date.parse(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

function cmpDesc(a: number, b: number): number {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

const esCollator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/** Importe aproximado de un presupuesto: líneas con IVA + transporte (si hay líneas). */
function quoteTotalCents(
  q: SupplierQuoteRow,
  lines: SupplierQuoteLineRow[] | undefined
): number | null {
  if (!lines || lines.length === 0) return null;
  let total = 0;
  let net = 0;
  for (const l of lines) {
    const n = Math.round(l.quantity * l.unitPriceCents);
    net += n;
    total += n + Math.round((n * (l.vatBps ?? 0)) / 10000);
  }
  if (net <= 0) return null;
  return total + (q.shippingCents ?? 0);
}

/**
 * Detecta cambios sin guardar comparando una firma del formulario con la
 * firma "limpia". Llama a markClean() en el mismo lote que los setState que
 * cargan/restablecen el formulario.
 */
function useFormBaseline(signature: string) {
  const [baseline, setBaseline] = React.useState<string | null>(null);
  const [token, setToken] = React.useState(0);
  const pending = React.useRef(true);
  React.useEffect(() => {
    if (pending.current) {
      pending.current = false;
      setBaseline(signature);
    }
  }, [token, signature]);
  const markClean = React.useCallback(() => {
    pending.current = true;
    setToken((t) => t + 1);
  }, []);
  return { dirty: baseline !== null && signature !== baseline, markClean };
}

type SortDir = 'asc' | 'desc';
type DirSortKey = 'name' | 'category' | 'taxId' | 'email' | 'phone';

function SortTh<K extends string>({
  label,
  k,
  sort,
  onSort,
}: {
  label: string;
  k: K;
  sort: { key: K; dir: SortDir };
  onSort: (k: K) => void;
}) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      className="px-3 py-2"
      aria-sort={
        active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
      }
    >
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground',
          active && 'text-foreground'
        )}
        onClick={() => onSort(k)}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

function MaterialChips({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const shown = items.slice(0, 3);
  const rest = items.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1" title={items.join(', ')}>
      {shown.map((m) => (
        <span
          key={m}
          className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
        >
          {m}
        </span>
      ))}
      {rest > 0 ? (
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          +{rest}
        </span>
      ) : null}
    </div>
  );
}

/** Solo documentos docType==='invoice'. Los clics no deben abrir el modal del pedido. */
function InvoiceCell({
  invoices,
  onOpen,
}: {
  invoices: SupplierPurchaseDocumentRow[];
  onOpen: (storagePath: string) => void;
}) {
  if (invoices.length === 0) {
    return <span className="text-xs text-muted-foreground">Sin factura</span>;
  }
  const linkClass =
    'text-xs text-primary underline-offset-2 hover:underline';
  if (invoices.length === 1) {
    return (
      <button
        type="button"
        className={linkClass}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(invoices[0]!.storagePath);
        }}
      >
        Ver factura
      </button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={linkClass}
          onClick={(e) => e.stopPropagation()}
        >
          Ver facturas ({invoices.length})
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {invoices.map((d) => (
          <DropdownMenuItem
            key={d.id}
            onClick={(e) => e.stopPropagation()}
            onSelect={() => onOpen(d.storagePath)}
          >
            {d.fileName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
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

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [supplierDialogOpen, setSupplierDialogOpen] = React.useState(false);
  const [dirSearch, setDirSearch] = React.useState('');
  const [dirCategory, setDirCategory] = React.useState('all');
  const [dirMaterial, setDirMaterial] = React.useState('all');
  const [dirSort, setDirSort] = React.useState<{
    key: DirSortKey;
    dir: SortDir;
  }>({ key: 'name', dir: 'asc' });
  const [quoteDialogOpen, setQuoteDialogOpen] = React.useState(
    Boolean(initialQuoteId)
  );
  const [quoteFilterSupplier, setQuoteFilterSupplier] = React.useState('all');
  const [quoteFilterMaterial, setQuoteFilterMaterial] = React.useState('all');
  const [quoteFilterStatus, setQuoteFilterStatus] = React.useState('all');
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

  const { dirty: supplierDirty, markClean: markSupplierClean } =
    useFormBaseline(
      JSON.stringify([
        legalName,
        tradeName,
        taxId,
        category,
        email,
        phone,
        paymentTerms,
        notes,
        contactName,
        contactEmail,
        contactPhone,
      ])
    );
  const { dirty: quoteDirty, markClean: markQuoteClean } = useFormBaseline(
    JSON.stringify([
      quoteSupplierId,
      quoteTitle,
      quoteNumber,
      quoteNotes,
      quoteRejectionReason,
      quoteStatus,
      shipping,
      quoteLinesDraft.map((l) => [
        l.materialKey,
        l.description,
        l.quantity,
        l.unitPrice,
        l.leadDays,
      ]),
    ])
  );
  const { dirty: poDirty, markClean: markPoClean } = useFormBaseline(
    JSON.stringify([
      poSupplierId,
      poQuoteId,
      poCategory,
      poTitle,
      poOrderedAt,
      poExpected,
      poShipping,
      poShippingIncludesVat,
      poShippingVatPercent,
      poNotes,
      poLinesDraft.map((l) => [
        l.description,
        l.quantity,
        l.unitPrice,
        l.vatPercent,
      ]),
    ])
  );

  // Materiales por proveedor: solo líneas de presupuesto guardadas con
  // materialKey (no se infiere nada de texto libre).
  const materialsBySupplier = React.useMemo(() => {
    const bySupplier = new Map<string, Map<string, string>>();
    for (const q of quotes) {
      if (q.status === 'archivado') continue;
      for (const l of quoteLinesById[q.id] ?? []) {
        const key = (l.materialKey ?? '').trim();
        if (!key) continue;
        const m = bySupplier.get(q.supplierId) ?? new Map<string, string>();
        if (!m.has(key.toLowerCase())) m.set(key.toLowerCase(), key);
        bySupplier.set(q.supplierId, m);
      }
    }
    const out: Record<string, string[]> = {};
    bySupplier.forEach((m, id) => {
      out[id] = Array.from(m.values()).sort(esCollator.compare);
    });
    return out;
  }, [quotes, quoteLinesById]);

  const materialsByQuote = React.useMemo(() => {
    const out: Record<string, Set<string>> = {};
    for (const q of quotes) {
      out[q.id] = new Set(
        (quoteLinesById[q.id] ?? [])
          .map((l) => (l.materialKey ?? '').trim().toLowerCase())
          .filter(Boolean)
      );
    }
    return out;
  }, [quotes, quoteLinesById]);

  const allMaterials = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const q of quotes) {
      for (const l of quoteLinesById[q.id] ?? []) {
        const key = (l.materialKey ?? '').trim();
        if (key && !m.has(key.toLowerCase())) m.set(key.toLowerCase(), key);
      }
    }
    return Array.from(m.values()).sort(esCollator.compare);
  }, [quotes, quoteLinesById]);

  const dirRows = React.useMemo(() => {
    const term = dirSearch.trim().toLowerCase();
    const matMatch = dirMaterial.toLowerCase();
    const rows = suppliers.filter((s) => {
      if (dirCategory !== 'all' && s.category !== dirCategory) return false;
      if (dirMaterial !== 'all') {
        const mats = (materialsBySupplier[s.id] ?? []).map((x) =>
          x.toLowerCase()
        );
        if (!mats.includes(matMatch)) return false;
      }
      if (!term) return true;
      const hay = [
        s.legalName,
        s.tradeName,
        s.taxId,
        s.email,
        s.phone,
        ...(contactsBySupplier[s.id] ?? []).flatMap((c) => [
          c.fullName,
          c.email,
          c.phone,
        ]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(term);
    });
    const val = (s: SupplierRow): string => {
      switch (dirSort.key) {
        case 'category':
          return SUPPLIER_CATEGORY_LABELS[s.category];
        case 'taxId':
          return s.taxId ?? '';
        case 'email':
          return s.email ?? '';
        case 'phone':
          return s.phone ?? '';
        default:
          return s.legalName;
      }
    };
    const mult = dirSort.dir === 'asc' ? 1 : -1;
    return [...rows].sort(
      (a, b) =>
        mult * esCollator.compare(val(a), val(b)) ||
        esCollator.compare(a.legalName, b.legalName) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
  }, [
    suppliers,
    contactsBySupplier,
    materialsBySupplier,
    dirSearch,
    dirCategory,
    dirMaterial,
    dirSort,
  ]);

  const quoteRows = React.useMemo(() => {
    const matKey = quoteFilterMaterial.toLowerCase();
    return quotes
      .filter((q) => {
        if (quoteFilterSupplier !== 'all' && q.supplierId !== quoteFilterSupplier)
          return false;
        if (quoteFilterStatus !== 'all' && q.status !== quoteFilterStatus)
          return false;
        if (
          quoteFilterMaterial !== 'all' &&
          !materialsByQuote[q.id]?.has(matKey)
        )
          return false;
        return true;
      })
      .sort(
        (a, b) =>
          cmpDesc(tsOf(a.createdAt), tsOf(b.createdAt)) ||
          cmpDesc(tsOf(a.updatedAt), tsOf(b.updatedAt)) ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      );
  }, [
    quotes,
    materialsByQuote,
    quoteFilterSupplier,
    quoteFilterMaterial,
    quoteFilterStatus,
  ]);

  const poRows = React.useMemo(
    () =>
      [...generalPurchases].sort(
        (a, b) =>
          cmpDesc(tsOf(a.orderedAt), tsOf(b.orderedAt)) ||
          cmpDesc(tsOf(a.createdAt), tsOf(b.createdAt)) ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      ),
    [generalPurchases]
  );

  function invoicesOf(orderId: string): SupplierPurchaseDocumentRow[] {
    return (purchaseDocumentsById[orderId] ?? [])
      .filter((d) => d.docType === 'invoice')
      .sort((a, b) => cmpDesc(tsOf(a.createdAt), tsOf(b.createdAt)));
  }

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
    markQuoteClean();
  }

  function resetQuoteForm(opts?: { skipUrl?: boolean }) {
    setSelectedQuoteId(null);
    setQuoteTitle('');
    setQuoteNumber('');
    setQuoteNotes('');
    setQuoteRejectionReason('');
    setQuoteStatus('recibido');
    setShipping('');
    setQuoteLinesDraft([emptyQuoteLine()]);
    setQuoteSupplierId(suppliers[0]?.id ?? '');
    markQuoteClean();
    if (!opts?.skipUrl) syncUrl({ tab: 'presupuestos', quote: null });
  }

  function startNewQuote() {
    resetQuoteForm();
    setQuoteDialogOpen(true);
  }

  function closeQuoteDialog(opts?: { force?: boolean; skipUrl?: boolean }) {
    // La confirmación de cambios sin guardar la gestiona AdminWideDialog.
    setQuoteDialogOpen(false);
    resetQuoteForm({ skipUrl: opts?.skipUrl });
  }

  async function openQuoteById(quoteId: string) {
    setTab('presupuestos');
    setQuoteDialogOpen(true);
    syncUrl({ tab: 'presupuestos', quote: quoteId });
    // Precarga inmediata desde props (si existen) para feedback UI.
    const cached = quotes.find((x) => x.id === quoteId);
    if (cached) {
      applyQuoteToForm(cached, quoteLinesById[quoteId] ?? []);
    }
    const res = await loadSupplierQuoteDetailAction(quoteId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    applyQuoteToForm(res.quote, res.lines);
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
    markPoClean();
    syncUrl({ tab: 'pedidos', po: null });
  }

  function startNewPurchase() {
    resetPoForm({ open: true });
    setShowPoForm(true);
    setPoOrderedAt(new Date().toISOString().slice(0, 10));
    setPoShipping('0');
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
    markPoClean();
  }

  async function openPurchaseById(purchaseId: string) {
    setTab('pedidos');
    setShowPoForm(true);
    syncUrl({ tab: 'pedidos', po: purchaseId });
    const cached = generalPurchases.find((x) => x.id === purchaseId);
    if (cached) {
      applyPurchaseToForm(cached, purchaseLinesById[purchaseId] ?? []);
    }
    const res = await loadSupplierPurchaseDetailAction(purchaseId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    applyPurchaseToForm(res.order, res.lines);
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

  function loadSupplierIntoForm(sup: SupplierRow | null) {
    setLegalName(sup?.legalName ?? '');
    setTradeName(sup?.tradeName ?? '');
    setTaxId(sup?.taxId ?? '');
    setCategory(sup?.category ?? 'otros');
    setEmail(sup?.email ?? '');
    setPhone(sup?.phone ?? '');
    setPaymentTerms(sup?.paymentTerms ?? '');
    setNotes(sup?.notes ?? '');
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    markSupplierClean();
  }

  function openSupplier(sup: SupplierRow) {
    setSelectedId(sup.id);
    loadSupplierIntoForm(sup);
    setSupplierDialogOpen(true);
  }

  function startNewSupplier() {
    setSelectedId(null);
    loadSupplierIntoForm(null);
    setSupplierDialogOpen(true);
  }

  function closeSupplierDialog(_opts?: { force?: boolean }) {
    // La confirmación de cambios sin guardar la gestiona AdminWideDialog.
    setSupplierDialogOpen(false);
    setSelectedId(null);
    loadSupplierIntoForm(null);
  }

  function toggleDirSort(key: DirSortKey) {
    setDirSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
  }

  async function saveSupplier() {
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
    markSupplierClean();
    router.refresh();
  }

  async function saveQuote() {
    const lines = quoteLinesDraft
      .filter((l) => l.materialKey.trim() || l.description.trim())
      .map((l) => {
        const qty = Number(l.quantity.replace(',', '.'));
        return {
          materialKey:
            l.materialKey.trim() ||
            l.description.trim().toLowerCase().slice(0, 40),
          description: l.description.trim() || l.materialKey.trim(),
          quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
          unitPriceCents: eurosToCents(l.unitPrice),
          leadDays: l.leadDays ? Number(l.leadDays) : null,
        };
      });
    const res = await upsertSupplierQuoteAction({
      id: selectedQuoteId,
      supplierId: quoteSupplierId,
      title: quoteTitle,
      quoteNumber: quoteNumber || null,
      status: quoteStatus,
      shippingCents: shipping ? eurosToCents(shipping) : null,
      notes: quoteNotes || null,
      rejectionReason:
        quoteStatus === 'rechazado' ? quoteRejectionReason : null,
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
    } else {
      markQuoteClean();
    }
    router.refresh();
  }

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
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">
                Directorio de proveedores
              </h2>
              <p className="text-xs text-muted-foreground">
                {dirRows.length} de {suppliers.length} proveedores. Doble clic
                en una fila (o «Abrir») para ver la ficha.
              </p>
            </div>
            {canWrite ? (
              <Button
                type="button"
                size="sm"
                className="gap-1"
                disabled={busy}
                onClick={() => startNewSupplier()}
              >
                <Plus className="h-4 w-4" /> Nuevo proveedor
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label htmlFor="dir-search">Buscar</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dir-search"
                  className="pl-8"
                  placeholder="Nombre, CIF/NIF o contacto"
                  value={dirSearch}
                  onChange={(e) => setDirSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={dirCategory} onValueChange={setDirCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {SUPPLIER_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {SUPPLIER_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Material</Label>
              <Select value={dirMaterial} onValueChange={setDirMaterial}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {allMaterials.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {dirSearch || dirCategory !== 'all' || dirMaterial !== 'all' ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDirSearch('');
                  setDirCategory('all');
                  setDirMaterial('all');
                }}
              >
                Limpiar filtros
              </Button>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <SortTh
                    label="Razón social / nombre comercial"
                    k="name"
                    sort={dirSort}
                    onSort={toggleDirSort}
                  />
                  <SortTh
                    label="Categoría"
                    k="category"
                    sort={dirSort}
                    onSort={toggleDirSort}
                  />
                  <th className="px-3 py-2">Materiales</th>
                  <SortTh
                    label="CIF/NIF"
                    k="taxId"
                    sort={dirSort}
                    onSort={toggleDirSort}
                  />
                  <SortTh
                    label="Email"
                    k="email"
                    sort={dirSort}
                    onSort={toggleDirSort}
                  />
                  <SortTh
                    label="Teléfono"
                    k="phone"
                    sort={dirSort}
                    onSort={toggleDirSort}
                  />
                  <th className="px-3 py-2">Estado / acciones</th>
                </tr>
              </thead>
              <tbody>
                {dirRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-muted-foreground">
                      {suppliers.length === 0
                        ? 'Sin proveedores. Alta manual (sin datos ficticios).'
                        : 'Ningún proveedor coincide con los filtros.'}
                    </td>
                  </tr>
                ) : (
                  dirRows.map((s) => (
                    <tr
                      key={s.id}
                      className="cursor-pointer border-b border-border/70 align-top hover:bg-muted/30"
                      onDoubleClick={() => openSupplier(s)}
                      title="Doble clic para abrir la ficha"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{s.legalName}</div>
                        {s.tradeName ? (
                          <div className="text-xs text-muted-foreground">
                            {s.tradeName}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        {SUPPLIER_CATEGORY_LABELS[s.category]}
                      </td>
                      <td className="px-3 py-2">
                        <MaterialChips items={materialsBySupplier[s.id] ?? []} />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {s.taxId || '—'}
                      </td>
                      <td className="px-3 py-2">{s.email || '—'}</td>
                      <td className="px-3 py-2">{s.phone || '—'}</td>
                      <td
                        className="px-3 py-2"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              s.status === 'archived' ? 'secondary' : 'outline'
                            }
                          >
                            {s.status === 'archived' ? 'Archivado' : 'Activo'}
                          </Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              openSupplier(s);
                            }}
                          >
                            Abrir
                          </Button>
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

      {tab === 'presupuestos' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">
                Presupuestos de proveedores
              </h2>
              <p className="text-xs text-muted-foreground">
                Más recientes primero. Doble clic en una fila (o «Abrir») para
                editar.
              </p>
            </div>
            {canWrite ? (
              <Button
                type="button"
                size="sm"
                className="gap-1"
                disabled={busy}
                onClick={() => startNewQuote()}
              >
                <Plus className="h-4 w-4" /> Nuevo presupuesto
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Select value={quoteFilterSupplier} onValueChange={setQuoteFilterSupplier}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.legalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Material</Label>
              <Select value={quoteFilterMaterial} onValueChange={setQuoteFilterMaterial}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {allMaterials.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={quoteFilterStatus} onValueChange={setQuoteFilterStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {SUPPLIER_QUOTE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SUPPLIER_QUOTE_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {quoteFilterSupplier !== 'all' ||
            quoteFilterMaterial !== 'all' ||
            quoteFilterStatus !== 'all' ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuoteFilterSupplier('all');
                  setQuoteFilterMaterial('all');
                  setQuoteFilterStatus('all');
                }}
              >
                Limpiar filtros
              </Button>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">N.º presupuesto</th>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">Título</th>
                  <th
                    className="px-3 py-2 text-right"
                    title="Suma de líneas con IVA + transporte, cuando hay líneas guardadas"
                  >
                    Importe total
                  </th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Adjuntos</th>
                  <th className="px-3 py-2 text-right">Abrir</th>
                </tr>
              </thead>
              <tbody>
                {quoteRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-muted-foreground">
                      {quotes.length === 0
                        ? 'Sin presupuestos registrados.'
                        : 'Ningún presupuesto coincide con los filtros.'}
                    </td>
                  </tr>
                ) : (
                  quoteRows.map((q) => {
                    const docs = quoteDocumentsById[q.id] ?? [];
                    return (
                      <tr
                        key={q.id}
                        className={`cursor-pointer border-b border-border/70 align-top hover:bg-muted/30 ${
                          selectedQuoteId === q.id ? 'bg-primary/5' : ''
                        }`}
                        onDoubleClick={() => openQuote(q)}
                        title="Doble clic para abrir el presupuesto"
                      >
                        <td className="whitespace-nowrap px-3 py-2">
                          {formatDate(q.createdAt)}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {q.quoteNumber || '—'}
                        </td>
                        <td className="px-3 py-2">{q.supplierName ?? '—'}</td>
                        <td className="px-3 py-2">{q.title}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                          {formatCents(
                            quoteTotalCents(q, quoteLinesById[q.id])
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {SUPPLIER_QUOTE_STATUS_LABELS[q.status] ?? q.status}
                          {q.status === 'rechazado' && q.rejectionReason ? (
                            <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">
                              {q.rejectionReason}
                            </p>
                          ) : null}
                        </td>
                        <td
                          className="px-3 py-2"
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => e.stopPropagation()}
                        >
                          {docs.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              Sin archivos
                            </span>
                          ) : (
                            <ul className="space-y-1 text-xs">
                              {docs.map((d) => (
                                <li key={d.id}>
                                  <button
                                    type="button"
                                    className="text-left text-primary underline-offset-2 hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void openSigned(d.storagePath);
                                    }}
                                  >
                                    {d.fileName}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
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
                              openQuote(q);
                            }}
                          >
                            Abrir
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'pedidos' ? (
        <div className="space-y-4">
          {generalPurchasesError ? (
            <p className="text-sm text-destructive">{generalPurchasesError}</p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Pedidos de compra</h2>
              <p className="text-xs text-muted-foreground">
                Más recientes primero (fecha de pedido, después alta). Doble
                clic en una fila (o «Abrir») para editar.
              </p>
            </div>
            {canWrite ? (
              <Button
                type="button"
                size="sm"
                className="gap-1"
                disabled={busy}
                onClick={() => startNewPurchase()}
              >
                <Plus className="h-4 w-4" /> Nuevo pedido
              </Button>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2"><span className="sr-only">Abrir</span></th>
                  <th className="px-3 py-2">N.º pedido</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">Concepto / título</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 text-right">Total con IVA</th>
                  <th className="px-3 py-2">Factura</th>
                </tr>
              </thead>
              <tbody>
                {poRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-muted-foreground">
                      Sin pedidos de compra.
                    </td>
                  </tr>
                ) : (
                  poRows.map((o) => (
                    <tr
                      key={o.id}
                      className={`cursor-pointer border-b border-border/70 align-top hover:bg-muted/30 ${
                        selectedPurchaseId === o.id ||
                        editingPurchaseId === o.id
                          ? 'bg-primary/5'
                          : ''
                      }`}
                      onDoubleClick={() => openPurchase(o)}
                      title="Doble clic para abrir el pedido"
                    >
                      <td
                        className="px-3 py-2"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openPurchase(o);
                          }}
                        >
                          Abrir
                        </Button>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {o.orderNumber ? (
                          o.orderNumber
                        ) : (
                          <span className="font-sans text-muted-foreground">
                            {o.status === 'borrador'
                              ? 'Borrador (sin número)'
                              : 'Sin número (legacy)'}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatDate(o.orderedAt)}
                      </td>
                      <td className="px-3 py-2">{o.supplierName ?? '—'}</td>
                      <td className="px-3 py-2">
                        <div>{o.title}</div>
                        {o.quoteTitle ? (
                          <div className="text-xs text-muted-foreground">
                            Presupuesto: {o.quoteTitle}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        {SUPPLIER_PO_STATUS_LABELS[o.status]}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {formatCents(o.totalCents)}
                      </td>
                      <td
                        className="px-3 py-2"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <InvoiceCell
                          invoices={invoicesOf(o.id)}
                          onOpen={(path) => void openSigned(path)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'compras-kioskos' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Vista operativa de pedidos de compra con categoría kioskos
            (extensión 1:1 de{' '}
            <code className="text-xs">platform_supplier_purchase_orders</code>
            ). Los importes canónicos viven en «Pedidos de compra»; aquí se
            consultan modelo, unidades, plazo y recepción a inventario.
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
              onOpenGeneralOrder={(id) => void openPurchaseById(id)}
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

      <AdminWideDialog
        open={supplierDialogOpen}
        onOpenChange={(o) => {
          if (!o) closeSupplierDialog();
        }}
        title={selected ? selected.legalName : 'Nuevo proveedor'}
        description={
          selected
            ? 'Ficha del proveedor, contactos y actividad.'
            : 'Alta de proveedor (sin datos ficticios).'
        }
        dirty={supplierDirty}
        size="2xl"
        footer={
          <>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cerrar
              </Button>
            </DialogClose>
            {canWrite && selectedId ? (
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
                    closeSupplierDialog({ force: true });
                    router.refresh();
                  })
                }
              >
                Archivar
              </Button>
            ) : null}
            {canWrite ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => run(saveSupplier)}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Guardar
              </Button>
            ) : null}
          </>
        }
      >
        <div className="space-y-4">
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

          {!canWrite ? (
            <p className="text-sm text-muted-foreground">Solo lectura.</p>
          ) : null}
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
      </AdminWideDialog>

      <AdminWideDialog
        open={quoteDialogOpen}
        onOpenChange={(o) => {
          if (!o) closeQuoteDialog();
        }}
        title={selectedQuoteId ? 'Editar presupuesto' : 'Nuevo presupuesto'}
        description={
          selectedQuoteId
            ? `ID: ${selectedQuoteId}`
            : 'Registra un presupuesto de proveedor con sus líneas.'
        }
        dirty={quoteDirty}
        size="full"
        footer={
          <>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cerrar
              </Button>
            </DialogClose>
            {selectedQuoteId && quoteStatus === 'aprobado' ? (
              quotesWithActivePo.has(selectedQuoteId) ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || quoteDirty}
                  onClick={() => {
                    const po = generalPurchases.find(
                      (o) =>
                        o.quoteId === selectedQuoteId &&
                        o.status !== 'cancelado'
                    );
                    closeQuoteDialog({ force: true, skipUrl: true });
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
                  disabled={busy || quoteDirty}
                  title={
                    quoteDirty
                      ? 'Guarda los cambios antes de crear el pedido'
                      : undefined
                  }
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
                      closeQuoteDialog({ force: true, skipUrl: true });
                      await openPurchaseById(res.id);
                      router.refresh();
                    })
                  }
                >
                  Crear pedido de compra
                </Button>
              ) : null
            ) : null}
            {canWrite ? (
              <Button
                type="button"
                disabled={busy || !quoteSupplierId}
                onClick={() => run(saveQuote)}
              >
                {selectedQuoteId ? 'Guardar cambios' : 'Guardar presupuesto'}
              </Button>
            ) : null}
          </>
        }
      >
        <div className="space-y-4">
          <fieldset disabled={!canWrite} className="m-0 min-w-0 space-y-3 border-0 p-0">
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

          </fieldset>

          <div className="space-y-2 border-t border-border pt-3">
            <h3 className="text-sm font-semibold">Adjuntos</h3>
            {!selectedQuoteId ? (
              <p className="text-xs text-muted-foreground">
                Guarda el presupuesto para poder adjuntar archivos.
              </p>
            ) : (
              <>
                <ul className="space-y-1 text-sm">
                  {(quoteDocumentsById[selectedQuoteId] ?? []).map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        className="text-primary underline-offset-2 hover:underline"
                        onClick={() => void openSigned(d.storagePath)}
                      >
                        {d.fileName}
                      </button>
                    </li>
                  ))}
                  {(quoteDocumentsById[selectedQuoteId] ?? []).length === 0 ? (
                    <li className="text-muted-foreground">Sin archivos.</li>
                  ) : null}
                </ul>
                {canWrite ? (
                  <label className="inline-flex cursor-pointer text-sm text-primary underline-offset-2 hover:underline">
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
                          fd.set('quoteId', selectedQuoteId);
                          fd.set('file', file);
                          const res = await uploadSupplierQuoteDocumentAction(fd);
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
              </>
            )}
          </div>
        </div>
      </AdminWideDialog>

      <AdminWideDialog
        open={showPoForm}
        onOpenChange={(o) => {
          if (!o) resetPoForm();
        }}
        title={
          editingPurchaseId ? 'Editar pedido de compra' : 'Nuevo pedido de compra'
        }
        description={
          editingPurchaseNumber ? (
            <>
              N.º pedido:{' '}
              <span className="font-mono font-medium">
                {editingPurchaseNumber}
              </span>{' '}
              (inmutable)
            </>
          ) : editingPurchaseId ? (
            'Pedido sin número (borrador o legacy). El correlativo YYYY/######## se asigna solo al confirmar Pedido.'
          ) : (
            'Borrador sin número. El correlativo YYYY/######## se asigna solo al confirmar Pedido.'
          )
        }
        dirty={poDirty}
        size="full"
        footer={
          <div className="w-full space-y-3">
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cerrar
                </Button>
              </DialogClose>
              {canWrite ? (
                <>
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
                            status:
                              poStatus === 'cancelado' ? 'pedido' : poStatus,
                            requireComplete: true,
                          });
                        })
                      }
                    >
                      Guardar cambios
                    </Button>
                  )}
                </>
              ) : null}
            </div>
            {canWrite && confirmPedidoOpen ? (
              <div className="space-y-3 rounded-lg border border-border bg-background p-3 text-left">
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
        }
      >
        <div className="space-y-4">
          <fieldset disabled={!canWrite} className="m-0 min-w-0 space-y-4 border-0 p-0">
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

          </fieldset>

          <div className="space-y-2 border-t border-border pt-3">
            <h3 className="text-sm font-semibold">Documentos / facturas</h3>
            {!editingPurchaseId ? (
              <p className="text-xs text-muted-foreground">
                Guarda el pedido (borrador) para poder subir documentos.
              </p>
            ) : (
              <>
                <ul className="space-y-1 text-sm">
                  {(purchaseDocumentsById[editingPurchaseId] ?? []).map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        className="text-primary underline-offset-2 hover:underline"
                        onClick={() => void openSigned(d.storagePath)}
                      >
                        [{SUPPLIER_PO_DOC_LABELS[d.docType]}] {d.fileName}
                      </button>
                    </li>
                  ))}
                  {(purchaseDocumentsById[editingPurchaseId] ?? []).length ===
                  0 ? (
                    <li className="text-muted-foreground">Sin documentos.</li>
                  ) : null}
                </ul>
                {canWrite ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Select
                      value={poDocType}
                      onValueChange={(v) =>
                        setPoDocType(v as SupplierPurchaseDocType)
                      }
                    >
                      <SelectTrigger className="w-[200px]">
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
                          if (!file || !editingPurchaseId) return;
                          run(async () => {
                            const fd = new FormData();
                            fd.set('purchaseOrderId', editingPurchaseId);
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
      </AdminWideDialog>
    </div>
  );
}
