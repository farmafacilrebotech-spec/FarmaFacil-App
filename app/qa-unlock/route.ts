import { NextResponse, type NextRequest } from 'next/server';
import {
  isStagingAppEnv,
  isStagingHost,
} from '@/lib/env/staging-runtime-guard';

export const dynamic = 'force-dynamic';

/**
 * GET /qa-unlock?t=TOKEN&next=/cuenta
 * Cookie QA opcional (no bloquea rutas públicas).
 */
export async function GET(request: NextRequest) {
  const host = request.headers.get('host');
  const staging =
    isStagingAppEnv() || isStagingHost(host?.split(':')[0] ?? null);
  const expected = (process.env.FF_STAGING_QA_GATE_TOKEN ?? '').trim();
  const provided = (request.nextUrl.searchParams.get('t') ?? '').trim();
  const nextRaw = request.nextUrl.searchParams.get('next') ?? '/cuenta';
  const nextPath = nextRaw.startsWith('/') ? nextRaw : '/cuenta';

  if (!staging) {
    return NextResponse.json(
      { ok: false, error: 'Solo disponible en staging.' },
      { status: 404 }
    );
  }

  if (!expected) {
    return NextResponse.json({
      ok: true,
      unlocked: false,
      message:
        'Sin FF_STAGING_QA_GATE_TOKEN: QR/registro/PWA no requieren cookie. Paneles internos siguen con login.',
    });
  }

  if (!provided || provided !== expected) {
    return NextResponse.json(
      { ok: false, error: 'Token QA inválido o ausente.' },
      { status: 401 }
    );
  }

  const res = NextResponse.redirect(new URL(nextPath, request.url));
  res.cookies.set('ff_staging_qa', '1', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  });
  return res;
}
