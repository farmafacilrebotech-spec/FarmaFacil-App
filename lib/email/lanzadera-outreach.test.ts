import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  LANZADERA_EMAIL_FROM,
  LANZADERA_EMAIL_REPLY_TO,
  LANZADERA_EMAIL_SUBJECT,
  LANZADERA_LOGO_URL,
  LANZADERA_MODULE_ICON_PATHS,
  LANZADERA_PHOTO_LOCAL_PATH,
  LANZADERA_PHOTO_PUBLIC_URL,
  buildLanzaderaOutreachEmail,
} from './lanzadera-outreach.ts';

describe('lanzadera outreach email', () => {
  it('builds HTML+text without enabling send and without ReBoTech', () => {
    const mail = buildLanzaderaOutreachEmail({ imageMode: 'send' });
    assert.equal(mail.sendEnabled, false);
    assert.equal(mail.from, LANZADERA_EMAIL_FROM);
    assert.equal(mail.replyTo, LANZADERA_EMAIL_REPLY_TO);
    assert.equal(mail.subject, LANZADERA_EMAIL_SUBJECT);
    assert.ok(mail.from.includes('Pilar Reyes'));
    assert.ok(mail.from.includes('FarmaFácil'));
    assert.ok(mail.from.includes('pilar@farmafacil.solutions'));
    assert.equal(/ReBoTech/i.test(mail.html), false);
    assert.equal(/ReBoTech/i.test(mail.text), false);
    assert.equal(mail.html.includes('contacto@farmafacil.solutions'), false);
    assert.ok(mail.html.includes('ff-lanzadera-outreach-v3'));
    assert.ok(mail.html.includes('27'));
    assert.ok(mail.html.includes('Catálogo digital QR'));
    assert.ok(mail.html.includes('Pedidos online'));
    assert.ok(mail.html.includes('Kiosko de autoservicio'));
    assert.ok(mail.html.includes('Asistente virtual con IA'));
    assert.ok(mail.html.includes('acceso inmediato mediante QR'));
    assert.ok(mail.html.includes('desde cualquier lugar y sin esperas'));
    assert.ok(mail.html.includes('sin colas, directamente en la farmacia'));
    assert.ok(mail.html.includes('siempre a un clic'));
    assert.ok(mail.html.includes('border-radius:40px'));
    assert.ok(mail.html.includes('width:80px;height:80px'));
    assert.ok(mail.html.includes('#E8F8F9'));
    assert.ok(mail.html.includes('mediante un catálogo'));
    assert.ok(mail.html.includes('la gestión de pedidos'));
    assert.ok(mail.html.includes('un kiosko de autoservicio'));
    assert.equal(mail.html.includes('mediante tres módulos'), false);
    assert.ok(mail.html.includes('Pilar Reyes Bononat'));
    assert.ok(mail.html.includes('Fundadora de FarmaFácil'));
  });

  it('uses approved subject, closing and no CONSULTA box', () => {
    const mail = buildLanzaderaOutreachEmail({ imageMode: 'send' });
    assert.ok(
      mail.subject.includes(
        'Evolución del proyecto e incorporación a Lanzadera'
      )
    );
    assert.ok(
      mail.html.includes(
        'Creemos que marzo sería un momento especialmente interesante'
      )
    );
    assert.ok(
      mail.html.includes(
        'recomendaríais esperar a septiembre'
      )
    );
    assert.ok(mail.html.includes('Muchas gracias por vuestro tiempo y orientación'));
    assert.ok(mail.html.includes('Un saludo,'));
    assert.equal(
      /text-transform:uppercase[^>]*>\s*Consulta\s*</i.test(mail.html) ||
        mail.html.includes('>CONSULTA<'),
      false
    );
    assert.equal(
      mail.html.includes('Quedo a vuestra disposición'),
      false
    );
  });

  it('keeps five roadmap stages and current-state wording', () => {
    const mail = buildLanzaderaOutreachEmail({ imageMode: 'send' });
    assert.ok(mail.html.includes('NOV 2026'));
    assert.ok(mail.html.includes('DIC 2026'));
    assert.ok(mail.html.includes('ENE 2027'));
    assert.ok(mail.html.includes('FEB 2027'));
    assert.ok(mail.html.includes('MAR 2027'));
    assert.ok(mail.html.includes('en fase de pruebas'));
    assert.ok(mail.html.includes('Iniciar cinco pilotos'));
    assert.ok(mail.html.includes('Objetivos previstos'));
  });

  it('uses brand colors, compact logo and HTTPS assets in send mode', () => {
    const mail = buildLanzaderaOutreachEmail({ imageMode: 'send' });
    assert.ok(mail.html.includes('#2EC4C7'));
    assert.ok(mail.html.includes('#111827'));
    assert.ok(mail.html.includes('#E7EEF3'));
    assert.ok(mail.html.includes(LANZADERA_LOGO_URL));
    assert.ok(mail.html.includes('width="100"'));
    assert.ok(mail.html.includes('height="100"'));
    assert.ok(mail.html.includes(LANZADERA_PHOTO_PUBLIC_URL));
    assert.ok(
      mail.html.includes(
        `https://app.farmafacil.solutions${LANZADERA_MODULE_ICON_PATHS.catalog}`
      )
    );
    assert.ok(
      mail.html.includes(
        `https://app.farmafacil.solutions${LANZADERA_MODULE_ICON_PATHS.orders}`
      )
    );
    assert.ok(
      mail.html.includes(
        `https://app.farmafacil.solutions${LANZADERA_MODULE_ICON_PATHS.kiosk}`
      )
    );
    assert.ok(
      mail.html.includes(
        `https://app.farmafacil.solutions${LANZADERA_MODULE_ICON_PATHS.assistant}`
      )
    );
    assert.ok(mail.html.includes('width="80"'));
    assert.ok(mail.html.includes('border-radius:40px'));
    assert.equal(mail.html.includes('127.0.0.1'), false);
    assert.equal(mail.html.includes('localhost'), false);
  });

  it('resolves local photo and icon paths for SuperAdmin preview', () => {
    const mail = buildLanzaderaOutreachEmail({
      imageMode: 'preview',
      previewOrigin: 'http://127.0.0.1:3010',
    });
    assert.ok(
      mail.html.includes(
        `src="http://127.0.0.1:3010${LANZADERA_PHOTO_LOCAL_PATH}"`
      )
    );
    assert.ok(
      mail.html.includes(
        `src="http://127.0.0.1:3010${LANZADERA_MODULE_ICON_PATHS.catalog}"`
      )
    );
    assert.equal(mail.html.includes('<base'), false);
    assert.equal(
      mail.html.includes('app.farmafacil.solutions/images/email'),
      false
    );
    assert.equal(
      mail.html.includes('app.farmafacil.solutions/images/kiosk'),
      false
    );
    assert.equal(mail.imageMode, 'preview');
    assert.equal(
      mail.photoUrl,
      `http://127.0.0.1:3010${LANZADERA_PHOTO_LOCAL_PATH}`
    );
  });

  it('forces http for https://localhost preview origins (broken-image bug)', () => {
    const mail = buildLanzaderaOutreachEmail({
      imageMode: 'preview',
      previewOrigin: 'https://localhost:3010',
    });
    assert.ok(mail.html.includes('http://localhost:3010/images/kiosk/'));
    assert.equal(mail.html.includes('https://localhost'), false);
    assert.ok(
      mail.html.includes(
        `src="http://localhost:3010${LANZADERA_MODULE_ICON_PATHS.orders}"`
      )
    );
  });

  it('keeps signature photo and module icon assets in public/', () => {
    assert.equal(
      existsSync(join(process.cwd(), 'public/images/email/firma-pilar.png')),
      true
    );
    assert.equal(
      existsSync(
        join(process.cwd(), `public${LANZADERA_MODULE_ICON_PATHS.catalog}`)
      ),
      true
    );
    assert.equal(
      existsSync(
        join(process.cwd(), `public${LANZADERA_MODULE_ICON_PATHS.kiosk}`)
      ),
      true
    );
    assert.equal(
      existsSync(
        join(process.cwd(), `public${LANZADERA_MODULE_ICON_PATHS.assistant}`)
      ),
      true
    );
    assert.equal(
      existsSync(
        join(process.cwd(), `public${LANZADERA_MODULE_ICON_PATHS.orders}`)
      ),
      true
    );
  });
});
