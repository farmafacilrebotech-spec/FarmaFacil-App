/**
 * Gate de extracción IA de presupuestos PDF (proveedores).
 * OFF por defecto: la clave OPENAI puede existir por el asistente kiosk.
 */

export function isSupplierQuotePdfAiEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const flag = (env.SUPPLIER_QUOTE_PDF_AI_ENABLED ?? '').trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}
