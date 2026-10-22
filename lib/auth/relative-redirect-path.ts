/**
 * Valida path same-origin para Location relativa (sin depender de Next).
 */
export function assertSameOriginPath(pathWithOptionalQuery: string): string {
  if (
    !pathWithOptionalQuery.startsWith('/') ||
    pathWithOptionalQuery.startsWith('//')
  ) {
    throw new Error('redirectRelative only accepts same-origin paths');
  }
  return pathWithOptionalQuery;
}
