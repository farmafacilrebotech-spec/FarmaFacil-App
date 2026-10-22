import { Suspense } from 'react';
import { redirect } from 'next/navigation';

import { BrandLogo } from '@/components/brand';
import { createClient } from '@/lib/supabase/server';
import { LoginForm } from '@/app/(auth)/login/login-form';

export const dynamic = 'force-dynamic';

/**
 * Login.
 *
 * Si ya hay sesión, redirige con path relativo (next/navigation) para no pasar
 * por middleware NextURL, que reescribe 127.0.0.1 → localhost y rompe cookies.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string; error?: string; hint?: string; email?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const next = searchParams?.next;
    if (next === '/first-access') {
      redirect('/first-access');
    }
    redirect('/auth/continue');
  }

  return (
    <Suspense
      fallback={
        <div className="animate-slide-up">
          <div className="mb-8 flex justify-center">
            <BrandLogo size={112} showTagline />
          </div>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-soft-lg">
            <p className="text-center text-sm text-muted-foreground">
              Cargando…
            </p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
