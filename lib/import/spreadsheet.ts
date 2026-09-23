/**
 * Motor de importación genérico (Excel/CSV).
 * Reutilizable para Catálogo (ahora) y Clientes (futuro).
 */

export const IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
export const IMPORT_MAX_ROWS = 2000;

export type ColumnMappingHint = {
  field: string;
  label: string;
  aliases: string[];
  required?: boolean;
};

export type ColumnMapping = Record<string, number | null>;

export type ParsedSpreadsheet = {
  headers: string[];
  rows: string[][];
};

export function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function autoMapColumns(
  headers: string[],
  hints: ColumnMappingHint[]
): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const mapping: ColumnMapping = {};
  const used = new Set<number>();

  for (const hint of hints) {
    mapping[hint.field] = null;
    for (let i = 0; i < normalized.length; i++) {
      if (used.has(i)) continue;
      const h = normalized[i];
      if (!h) continue;
      const hit = hint.aliases.some((alias) => {
        const a = normalizeHeader(alias);
        return h === a || h.includes(a) || a.includes(h);
      });
      if (hit) {
        mapping[hint.field] = i;
        used.add(i);
        break;
      }
    }
  }

  return mapping;
}

export function cellAt(
  row: string[],
  index: number | null | undefined
): string {
  if (index == null || index < 0 || index >= row.length) return '';
  return String(row[index] ?? '').trim();
}

export function parseNumberLoose(raw: string): number | null {
  if (!raw.trim()) return null;
  let s = raw.trim().replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.');
  } else {
    s = s.replace(/[^\d.-]/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseCsvText(text: string): ParsedSpreadsheet {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const delim =
    lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';

  function splitLine(line: string): string[] {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delim) {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  }

  return {
    headers: splitLine(lines[0]),
    rows: lines.slice(1).map(splitLine),
  };
}
