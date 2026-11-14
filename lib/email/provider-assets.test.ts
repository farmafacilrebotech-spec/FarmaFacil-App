import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  htmlHasNonPublicImageSrc,
  resolveProviderAssetUrl,
  rewriteEmailHtmlAssetsForProvider,
  FF_EMAIL_APP_ORIGIN,
  FF_EMAIL_WWW_ORIGIN,
} from './provider-assets.ts';

describe('resolveProviderAssetUrl', () => {
  it('mapea firma y logo a www', () => {
    assert.equal(
      resolveProviderAssetUrl('/images/email/firma-pilar.png'),
      `${FF_EMAIL_WWW_ORIGIN}/images/email/firma-pilar.png`
    );
    assert.equal(
      resolveProviderAssetUrl('/images/logo/farmafacil-logo.png'),
      `${FF_EMAIL_WWW_ORIGIN}/images/logo/farmafacil-logo.png`
    );
  });

  it('mapea iconos kiosk a app', () => {
    assert.equal(
      resolveProviderAssetUrl('/images/kiosk/kiosk-qr.png'),
      `${FF_EMAIL_APP_ORIGIN}/images/kiosk/kiosk-qr.png`
    );
  });

  it('reescribe localhost preview', () => {
    assert.equal(
      resolveProviderAssetUrl(
        'http://127.0.0.1:3065/images/kiosk/kiosk-ai.png'
      ),
      `${FF_EMAIL_APP_ORIGIN}/images/kiosk/kiosk-ai.png`
    );
  });
});

describe('rewriteEmailHtmlAssetsForProvider', () => {
  it('reescribe todos los img src', () => {
    const html = `
      <img src="/images/kiosk/kiosk-qr.png" />
      <img src="http://localhost:3065/images/email/firma-pilar.png" />
    `;
    const out = rewriteEmailHtmlAssetsForProvider(html);
    assert.equal(htmlHasNonPublicImageSrc(out), false);
    assert.ok(out.includes(`${FF_EMAIL_APP_ORIGIN}/images/kiosk/kiosk-qr.png`));
    assert.ok(
      out.includes(`${FF_EMAIL_WWW_ORIGIN}/images/email/firma-pilar.png`)
    );
  });
});
