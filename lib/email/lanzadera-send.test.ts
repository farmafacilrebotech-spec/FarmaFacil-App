import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LANZADERA_EMAIL_FROM,
  LANZADERA_EMAIL_REPLY_TO,
  LANZADERA_PHOTO_PUBLIC_URL,
  LANZADERA_PRODUCT_SEND_ENABLED,
  LANZADERA_SEND_PUBLIC_ASSETS,
  buildLanzaderaOutreachEmail,
  checkLanzaderaPublicAssets,
  prepareLanzaderaResendPayload,
  sendLanzaderaTestEmail,
} from './lanzadera-outreach.ts';

describe('lanzadera send prep', () => {
  it('keeps product send disabled and preferred photo on www', () => {
    assert.equal(LANZADERA_PRODUCT_SEND_ENABLED, false);
    assert.equal(
      LANZADERA_PHOTO_PUBLIC_URL,
      'https://www.farmafacil.solutions/images/email/firma-pilar.png'
    );
    assert.equal(
      LANZADERA_SEND_PUBLIC_ASSETS.photo,
      LANZADERA_PHOTO_PUBLIC_URL
    );
  });

  it('send HTML has HTTPS assets and approved From/Reply-To', () => {
    const mail = buildLanzaderaOutreachEmail({ imageMode: 'send' });
    assert.equal(mail.from, LANZADERA_EMAIL_FROM);
    assert.equal(mail.replyTo, LANZADERA_EMAIL_REPLY_TO);
    assert.equal(mail.sendEnabled, false);
    assert.ok(mail.html.includes(LANZADERA_PHOTO_PUBLIC_URL));
    assert.equal(/src="\/images\//.test(mail.html), false);
    assert.equal(mail.html.includes('127.0.0.1'), false);
    assert.equal(/ReBoTech/i.test(mail.html), false);
  });

  it('blocks test send without authorization', async () => {
    const blocked = await sendLanzaderaTestEmail({
      to: 'alguien@example.com',
      authorizeSend: false,
      confirmPhrase: '',
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.code, 'not_authorized');
  });

  it('blocks test send while product flag is false even if authorized', async () => {
    const blocked = await sendLanzaderaTestEmail({
      to: 'alguien@example.com',
      authorizeSend: true,
      confirmPhrase: 'LANZADERA_TEST_SEND',
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.code, 'disabled');
  });

  it('prepare payload reports photo not ready when 404', async () => {
    const fakeFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('firma-pilar')) {
        return new Response('missing', {
          status: 404,
          headers: { 'content-type': 'text/html' },
        });
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    };

    const report = await checkLanzaderaPublicAssets(fakeFetch);
    assert.equal(report.ready, false);
    assert.ok(report.blocking.some((u) => u.includes('firma-pilar')));

    const payload = await prepareLanzaderaResendPayload(fakeFetch);
    assert.equal(payload.assetsReady, false);
    assert.equal(payload.from, LANZADERA_EMAIL_FROM);
    assert.equal(payload.replyTo, LANZADERA_EMAIL_REPLY_TO);
    assert.equal(payload.sendEnabled, false);
  });
});
