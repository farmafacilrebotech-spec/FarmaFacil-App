/**
 * Detección de intención de producto y extracción de consultas seguras.
 * No genera SQL: solo literales acotados para ILIKE controlado en servidor.
 */

/** Palabras de producto / parafarmacia (no bastan verbos genéricos como «tenéis»). */
const PRODUCT_NOUN_RE =
  /\b(producto|crema|champ[uú]|protector|solar|hidratante|higiene|bucal|pasta|cepillo|derm|piel|cabello|niñ[oa]s?|infantil|vitamina|complemento|parafarmacia|fps|serum|sérum|gel|loción|locion|desodorante|pañal|panales)\b/i;

const SEEK_VERB_RE =
  /\b(busco|buscar|necesito|quiero|recomend|suger|ten[eé]is|tienen|hay)\b/i;

const STOPWORDS = new Set(
  [
    'a',
    'al',
    'de',
    'del',
    'la',
    'las',
    'el',
    'los',
    'un',
    'una',
    'unos',
    'unas',
    'y',
    'o',
    'u',
    'en',
    'con',
    'para',
    'por',
    'que',
    'qué',
    'como',
    'cómo',
    'me',
    'mi',
    'mis',
    'se',
    'su',
    'sus',
    'es',
    'son',
    'hay',
    'busco',
    'buscar',
    'necesito',
    'quiero',
    'tenéis',
    'teneis',
    'tienen',
    'podéis',
    'podeis',
    'recomendad',
    'recomienda',
    'sugerid',
    'algo',
    'alguna',
    'alguno',
    'sobre',
    'tipo',
    'tipos',
  ].map((w) => w.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase())
);

/** Sinónimos / expansiones controladas (mapa fijo, no libre). */
const QUERY_HINTS: Array<{ match: RegExp; queries: string[] }> = [
  {
    match: /crema.*hidrat|hidrat.*piel|piel\s+seca/i,
    queries: ['crema hidratante', 'hidratante'],
  },
  {
    match: /protector\s+solar|solar\s+infantil|fps/i,
    queries: ['protector solar', 'solar infantil'],
  },
  {
    match: /champ[uú].*gras|cabello\s+gras/i,
    queries: ['champú graso', 'champu'],
  },
  {
    match: /higiene\s+bucal|pasta\s+dental|cepillo|bucal/i,
    queries: ['higiene bucal', 'pasta dental'],
  },
  {
    match: /vitamina|complemento/i,
    queries: ['vitamina', 'complemento'],
  },
];

export function isProductSeekingMessage(text: string): boolean {
  const t = String(text ?? '').trim();
  if (!t) return false;
  if (QUERY_HINTS.some((h) => h.match.test(t))) return true;
  if (PRODUCT_NOUN_RE.test(t) && SEEK_VERB_RE.test(t)) return true;
  if (PRODUCT_NOUN_RE.test(t) && /\b(para|de)\b/i.test(t)) return true;
  return false;
}

/**
 * Extrae 1–3 consultas literales seguras (máx. 80 chars, sin comodines ILIKE).
 */
export function extractCatalogSearchQueries(text: string): string[] {
  const raw = String(text ?? '').trim();
  if (!raw) return [];

  const out: string[] = [];
  const seen = new Set<string>();

  function push(q: string) {
    const cleaned = sanitizeSearchLiteral(q);
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(cleaned);
  }

  for (const hint of QUERY_HINTS) {
    if (hint.match.test(raw)) {
      for (const q of hint.queries) push(q);
    }
  }

  const tokens = tokenizeForSearch(raw).filter((t) => !STOPWORDS.has(t));
  if (tokens.length >= 2) {
    push(tokens.slice(0, 3).join(' '));
  }
  for (const t of tokens.slice(0, 4)) {
    if (t.length >= 4) push(t);
  }

  return out.slice(0, 3);
}

export function sanitizeSearchLiteral(raw: string): string {
  let s = String(raw ?? '')
    .replace(/[%_\\]/g, ' ')
    .replace(/[^\p{L}\p{N}\s\-./]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > 80) s = s.slice(0, 80).trim();
  if (s.length < 2) return '';
  return s;
}

function tokenizeForSearch(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}
