import { continueAfterAuth } from '@/app/auth/continue/actions';

export const dynamic = 'force-dynamic';

/**
 * Punto de enrutado post-sesión.
 * Evita que el middleware mande siempre a /dashboard (panel plataforma).
 */
export default async function AuthContinuePage() {
  await continueAfterAuth();
}
