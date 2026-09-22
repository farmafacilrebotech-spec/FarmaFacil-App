'use server';

import { redirect } from 'next/navigation';
import {
  destinationForAppAccess,
  resolveAppAccess,
} from '@/lib/auth/access';

/**
 * Tras login (sesión ya en cookies), resuelve el destino sin hardcodear /dashboard.
 * Pensado para llamarse desde el cliente tras signInWithPassword OK.
 */
export async function resolvePostLoginDestinationAction(): Promise<{
  ok: true;
  path: string;
} | { ok: false; error: string }> {
  try {
    const access = await resolveAppAccess();
    return { ok: true, path: destinationForAppAccess(access) };
  } catch (err) {
    console.error('[auth] resolvePostLoginDestination', err);
    return {
      ok: false,
      error: 'No se ha podido determinar el destino de acceso.',
    };
  }
}

/**
 * Server-side continue: redirige según resolveAppAccess.
 * Usado cuando hay sesión en /login (middleware → aquí).
 */
export async function continueAfterAuth() {
  const access = await resolveAppAccess();
  redirect(destinationForAppAccess(access));
}
