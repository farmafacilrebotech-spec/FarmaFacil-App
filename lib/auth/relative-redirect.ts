import { NextResponse } from 'next/server';
import { assertSameOriginPath } from '@/lib/auth/relative-redirect-path';

export { assertSameOriginPath } from '@/lib/auth/relative-redirect-path';

/**
 * Redirect con Location relativa (`/path`), sin absolutizar.
 *
 * En el runtime Edge de Next, `NextResponse.redirect(new URL(...))` puede
 * reescribir `127.0.0.1` → `localhost` en la cabecera Location. Eso rompe
 * cookies host-only y produce `/login?next=/auth/continue` en el host equivocado.
 */
export function redirectRelative(
  pathWithOptionalQuery: string,
  status: 307 | 302 | 303 = 307
): NextResponse {
  const location = assertSameOriginPath(pathWithOptionalQuery);
  return new NextResponse(null, {
    status,
    headers: { Location: location },
  });
}
