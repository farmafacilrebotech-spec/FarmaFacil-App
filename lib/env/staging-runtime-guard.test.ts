/**
 * node --experimental-strip-types --test lib/env/staging-runtime-guard.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  assertStagingSupabaseRuntime,
  extractSupabaseProjectRef,
  FF_SUPABASE_PRODUCTION_REF,
  FF_SUPABASE_STAGING_REF,
} from './staging-runtime-guard.ts';

describe('staging-runtime-guard', () => {
  it('extrae refs de URL y pooler', () => {
    assert.equal(
      extractSupabaseProjectRef(
        `https://${FF_SUPABASE_STAGING_REF}.supabase.co`
      ),
      FF_SUPABASE_STAGING_REF
    );
    assert.equal(
      extractSupabaseProjectRef(
        `postgresql://postgres.${FF_SUPABASE_STAGING_REF}:x@aws.pooler.supabase.com:6543/postgres`
      ),
      FF_SUPABASE_STAGING_REF
    );
  });

  it('no exige nada fuera de FF_APP_ENV=staging', () => {
    const r = assertStagingSupabaseRuntime({
      NEXT_PUBLIC_SUPABASE_URL: `https://${FF_SUPABASE_PRODUCTION_REF}.supabase.co`,
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.skipped, true);
  });

  it('aborta staging si apunta a producción', () => {
    const r = assertStagingSupabaseRuntime({
      FF_APP_ENV: 'staging',
      NEXT_PUBLIC_SUPABASE_URL: `https://${FF_SUPABASE_PRODUCTION_REF}.supabase.co`,
    });
    assert.equal(r.ok, false);
  });

  it('acepta staging correcto', () => {
    const r = assertStagingSupabaseRuntime({
      FF_APP_ENV: 'staging',
      NEXT_PUBLIC_SUPABASE_URL: `https://${FF_SUPABASE_STAGING_REF}.supabase.co`,
      DATABASE_URL: `postgresql://postgres.${FF_SUPABASE_STAGING_REF}:x@host/db`,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.skipped, false);
      assert.equal(r.ref, FF_SUPABASE_STAGING_REF);
    }
  });
});
