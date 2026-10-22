import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  appUrlFromHeaders,
  requestPublicOriginFromHeaders,
} from './request-origin.ts';

function headers(map: Record<string, string>) {
  return {
    get(name: string) {
      return map[name.toLowerCase()] ?? null;
    },
  };
}

describe('requestPublicOriginFromHeaders', () => {
  it('preserves 127.0.0.1 from Host (does not rewrite to localhost)', () => {
    const origin = requestPublicOriginFromHeaders(
      headers({ host: '127.0.0.1:3010' }),
      'http://localhost:3010'
    );
    assert.equal(origin, 'http://127.0.0.1:3010');
    const dest = appUrlFromHeaders(
      headers({ host: '127.0.0.1:3010' }),
      'http://localhost:3010',
      '/first-access'
    );
    assert.equal(dest.href, 'http://127.0.0.1:3010/first-access');
    assert.equal(dest.hostname, '127.0.0.1');
  });

  it('preserves localhost when that is the Host', () => {
    assert.equal(
      requestPublicOriginFromHeaders(
        headers({ host: 'localhost:3010' }),
        'http://127.0.0.1:3010'
      ),
      'http://localhost:3010'
    );
  });

  it('honours x-forwarded-host / proto', () => {
    assert.equal(
      requestPublicOriginFromHeaders(
        headers({
          host: '127.0.0.1:3010',
          'x-forwarded-host': 'app.farmafacil.solutions',
          'x-forwarded-proto': 'https',
        }),
        'http://127.0.0.1:3010'
      ),
      'https://app.farmafacil.solutions'
    );
  });

  it('documents why localhost Location breaks first-access session', () => {
    const cookieHost = '127.0.0.1';
    const badLocationHost = 'localhost';
    assert.notEqual(
      cookieHost,
      badLocationHost,
      'host-only cookies do not follow 127.0.0.1 → localhost redirects'
    );
  });

  it('middleware-style login?next=/auth/continue must stay on 127.0.0.1', () => {
    const dest = appUrlFromHeaders(
      headers({ host: '127.0.0.1:3010' }),
      'http://localhost:3010',
      '/login'
    );
    dest.searchParams.set('next', '/auth/continue');
    assert.equal(dest.hostname, '127.0.0.1');
    assert.equal(dest.pathname, '/login');
    assert.equal(dest.searchParams.get('next'), '/auth/continue');
  });
});
