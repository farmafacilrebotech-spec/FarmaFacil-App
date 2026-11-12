import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getCorporateEmailSendMode } from './send-config.ts';

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

  it('send=1 dry-run=0 → live', () => {
    const m = getCorporateEmailSendMode({
      FF_CORPORATE_EMAIL_SEND_ENABLED: '1',
      FF_CORPORATE_EMAIL_DRY_RUN: '0',
    });
    assert.equal(m.enabled, true);
    if (m.enabled) assert.equal(m.dryRun, false);
  });
});
