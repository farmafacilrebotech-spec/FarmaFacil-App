/** Formato euros ES desde céntimos. No redondea de forma distinta al snapshot. */
export function formatCentsEs(cents: number): string {
  const n = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(n / 100);
}

export function formatVatPercent(vatBps: number): string {
  const pct = (Number(vatBps) || 0) / 100;
  return `${pct.toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} %`;
}

export function intervalLabel(interval: 'monthly' | 'annual'): string {
  return interval === 'annual' ? 'anual' : 'mensual';
}
