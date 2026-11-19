/**
 * Arranque Next: aborta si FF_APP_ENV=staging apunta a Supabase de producción.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return;

  const { assertStagingSupabaseRuntime } = await import(
    '@/lib/env/staging-runtime-guard'
  );
  const result = assertStagingSupabaseRuntime();
  if (!result.ok) {
    console.error('[staging-runtime-guard]', result.error);
    throw new Error(result.error);
  }
  if (!result.skipped) {
    console.info(
      `[staging-runtime-guard] OK supabase staging ref=${result.ref}`
    );
  }
}
