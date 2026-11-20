import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Espejo de la validación de env del middleware (sin Edge runtime).
 */
function readSupabasePublicEnv(env: Record<string, string | undefined>): {
  url: string;
  anonKey: string;
} | null {
  const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  const anonKey = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    return null;
  }
  if (!anonKey.startsWith('eyJ') || anonKey.startsWith('eyJ2Ijoi')) {
    return null;
  }
  if (anonKey.split('.').length < 3) {
    return null;
  }
  return { url, anonKey };
}

describe('middleware supabase env guard', () => {
  it('acepta URL https staging + JWT anon', () => {
    const r = readSupabasePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://dazfdcjscnpfvhcyjddt.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiJ9.e30.sig',
    });
    assert.ok(r);
  });

  it('rechaza sobre cifrado Vercel eyJ2Ijoi como URL', () => {
    const r = readSupabasePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'eyJ2IjoidjIiLCJjIjoiYmFkIn0',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiJ9.e30.sig',
    });
    assert.equal(r, null);
  });

  it('rechaza ausentes', () => {
    assert.equal(readSupabasePublicEnv({}), null);
  });
});
