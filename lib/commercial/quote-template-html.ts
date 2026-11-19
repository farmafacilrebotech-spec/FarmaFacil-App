/**
 * Generador HTML del presupuesto corporativo (PRE-05 · plan B5).
 *
 * - Plantilla aprobada: docs/commercial/templates/FarmaFacil_plantilla_presupuesto.html
 *   (embebida sin logo en quote-template-source.ts; ver
 *   scripts/sync-quote-template-source.mjs. El test verifica la sincronía).
 * - Mini-motor de plantilla (sintaxis {{ x }}, {% for %}, {% if %}, {% macro %}).
 * - Mapper snapshot → QuoteTemplateData. NO recalcula con reglas propias:
 *   todos los importes salen del snapshot (calculateQuote) y de
 *   buildCommercialYearProjection.
 *
 * Solo imports relativos con extensión para convivir con node:test.
 */

import {
  buildCommercialYearProjection,
  DEFAULT_COMMERCIAL_TARIFF_CONFIG,
  KIOSK_USAGE_FEE_LABEL_ES,
  type CommercialPlanId,
  type CommercialTariffConfig,
  type SelectableCommercialOffer,
} from '../tarifas/engine.ts';
import {
  DEFAULT_COMMERCIAL_CONDITIONS,
  type CommercialQuoteSnapshot,
} from './quote-types.ts';
import { COMMERCIAL_QUOTE_TEMPLATE_SOURCE } from './quote-template-source.ts';

// -----------------------------------------------------------------------------
// Tipos
// -----------------------------------------------------------------------------

export type QuoteTemplateRow = { label: string; valor: string };

export type QuoteTemplateEvolutionRow = {
  label: string;
  valores: string[];
  destacado: boolean;
};

/** Estructura de docs/commercial/templates/FarmaFacil_datos_ejemplo.json */
export type QuoteTemplateData = {
  referencia: string;
  fecha: string;
  vigencia: string;
  farmacia: string;
  contacto: string;
  email: string;
  plan: string;
  modalidad: string;
  oferta: string;
  inicial_bruto: string;
  cuota_destacada_label: string;
  cuota_destacada: string;
  cuota_destacada_nota: string;
  iniciales: QuoteTemplateRow[];
  inicial_neto: string;
  impuestos_label: string;
  inicial_impuestos: string;
  cuotas: QuoteTemplateRow[];
  /** Etiqueta de la fila resumen (sin IVA) bajo la tabla de cuotas. */
  recurrente_anual_label: string;
  recurrente_anual: string;
  total_neto: string;
  total_impuestos: string;
  total_bruto: string;
  nota_anualizacion: string;
  nota_evolucion: string;
  anios: string[];
  evolucion: QuoteTemplateEvolutionRow[];
  condiciones: string[];
};

export type RenderCommercialQuoteOptions = {
  /** URL o data URI del logo. Por defecto: data URI del logo oficial (Node) o ruta pública. */
  logoSrc?: string;
};

// -----------------------------------------------------------------------------
// Formato
// -----------------------------------------------------------------------------

/** «1.548,80 €» (siempre con separador de miles, como la plantilla aprobada). */
export function formatQuoteEur(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const euros = Math.floor(abs / 100);
  const dec = String(abs % 100).padStart(2, '0');
  const grouped = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}${grouped},${dec} €`;
}

function formatPercent(bps: number): string {
  const pct = bps / 100;
  const text = Number.isInteger(pct)
    ? String(pct)
    : String(pct).replace('.', ',');
  return `${text} %`;
}

/** Fecha DD/MM/AAAA (presupuesto y correo comercial). */
export function formatQuoteDateEs(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  // Fechas solo-día: UTC mediodía; timestamps: UTC (estable entre servidor y test).
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function formatDateEs(iso: string | null | undefined): string {
  return formatQuoteDateEs(iso);
}

// -----------------------------------------------------------------------------
// Mapper snapshot → datos de plantilla
// -----------------------------------------------------------------------------

export type MapQuoteToTemplateInput = {
  referenceCode: string | null;
  createdAt: string;
  snapshot: CommercialQuoteSnapshot;
  /** Config para la proyección 2027-2029. Por defecto, tarifa comercial vigente en código. */
  config?: CommercialTariffConfig;
};

function offerLabel(cohort: string): string {
  if (cohort === 'launch_2027') return 'Oferta Lanzamiento 2027';
  if (cohort === 'cohort_2027_in_2028') return 'Cohorte 2027 · año 2028';
  return 'Tarifa normal';
}

function offerFromSnapshot(s: CommercialQuoteSnapshot): SelectableCommercialOffer {
  return s.cohortPricing === 'launch_2027' ? 'launch_2027' : 'normal';
}

function kioskPhrase(n: number): string {
  return n === 1 ? 'un kiosko' : `${n} kioskos`;
}

function buildConditions(s: CommercialQuoteSnapshot): string[] {
  const vat = formatPercent(s.vatBps);
  const out = [
    `Precios en euros. IVA del ${vat} aplicado a los importes netos indicados.`,
    'El alta de la aplicación y la personalización del kiosko son pagos únicos.',
    'La cuota mensual de uso del kiosko no se incluye en el descuento del software ni en su prepago anual.',
    s.onsiteInstallIncluded
      ? 'La instalación presencial incluida no añade importe.'
      : 'La instalación presencial no está incluida en este presupuesto.',
    'Aceptar el presupuesto no firma el contrato ni activa el servicio.',
    'El piloto requiere activación expresa: 15 días, ampliables una vez por otros 15 días.',
  ];
  // Condiciones personalizadas guardadas en el snapshot (se omiten las genéricas heredadas).
  const defaults = new Set<string>(DEFAULT_COMMERCIAL_CONDITIONS);
  for (const c of s.commercialConditions ?? []) {
    const t = c?.trim();
    if (t && !defaults.has(t)) out.push(t);
  }
  if (
    s.implantationCompensation &&
    s.implantationCompensation.compensatedCents > 0
  ) {
    out.push(
      `Se compensan ${formatQuoteEur(s.implantationCompensation.compensatedCents)} de implantaciones ya abonadas (no es un descuento comercial).`
    );
  }
  if (s.notes?.trim()) out.push(`Nota: ${s.notes.trim()}`);
  return out;
}

export function mapCommercialQuoteToTemplateData(
  input: MapQuoteToTemplateInput
): QuoteTemplateData {
  const s = input.snapshot;
  const b = s.breakdown;
  const monthly = s.interval === 'monthly';
  const vatLabel = `IVA (${formatPercent(s.vatBps)})`;

  const iniciales: QuoteTemplateRow[] = [];
  if (s.appSignupFeeCents > 0) {
    iniciales.push({
      label: 'Alta de la aplicación',
      valor: formatQuoteEur(s.appSignupFeeCents),
    });
  }
  if (s.hardwareCents > 0) {
    iniciales.push({
      label: `Personalización del kiosko (${s.kioskCount} ${
        s.kioskCount === 1 ? 'unidad' : 'unidades'
      })`,
      valor: formatQuoteEur(s.hardwareCents),
    });
  }
  iniciales.push({
    label: s.onsiteInstallIncluded
      ? 'Instalación presencial incluida'
      : 'Instalación presencial (no incluida)',
    valor: formatQuoteEur(0),
  });
  const compensation = s.implantationCompensation;
  if (compensation && compensation.compensatedCents > 0) {
    iniciales.push({
      label: 'Compensación implantaciones ya abonadas',
      valor: `−${formatQuoteEur(compensation.compensatedCents)}`,
    });
  }

  const vatOn = (netCents: number) =>
    Math.round((Math.max(0, netCents) * s.vatBps) / 10_000);
  const withVat = (netCents: number) => netCents + vatOn(netCents);

  // Kiosko: cobro mensual conceptual (aunque el software sea prepago anual).
  const kioskMonthlyNetCents =
    s.kioskCount > 0 ? s.kioskLicenseMonthlyCents * s.kioskCount : 0;
  const softwareRecurringNet = b.planRecurringCents;
  const softwareRecurringGross = withVat(softwareRecurringNet);
  const kioskMonthlyGross = withVat(kioskMonthlyNetCents);

  const cuotas: QuoteTemplateRow[] = [
    {
      label: monthly
        ? `Software ${s.planName} / mes (neto)`
        : `Software ${s.planName} / año · prepago anual (neto)`,
      valor: formatQuoteEur(softwareRecurringNet),
    },
    {
      label: monthly
        ? `Software ${s.planName} / mes · con IVA`
        : `Software ${s.planName} / año · con IVA`,
      valor: formatQuoteEur(softwareRecurringGross),
    },
  ];
  if (s.kioskCount > 0) {
    cuotas.push({
      label: `${KIOSK_USAGE_FEE_LABEL_ES} / mes (neto)`,
      valor: formatQuoteEur(kioskMonthlyNetCents),
    });
    cuotas.push({
      label: `${KIOSK_USAGE_FEE_LABEL_ES} / mes · con IVA`,
      valor: formatQuoteEur(kioskMonthlyGross),
    });
  }
  // El resumen sin IVA va solo en la fila destacada (recurrente_anual_label).

  // Evolución 2027-2029+ (misma fuente que quote-pdf; no toca calculateQuote).
  const baseConfig = input.config ?? DEFAULT_COMMERCIAL_TARIFF_CONFIG;
  const config: CommercialTariffConfig = {
    ...baseConfig,
    vatBps: s.vatBps,
    kioskLicenseMonthlyCents: s.kioskLicenseMonthlyCents,
    kioskHardwareUnitCents: s.hardwareUnitCents,
    saasAnnualDiscountBps: s.saasAnnualDiscountBps,
  };
  let anios: string[] = [];
  let evolucion: QuoteTemplateEvolutionRow[] = [];
  try {
    const projection = buildCommercialYearProjection(config, {
      planId: s.planId as CommercialPlanId,
      offer: offerFromSnapshot(s),
      interval: s.interval,
      kioskCount: s.kioskCount,
      onsiteInstallIncluded: s.onsiteInstallIncluded,
      includeAppSignupFee: s.includeAppSignupFee,
    });
    const rows = projection.rows;
    anios = rows.map((r) => String(r.calendarYear));
    const row = (
      label: string,
      pick: (r: (typeof rows)[number]) => string,
      destacado = false
    ): QuoteTemplateEvolutionRow => ({
      label,
      valores: rows.map(pick),
      destacado,
    });
    const softwareMonthLabel = monthly
      ? 'Software / mes'
      : 'Software / mes (equiv. prepago anual)';
    evolucion = [
      row('Descuento software', (r) => formatPercent(r.saasDiscountBps)),
      row(softwareMonthLabel, (r) => formatQuoteEur(r.saasMonthlyCents)),
      row(KIOSK_USAGE_FEE_LABEL_ES, (r) => formatQuoteEur(r.kioskMonthlyCents)),
      row('Recurrente / año', (r) => formatQuoteEur(r.recurringAnnualCents)),
      row('Pagos iniciales', (r) => formatQuoteEur(r.oneTimeNetCents)),
      row('Total sin IVA', (r) => formatQuoteEur(r.yearNetCents), true),
      row('IVA', (r) => formatQuoteEur(r.yearVatCents)),
      row('Total con IVA', (r) => formatQuoteEur(r.yearGrossCents), true),
    ];
  } catch {
    // Plan desconocido (legacy): sin tabla de evolución.
  }

  const launch = s.cohortPricing === 'launch_2027';
  const modalidad = monthly
    ? 'Pago mensual'
    : s.kioskCount > 0
      ? 'Software anual · kiosko mensual'
      : 'Pago anual';

  const cuotaNota = (() => {
    if (monthly) {
      return s.kioskCount > 0
        ? `Software + uso de ${kioskPhrase(s.kioskCount)}`
        : 'Software';
    }
    const parts: string[] = [
      `Software anual ${formatQuoteEur(softwareRecurringGross)} con IVA`,
    ];
    if (s.kioskCount > 0) {
      parts.push(
        `Kiosko mensual ${formatQuoteEur(kioskMonthlyGross)} con IVA`
      );
    }
    return parts.join(' · ');
  })();

  return {
    referencia: input.referenceCode?.trim() || 'sin referencia',
    fecha: formatDateEs(input.createdAt),
    vigencia: formatDateEs(s.validUntil),
    farmacia: s.clientName || s.pharmacyName || '—',
    contacto: s.contactName || '—',
    email: s.contactEmail || '—',
    plan: s.planName,
    modalidad,
    oferta: offerLabel(s.cohortPricing),
    inicial_bruto: formatQuoteEur(b.oneTimeGrossCents),
    cuota_destacada_label: monthly
      ? 'Cuota mensual con IVA'
      : 'Coste recurrente anualizado con IVA',
    cuota_destacada: formatQuoteEur(b.recurringGrossCents),
    cuota_destacada_nota: cuotaNota,
    iniciales,
    inicial_neto: formatQuoteEur(b.oneTimeNetCents),
    impuestos_label: vatLabel,
    inicial_impuestos: formatQuoteEur(b.oneTimeVatCents),
    cuotas,
    recurrente_anual_label: monthly
      ? 'Total mensual sin IVA'
      : 'Coste recurrente anualizado sin IVA',
    recurrente_anual: formatQuoteEur(
      monthly ? b.recurringNetCents : b.firstYearSubscriptionCents
    ),
    total_neto: formatQuoteEur(b.firstYearNetCents),
    total_impuestos: formatQuoteEur(b.firstYearVatCents),
    total_bruto: formatQuoteEur(b.firstYearGrossCents),
    nota_anualizacion: monthly
      ? 'Importes mensualizados; el total del primer año acumula 12 meses.'
      : 'El software se cobra anualmente; el kiosko se cobra cada mes. El coste recurrente anualizado suma ambos en base 12 meses.',
    nota_evolucion: launch
      ? 'Descuentos de lanzamiento por año natural. Tarifas posteriores sujetas a revisión contractual.'
      : 'Previsión por año natural. Tarifas posteriores sujetas a revisión contractual.',
    anios,
    evolucion,
    condiciones: buildConditions(s),
  };
}

// -----------------------------------------------------------------------------
// Mini-motor de plantilla
// -----------------------------------------------------------------------------

type Node =
  | { t: 'text'; v: string }
  | { t: 'expr'; v: string }
  | { t: 'for'; item: string; list: string; body: Node[] }
  | { t: 'if'; cond: string; body: Node[] };

type Macro = { params: string[]; body: Node[] };

type Scope = Record<string, unknown>;

const TOKEN_RE = /(\{%-?[\s\S]*?-?%\}|\{\{[\s\S]*?\}\})/g;

function parseTemplate(source: string): { nodes: Node[]; macros: Map<string, Macro> } {
  const tokens = source.split(TOKEN_RE);
  const macros = new Map<string, Macro>();
  let i = 0;

  function parseBlock(endTags: string[]): { nodes: Node[]; end: string | null } {
    const nodes: Node[] = [];
    while (i < tokens.length) {
      const tok = tokens[i++];
      if (tok.startsWith('{%')) {
        const stmt = tok.replace(/^\{%-?\s*/, '').replace(/\s*-?%\}$/, '');
        const kw = stmt.split(/\s+/)[0];
        if (endTags.includes(kw)) return { nodes, end: kw };
        if (kw === 'for') {
          const m = /^for\s+(\w+)\s+in\s+([\w.]+)$/.exec(stmt);
          if (!m) throw new Error(`Plantilla: for inválido «${stmt}»`);
          const inner = parseBlock(['endfor']);
          nodes.push({ t: 'for', item: m[1], list: m[2], body: inner.nodes });
        } else if (kw === 'if') {
          const cond = stmt.replace(/^if\s+/, '').trim();
          const inner = parseBlock(['endif']);
          nodes.push({ t: 'if', cond, body: inner.nodes });
        } else if (kw === 'macro') {
          const m = /^macro\s+(\w+)\(([^)]*)\)$/.exec(stmt);
          if (!m) throw new Error(`Plantilla: macro inválida «${stmt}»`);
          const inner = parseBlock(['endmacro']);
          macros.set(m[1], {
            params: m[2]
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean),
            body: inner.nodes,
          });
        } else {
          throw new Error(`Plantilla: sentencia no soportada «${stmt}»`);
        }
      } else if (tok.startsWith('{{')) {
        nodes.push({ t: 'expr', v: tok.slice(2, -2).trim() });
      } else if (tok) {
        nodes.push({ t: 'text', v: tok });
      }
    }
    if (endTags.length) throw new Error(`Plantilla: falta ${endTags.join('/')}`);
    return { nodes, end: null };
  }

  const { nodes } = parseBlock([]);
  return { nodes, macros };
}

function lookup(path: string, scope: Scope): unknown {
  let cur: unknown = scope;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function escapeQuoteHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function evalArg(arg: string, scope: Scope): unknown {
  const a = arg.trim();
  if (/^-?\d+(\.\d+)?$/.test(a)) return Number(a);
  const str = /^(['"])(.*)\1$/.exec(a);
  if (str) return str[2];
  return lookup(a, scope);
}

function renderNodes(
  nodes: Node[],
  scope: Scope,
  macros: Map<string, Macro>
): string {
  let out = '';
  for (const n of nodes) {
    switch (n.t) {
      case 'text':
        out += n.v;
        break;
      case 'expr': {
        const call = /^(\w+)\((.*)\)$/.exec(n.v);
        if (call) {
          const macro = macros.get(call[1]);
          if (!macro) throw new Error(`Plantilla: macro «${call[1]}» no definida`);
          const args = call[2].trim() ? call[2].split(',') : [];
          const inner: Scope = { ...scope };
          macro.params.forEach((p, idx) => {
            inner[p] = args[idx] !== undefined ? evalArg(args[idx], scope) : undefined;
          });
          out += renderNodes(macro.body, inner, macros);
        } else {
          const v = lookup(n.v, scope);
          out += v == null ? '' : escapeQuoteHtml(String(v));
        }
        break;
      }
      case 'for': {
        const list = lookup(n.list, scope);
        if (Array.isArray(list)) {
          for (const item of list) {
            out += renderNodes(n.body, { ...scope, [n.item]: item }, macros);
          }
        }
        break;
      }
      case 'if': {
        if (lookup(n.cond, scope)) out += renderNodes(n.body, scope, macros);
        break;
      }
    }
  }
  return out;
}

let parsedCache: ReturnType<typeof parseTemplate> | null = null;

function getParsedTemplate() {
  parsedCache ??= parseTemplate(COMMERCIAL_QUOTE_TEMPLATE_SOURCE);
  return parsedCache;
}

// -----------------------------------------------------------------------------
// Logo
// -----------------------------------------------------------------------------

/**
 * Logotipo corporativo oficial (cruz plateada/turquesa).
 * Mismo recurso que la firma EMAIL-10 (`farmafacil-mark.png` → www logo).
 * No usar el SVG simplificado ni reinterpretar el isotipo.
 */
export const QUOTE_LOGO_PUBLIC_PATH = '/images/logos/farmafacil-mark.png';
/** Nombre de fichero en public/images/logos. */
export const QUOTE_LOGO_FILE_NAME = 'farmafacil-mark.png';

let logoCache: string | null | undefined;

/**
 * Data URI del logotipo oficial. Solo en Node (lectura síncrona);
 * en navegador/edge devuelve null.
 */
export function loadCommercialQuoteLogoDataUri(): string | null {
  if (logoCache !== undefined) return logoCache;
  try {
    type NodeProc = {
      cwd(): string;
      getBuiltinModule?: (id: string) => unknown;
    };
    const proc = (globalThis as { process?: NodeProc }).process;
    if (!proc || typeof proc.getBuiltinModule !== 'function') {
      logoCache = null;
      return null;
    }
    const fs = proc.getBuiltinModule('node:fs') as typeof import('node:fs');
    const path = proc.getBuiltinModule('node:path') as typeof import('node:path');
    const file = path.join(
      proc.cwd(),
      'public',
      'images',
      'logos',
      QUOTE_LOGO_FILE_NAME
    );
    const raw = fs.readFileSync(file);
    if (QUOTE_LOGO_FILE_NAME.endsWith('.svg')) {
      logoCache = `data:image/svg+xml;base64,${raw.toString('base64')}`;
    } else {
      logoCache = `data:image/png;base64,${raw.toString('base64')}`;
    }
  } catch {
    logoCache = null;
  }
  return logoCache;
}

// -----------------------------------------------------------------------------
// API pública
// -----------------------------------------------------------------------------

export function renderCommercialQuoteHtml(
  data: QuoteTemplateData,
  options: RenderCommercialQuoteOptions = {}
): string {
  const { nodes, macros } = getParsedTemplate();
  const logo =
    options.logoSrc ??
    loadCommercialQuoteLogoDataUri() ??
    QUOTE_LOGO_PUBLIC_PATH;
  return renderNodes(
    nodes,
    { ...(data as unknown as Scope), logo_src: logo },
    macros
  );
}

/** Snapshot guardado → HTML corporativo completo. */
export function renderCommercialQuoteHtmlFromSnapshot(
  input: MapQuoteToTemplateInput,
  options: RenderCommercialQuoteOptions = {}
): string {
  return renderCommercialQuoteHtml(mapCommercialQuoteToTemplateData(input), options);
}
