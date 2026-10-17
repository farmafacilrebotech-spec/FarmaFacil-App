import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';

import {
  CANONICAL_PRODUCTION_APP_URL,
  getAppBaseUrl,
  isEphemeralDeployHost,
} from './app-url.ts';

describe('isEphemeralDeployHost', () => {
  it('detects vercel and netlify previews', () => {
    assert.equal(isEphemeralDeployHost('farmafacil-app.vercel.app'), true);
    assert.equal(
      isEphemeralDeployHost('farmafacil-1d33el7gx-pilars-projects-4b376277.vercel.app'),
      true
    );
    assert.equal(isEphemeralDeployHost('something.netlify.app'), true);
  });

  it('allows the canonical custom domain', () => {
    assert.equal(isEphemeralDeployHost('app.farmafacil.solutions'), false);
  });
});

describe('getAppBaseUrl', () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevPublic = process.env.NEXT_PUBLIC_APP_URL;
  const prevApp = process.env.APP_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
  });

  afterEach(() => {
    process.env.NODE_ENV = prevNodeEnv;
    if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevPublic;
    if (prevApp === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = prevApp;
  });

  it('uses canonical when production env is a Vercel preview', () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_APP_URL = 'https://farmafacil-app.vercel.app';
    assert.equal(getAppBaseUrl(), CANONICAL_PRODUCTION_APP_URL);
  });

  it('keeps canonical custom domain in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.farmafacil.solutions';
    assert.equal(getAppBaseUrl(), 'https://app.farmafacil.solutions');
  });

  it('falls back to canonical when production URL is missing', () => {
    process.env.NODE_ENV = 'production';
    assert.equal(getAppBaseUrl(), CANONICAL_PRODUCTION_APP_URL);
  });

  it('rejects localhost in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    assert.equal(getAppBaseUrl(), null);
  });

  it('allows localhost in development', () => {
    process.env.NODE_ENV = 'development';
    assert.equal(getAppBaseUrl(), 'http://localhost:3000');
  });
});
