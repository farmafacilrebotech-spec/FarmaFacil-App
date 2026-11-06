import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  FF_EMAIL_FROM,
  FF_EMAIL_REPLY_TO,
  FF_LOGO_URL,
  FF_MODULE_ICON_PATHS,
  FF_PHOTO_LOCAL_PATH,
  FF_PHOTO_PUBLIC_URL,
  PRINTING_QUOTE_SUBJECT,
  PRINTING_QUOTE_TEMPLATE_ID,
  PHARMACY_DEMO_SUBJECT,
  PHARMACY_DEMO_TEMPLATE_ID,
  PHARMACY_PILOT_SUBJECT,
  PHARMACY_PILOT_TEMPLATE_ID,
  assertSendHtmlHasNoLocalAssets,
  buildPharmacyDemoEmail,
  buildPharmacyPilotEmail,
  buildPrintingQuoteEmail,
  normalizeFfPreviewOrigin,
} from './corporate-templates.ts';

const root = join(process.cwd(), 'public');

describe('corporate email shared', () => {
  it('normalizes localhost preview origin to http', () => {
    assert.equal(
      normalizeFfPreviewOrigin('https://localhost:3000'),
      'http://localhost:3000'
    );
    assert.equal(
      normalizeFfPreviewOrigin('http://127.0.0.1:3000/'),
      'http://127.0.0.1:3000'
    );
  });

  it('has local photo and module icons on disk', () => {
    assert.equal(
      existsSync(join(root, FF_PHOTO_LOCAL_PATH.replace(/^\//, ''))),
      true
    );
    for (const path of Object.values(FF_MODULE_ICON_PATHS)) {
      assert.equal(existsSync(join(root, path.replace(/^\//, ''))), true, path);
    }
  });
});

describe('printing quote email', () => {
  it('builds send HTML with definitive materials specs, send disabled', () => {
    const mail = buildPrintingQuoteEmail({ imageMode: 'send' });
    assert.equal(mail.sendEnabled, false);
    assert.equal(mail.templateId, PRINTING_QUOTE_TEMPLATE_ID);
    assert.equal(mail.subject, PRINTING_QUOTE_SUBJECT);
    assert.equal(mail.from, FF_EMAIL_FROM);
    assert.equal(mail.replyTo, FF_EMAIL_REPLY_TO);
    assert.ok(mail.html.includes(PRINTING_QUOTE_TEMPLATE_ID));
    assert.ok(
      mail.html.includes(
        'Solicitud de presupuesto | Material corporativo FarmaFácil'
      )
    );
    assert.ok(mail.html.includes('Tarjetas de visita — 1.000 unidades'));
    assert.ok(mail.html.includes('85 × 55 mm'));
    assert.ok(mail.html.includes('Flyers publicitarios — 1.000 unidades'));
    assert.ok(mail.html.includes('Carpetas para dosieres comerciales'));
    assert.ok(mail.html.includes('Vinilos circulares para kioskos — 50 unidades'));
    assert.ok(mail.html.includes('Pegatinas troqueladas redondas — 500 unidades'));
    assert.ok(mail.html.includes('Roll-ups publicitarios'));
    assert.ok(mail.html.includes('85 × 200 cm'));
    assert.ok(mail.html.includes('Material promocional para farmacias'));
    assert.ok(mail.html.includes('Carteles o expositores de mostrador'));
    assert.ok(mail.html.includes('Adhesivos QR personalizados'));
    assert.ok(mail.html.includes('Vinilos promocionales para escaparates'));
    assert.ok(mail.html.includes('Gastos de envío a Valencia'));
    assert.ok(mail.html.includes('Información solicitada'));
    assert.ok(mail.html.includes('Quedo pendiente de vuestra propuesta'));
    assert.ok(mail.html.includes('Un saludo,'));
    assert.ok(mail.html.includes('Fundadora y Directora | FarmaFácil'));
    assert.ok(mail.html.includes('+34 711 520 218'));
    assert.equal(mail.html.includes('Bolsas de tela'), false);
    assert.equal(mail.html.includes('Bolígrafos corporativos'), false);
    assert.ok(mail.html.includes(FF_LOGO_URL));
    assert.ok(mail.html.includes(FF_PHOTO_PUBLIC_URL));
    assert.equal(/ReBoTech/i.test(mail.html), false);
    assert.equal(mail.html.includes('Catálogo digital QR'), false);
    assertSendHtmlHasNoLocalAssets(mail.html);
    assert.ok(mail.text.includes('Tarjetas de visita — 1.000 unidades'));
    assert.ok(mail.text.includes('Roll-ups publicitarios'));
    assert.ok(mail.text.includes('Información solicitada:'));
    assert.ok(mail.text.includes('Fundadora y Directora | FarmaFácil'));
    assert.ok(mail.text.includes('+34 711 520 218'));
  });

  it('preview uses local photo path when origin provided', () => {
    const mail = buildPrintingQuoteEmail({
      imageMode: 'preview',
      previewOrigin: 'http://localhost:3000',
    });
    assert.ok(mail.photoUrl.includes('/images/email/firma-pilar.png'));
    assert.ok(mail.photoUrl.startsWith('http://localhost:3000'));
  });
});

describe('pharmacy demo email', () => {
  it('builds feature cards, mailto CTA and send disabled', () => {
    const mail = buildPharmacyDemoEmail({ imageMode: 'send' });
    assert.equal(mail.sendEnabled, false);
    assert.equal(mail.templateId, PHARMACY_DEMO_TEMPLATE_ID);
    assert.equal(mail.subject, PHARMACY_DEMO_SUBJECT);
    assert.equal(mail.from, FF_EMAIL_FROM);
    assert.equal(mail.replyTo, FF_EMAIL_REPLY_TO);
    assert.ok(mail.html.includes('Catálogo digital QR'));
    assert.ok(mail.html.includes('Pedidos online'));
    assert.ok(mail.html.includes('Kiosko de autoservicio'));
    assert.ok(mail.html.includes('Asistente virtual con IA'));
    assert.ok(mail.html.includes('Solicitar una demostración'));
    assert.ok(
      mail.html.includes(
        'mailto:pilar@farmafacil.solutions?subject=Solicitud%20de%20demostraci%C3%B3n%20de%20FarmaF%C3%A1cil'
      )
    );
    assert.ok(mail.html.includes(FF_PHOTO_PUBLIC_URL));
    assert.ok(
      mail.html.includes('https://app.farmafacil.solutions/images/kiosk/')
    );
    assert.equal(/ReBoTech/i.test(mail.html), false);
    assertSendHtmlHasNoLocalAssets(mail.html);
  });
});

describe('pharmacy pilot email', () => {
  it('builds 30-day pilot terms, CTA and send disabled', () => {
    const mail = buildPharmacyPilotEmail({ imageMode: 'send' });
    assert.equal(mail.sendEnabled, false);
    assert.equal(mail.templateId, PHARMACY_PILOT_TEMPLATE_ID);
    assert.equal(mail.subject, PHARMACY_PILOT_SUBJECT);
    assert.equal(mail.from, FF_EMAIL_FROM);
    assert.equal(mail.replyTo, FF_EMAIL_REPLY_TO);
    assert.ok(mail.html.includes('30 días'));
    assert.ok(
      mail.html.includes('Prueba de software: gratuita durante 30 días.')
    );
    assert.ok(mail.html.includes('Fianza reembolsable: 1.000 €'));
    assert.ok(mail.html.includes('200 € + IVA'));
    assert.ok(mail.html.includes('Transporte: presupuesto según ubicación'));
    assert.ok(mail.html.includes('Quiero participar'));
    assert.ok(
      mail.html.includes(
        'mailto:pilar@farmafacil.solutions?subject=Quiero%20participar%20en%20el%20piloto%20de%20FarmaF%C3%A1cil'
      )
    );
    assert.equal(/cesión indefinida/i.test(mail.html), false);
    assert.equal(/conversión automática/i.test(mail.html), false);
    assert.equal(/ReBoTech/i.test(mail.html), false);
    assertSendHtmlHasNoLocalAssets(mail.html);
  });
});
