/**
 * Guardrail de runtime: el despliegue de staging no puede arrancar
 * conectado al proyecto Supabase de producción.
 *
 * Refs canónicos (mismo criterio que scripts/assert-staging-target.mjs).
 */

export const FF_SUPABASE_STAGING_REF = 'dazfdcjscnpfvhcyjddt';
export const FF_SUPABASE_PRODUCTION_REF = 'gsnohwsvjxpjfcsstnfd';

export function extractSupabaseProjectRef(
  urlOrConn: string | null | undefined
): string | null {
  if (!urlOrConn) return null;
  const fromUrl = urlOrConn.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (fromUrl) return fromUrl[1].toLowerCase();
  const fromPooler = urlOrConn.match(/postgres\.([a-z0-9]+)(?:[.:@/]|$)/i);
  if (fromPooler) return fromPooler[1].toLowerCase();
  const fromDb = urlOrConn.match(/@db\.([a-z0-9]+)\.supabase\.co/i);
  if (fromDb) return fromDb[1].toLowerCase();
  return null;
}

export type StagingRuntimeGuardResult =
  | { ok: true; ref: string | null; skipped: boolean }
  | { ok: false; error: string };

/**
 * Si FF_APP_ENV=staging (o FF_REQUIRE_STAGING_SUPABASE=1), exige URL/DB
 * del proyecto staging y rechaza el ref de producción.
 */
export function assertStagingSupabaseRuntime(
  env: NodeJS.ProcessEnv = process.env
): StagingRuntimeGuardResult {
  const appEnv = (env.FF_APP_ENV ?? '').trim().toLowerCase();
  const forced = ['1', 'true', 'yes'].includes(
    (env.FF_REQUIRE_STAGING_SUPABASE ?? '').trim().toLowerCase()
  );
  const isStagingDeploy = appEnv === 'staging' || forced;

  if (!isStagingDeploy) {
    return { ok: true, ref: null, skipped: true };
  }

  const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  const db = (env.DATABASE_URL ?? '').trim();
  const urlRef = extractSupabaseProjectRef(url);
  const dbRef = extractSupabaseProjectRef(db);

  if (!urlRef) {
    return {
      ok: false,
      error:
        'Staging: NEXT_PUBLIC_SUPABASE_URL ausente o inválida. Abortando arranque.',
    };
  }
  if (urlRef === FF_SUPABASE_PRODUCTION_REF) {
    return {
      ok: false,
      error: `Staging: URL apunta a PRODUCCIÓN (${FF_SUPABASE_PRODUCTION_REF}). Abortando.`,
    };
  }
  if (urlRef !== FF_SUPABASE_STAGING_REF) {
    return {
      ok: false,
      error: `Staging: URL ref=${urlRef} no es el staging esperado (${FF_SUPABASE_STAGING_REF}). Abortando.`,
    };
  }
  if (db && dbRef === FF_SUPABASE_PRODUCTION_REF) {
    return {
      ok: false,
      error: `Staging: DATABASE_URL apunta a PRODUCCIÓN (${FF_SUPABASE_PRODUCTION_REF}). Abortando.`,
    };
  }
  if (db && dbRef && dbRef !== urlRef) {
    return {
      ok: false,
      error: `Staging: DATABASE_URL ref=${dbRef} ≠ URL ref=${urlRef}. Abortando.`,
    };
  }

  return { ok: true, ref: urlRef, skipped: false };
}

export function isStagingHost(hostname: string | null | undefined): boolean {
  const h = (hostname || '').toLowerCase();
  return (
    h === 'staging.farmafacil.solutions' ||
    h.endsWith('.staging.farmafacil.solutions') ||
    h.includes('farmafacil-staging')
  );
}

export function isStagingAppEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.FF_APP_ENV ?? '').trim().toLowerCase() === 'staging';
}
