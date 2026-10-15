/**
 * npm run test:kiosk-pairing
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { KIOSK_SESSION_COOKIE_PATH } from './session-cookie-path.ts';

describe('kiosk session cookie path', () => {
  it('is restricted to /k', () => {
    assert.equal(KIOSK_SESSION_COOKIE_PATH, '/k');
  });
});
