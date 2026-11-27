import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import {
  orderAccessPublicBaseUrl,
  orderAccessPublicUrl,
} from './order-access-public-url.ts';

const ORIGINAL = {
  FF_APP_ENV: process.env.FF_APP_ENV,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  APP_URL: process.env.APP_URL,
  NODE_ENV: process.env.NODE_ENV,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('orderAccessPublicBaseUrl', () => {
  it('usa el host de staging cuando FF_APP_ENV=staging aunque NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    process.env.FF_APP_ENV = 'staging';
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    assert.equal(
      orderAccessPublicBaseUrl(),
      'https://farmafacil-staging.vercel.app'
    );
  });

  it('respeta NEXT_PUBLIC_APP_URL de staging aunque getAppBaseUrl lo descartaría', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.FF_APP_ENV;
    process.env.NEXT_PUBLIC_APP_URL = 'https://farmafacil-staging.vercel.app';
    assert.equal(
      orderAccessPublicBaseUrl(),
      'https://farmafacil-staging.vercel.app'
    );
  });

  it('en producción sin staging cae al dominio canónico', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.FF_APP_ENV;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    assert.equal(
      orderAccessPublicBaseUrl(),
      'https://app.farmafacil.solutions'
    );
  });

  it('compone /o/{token} sin inventar IDs de pedido', () => {
    process.env.FF_APP_ENV = 'staging';
    const url = orderAccessPublicUrl('abcdefghijklmnopqrstuvwxyz0123456789ABCD');
    assert.match(url, /^https:\/\/farmafacil-staging\.vercel\.app\/o\//);
    assert.doesNotMatch(url, /0187|displayNumber|phone/i);
  });
});
