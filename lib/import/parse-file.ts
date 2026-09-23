import { readSheet } from 'read-excel-file/node';
import {
  IMPORT_MAX_FILE_BYTES,
  IMPORT_MAX_ROWS,
  parseCsvText,
  type ParsedSpreadsheet,
} from '@/lib/import/spreadsheet';

function cellToString(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

/**
 * Lee .xlsx / .csv en memoria. No persiste el fichero.
 *
 * Dependencia: `read-excel-file` (entrada Node) solo para .xlsx.
 * CSV nativo vía parseCsvText.
 */
export async function parseSpreadsheetFile(
  file: File
): Promise<{ ok: true; data: ParsedSpreadsheet } | { ok: false; error: string }> {
  if (!file) return { ok: false, error: 'No se ha recibido ningún archivo.' };
  if (file.size <= 0) return { ok: false, error: 'El archivo está vacío.' };
  if (file.size > IMPORT_MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `El archivo supera el límite de ${Math.round(IMPORT_MAX_FILE_BYTES / (1024 * 1024))} MB.`,
    };
  }

  const name = (file.name || '').toLowerCase();
  const isCsv = name.endsWith('.csv') || file.type === 'text/csv';
  const isXlsx =
    name.endsWith('.xlsx') ||
    file.type ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  if (name.endsWith('.xls') && !name.endsWith('.xlsx')) {
    return {
      ok: false,
      error: 'El formato .xls antiguo no está soportado. Guarda el archivo como .xlsx o .csv.',
    };
  }

  if (!isCsv && !isXlsx) {
    return {
      ok: false,
      error: 'Formato no soportado. Usa un archivo .xlsx o .csv.',
    };
  }

  try {
    if (isCsv) {
      const data = parseCsvText(await file.text());
      if (!data.headers.length) {
        return { ok: false, error: 'No se han encontrado columnas en el CSV.' };
      }
      if (data.rows.length > IMPORT_MAX_ROWS) {
        return {
          ok: false,
          error: `El archivo tiene más de ${IMPORT_MAX_ROWS} filas. Divide la importación.`,
        };
      }
      return { ok: true, data };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const matrix = await readSheet(buffer);

    if (!matrix.length) return { ok: false, error: 'La hoja está vacía.' };

    const headers = (matrix[0] ?? []).map((c) => cellToString(c));
    if (!headers.some((h) => h.length > 0)) {
      return {
        ok: false,
        error: 'No se han encontrado encabezados en la primera fila.',
      };
    }

    const rows = matrix
      .slice(1)
      .map((r) => headers.map((_, i) => cellToString(r?.[i])))
      .filter((r) => r.some((c) => c.length > 0));

    if (rows.length > IMPORT_MAX_ROWS) {
      return {
        ok: false,
        error: `El archivo tiene más de ${IMPORT_MAX_ROWS} filas. Divide la importación.`,
      };
    }

    return { ok: true, data: { headers, rows } };
  } catch (err) {
    console.error('[import] parseSpreadsheetFile', err);
    return {
      ok: false,
      error: 'No se ha podido leer el archivo. Comprueba que no esté dañado.',
    };
  }
}
