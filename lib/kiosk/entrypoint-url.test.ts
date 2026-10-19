/**
 * npm run test:kiosk-home
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pharmacyEntrypointPath } from './entrypoint-path.ts';

describe('pharmacyEntrypointPath', () => {
  it('builds /e/{public_id} lowercase path', () => {
    assert.equal(pharmacyEntrypointPath('ff-demo-001'), '/e/ff-demo-001');
    assert.equal(pharmacyEntrypointPath('FF-Demo-001'), '/e/ff-demo-001');
  });
});
