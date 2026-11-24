import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  STAGING_EMAIL_SUBJECT_PREFIX,
  applyStagingEmailSubjectPrefix,
  getCorporateEmailSendMode,
  isStagingEmailProtectionActive,
} from './send-config.ts';

describe('getCorporateEmailSendMode', () => {
  it('está OFF por defecto', () => {
    const m = getCorporateEmailSendMode({});
    assert.equal(m.enabled, false);
  });

  it('send=1 sin dry-run explícito → dryRun true (seguro)', () => {
    const m = getCorporateEmailSendMode({
      FF_CORPORATE_EMAIL_SEND_ENABLED: '1',
    });
    assert.equal(m.enabled, true);
    if (m.enabled) assert.equal(m.dryRun, true);
  });

  it('send=1 dry-run=0 → live (no staging)', () => {
    const m = getCorporateEmailSendMode({
      FF_CORPORATE_EMAIL_SEND_ENABLED: '1',
      FF_CORPORATE_EMAIL_DRY_RUN: '0',
    });
    assert.equal(m.enabled, true);
    if (m.enabled) assert.equal(m.dryRun, false);
  });

  it('staging bloquea live salvo FF_ALLOW_STAGING_LIVE_EMAIL', () => {
    const blocked = getCorporateEmailSendMode({
      FF_CORPORATE_EMAIL_SEND_ENABLED: '1',
      FF_CORPORATE_EMAIL_DRY_RUN: '0',
      FF_APP_ENV: 'staging',
    });
    assert.equal(blocked.enabled, true);
    if (blocked.enabled) assert.equal(blocked.dryRun, true);

    const allowed = getCorporateEmailSendMode({
      FF_CORPORATE_EMAIL_SEND_ENABLED: '1',
      FF_CORPORATE_EMAIL_DRY_RUN: '0',
      FF_APP_ENV: 'staging',
      FF_ALLOW_STAGING_LIVE_EMAIL: '1',
    });
    assert.equal(allowed.enabled, true);
    if (allowed.enabled) assert.equal(allowed.dryRun, false);
  });
});

describe('applyStagingEmailSubjectPrefix', () => {
  it('no altera en entorno no staging', () => {
    assert.equal(
      applyStagingEmailSubjectPrefix('Hola', {}),
      'Hola'
    );
  });

  it('añade [PRUEBA STAGING] en staging', () => {
    const s = applyStagingEmailSubjectPrefix('Presupuesto X', {
      FF_APP_ENV: 'staging',
    });
    assert.equal(s, `${STAGING_EMAIL_SUBJECT_PREFIX} Presupuesto X`);
  });

  it('es idempotente y migra [PRUEBA] legado', () => {
    const once = applyStagingEmailSubjectPrefix('Asunto', {
      FF_APP_ENV: 'staging',
    });
    assert.equal(
      applyStagingEmailSubjectPrefix(once, { FF_APP_ENV: 'staging' }),
      once
    );
    assert.equal(
      applyStagingEmailSubjectPrefix('[PRUEBA] Viejo', {
        FF_APP_ENV: 'staging',
      }),
      `${STAGING_EMAIL_SUBJECT_PREFIX} Viejo`
    );
  });

  it('detecta host farmafacil-staging', () => {
    assert.equal(
      isStagingEmailProtectionActive({
        VERCEL_URL: 'farmafacil-staging.vercel.app',
      }),
      true
    );
  });
});
