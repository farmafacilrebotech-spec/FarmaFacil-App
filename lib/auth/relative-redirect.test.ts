import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertSameOriginPath } from './relative-redirect-path.ts';

describe('assertSameOriginPath', () => {
  it('accepts relative auth paths used in first-access flow', () => {
    assert.equal(assertSameOriginPath('/first-access'), '/first-access');
    assert.equal(assertSameOriginPath('/auth/continue'), '/auth/continue');
    assert.equal(
      assertSameOriginPath('/login?next=%2Fauth%2Fcontinue'),
      '/login?next=%2Fauth%2Fcontinue'
    );
  });

  it('rejects protocol-relative or absolute URLs (host rewrite risk)', () => {
    assert.throws(() => assertSameOriginPath('//evil.example/phish'));
    assert.throws(() => assertSameOriginPath('https://localhost:3010/login'));
    assert.throws(() => assertSameOriginPath('http://127.0.0.1:3010/login'));
  });
});
