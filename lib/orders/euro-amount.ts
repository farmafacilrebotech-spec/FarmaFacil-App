/** Valida importe en euros (2 decimales, ≥ 0). Sin I/O. */
export function parseConfirmableEuroAmount(
  raw: string | number
): { ok: true; amount: number } | { ok: false; error: string } {
  const n =
    typeof raw === 'number'
      ? raw
      : Number(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(n)) {
    return { ok: false, error: 'Introduce un importe válido en euros.' };
  }
  if (n < 0 || n > 9_999_999.99) {
    return { ok: false, error: 'El importe está fuera de rango.' };
  }
  const rounded = Math.round(n * 100) / 100;
  if (Math.abs(rounded - n) > 1e-9) {
    return {
      ok: false,
      error: 'Usa como máximo dos decimales (céntimos).',
    };
  }
  return { ok: true, amount: rounded };
}
