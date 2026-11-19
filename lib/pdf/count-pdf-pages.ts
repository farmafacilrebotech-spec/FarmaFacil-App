/**
 * Cuenta páginas físicas de un PDF generado (Chromium).
 * Usa el contador de objetos /Type /Page (excluye /Pages).
 */
export function countPdfPages(bytes: Uint8Array): number {
  const text = Buffer.from(bytes).toString('latin1');
  const matches = text.match(/\/Type\s*\/Page\b/g);
  return matches?.length ?? 0;
}
