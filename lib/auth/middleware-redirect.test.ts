/**
 * PRE-05C · Location absoluta desde Host (sin reescritura a localhost).
 * node --experimental-strip-types --test lib/auth/middleware-redirect.test.ts
 *
 * No importa next/server aquí (alias ESM). Se prueba appUrlFromHeaders,
 * que es la fuente de la Location del middleware.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { appUrlFromHeaders } from './request-origin.ts';

describe('middleware Location PRE-05C', () => {
  it('Location a login desde Host 127.0.0.1 no usa localhost', () => {
    const headers = {
      get(name: string) {
        if (name.toLowerCase() === 'host') return '127.0.0.1:3070';
        return null;
      },
    };
    const url = appUrlFromHeaders(
      headers,
      'http://localhost:3070',
      '/login?next=%2Ftarifas'
    );
    assert.equal(url.href, 'http://127.0.0.1:3070/login?next=%2Ftarifas');
    assert.equal(url.hostname, '127.0.0.1');
  });
});
