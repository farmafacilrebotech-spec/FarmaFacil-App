/**
 * Formato de número visible de pedido de compra: YYYY/00000001
 * La asignación real es transaccional en PostgreSQL (080).
 */

export function formatPurchaseOrderNumber(year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error('año inválido');
  }
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error('secuencia inválida');
  }
  return `${year}/${String(seq).padStart(8, '0')}`;
}

export function parsePurchaseOrderNumber(
  value: string
): { year: number; seq: number } | null {
  const m = /^(\d{4})\/(\d{8})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const seq = Number(m[2]);
  if (!Number.isInteger(year) || !Number.isInteger(seq) || seq < 1) return null;
  return { year, seq };
}

/** Año de numeración a partir de la fecha de pedido (YYYY-MM-DD). */
export function numberingYearFromOrderedAt(orderedAt: string): number {
  const y = Number(orderedAt.slice(0, 4));
  if (!Number.isInteger(y) || y < 2000) {
    throw new Error('Fecha de pedido no válida para numeración');
  }
  return y;
}

/** Simula reinicio anual del contador (tests). */
export function nextSequenceForYear(
  counters: Map<number, number>,
  year: number
): { number: string; seq: number } {
  const prev = counters.get(year) ?? 0;
  const seq = prev + 1;
  counters.set(year, seq);
  return { number: formatPurchaseOrderNumber(year, seq), seq };
}
