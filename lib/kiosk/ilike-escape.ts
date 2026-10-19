/**
 * Espejo del escape ILIKE de 043_kiosk_search_products_v1.
 * Orden: \ → \\, luego % → \%, _ → \_.
 * El patrón resultante se usa con ESCAPE '\'.
 */
export function escapeIlikeLiteral(raw: string): string {
  return raw
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_');
}

/**
 * Comprueba si un texto de producto coincidiría con un patrón ILIKE
 * `%escaped%` ESCAPE '\' (case-insensitive), sin comodines del usuario.
 */
export function ilikeContainsLiteral(
  haystack: string,
  userQuery: string
): boolean {
  const needle = userQuery.toLowerCase();
  return haystack.toLowerCase().includes(needle);
}
