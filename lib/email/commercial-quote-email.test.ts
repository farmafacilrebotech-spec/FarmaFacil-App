/**
 * PRE-05D · correo comercial breve (fecha + logo oficial).
 * node --experimental-strip-types --test lib/email/commercial-quote-email.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCommercialQuoteEmailBodies,
  COMMERCIAL_QUOTE_EMAIL_LOGO_URL,
  formatCommercialQuoteEmailDate,
} from './commercial-quote-email.ts';

describe('commercial-quote-email PRE-05D', () => {
  it('formatea vigencia como DD/MM/AAAA', () => {
    assert.equal(formatCommercialQuoteEmailDate('2026-12-18'), '18/12/2026');
    assert.equal(
      formatCommercialQuoteEmailDate('2026-12-18T00:00:00.000Z'),
      '18/12/2026'
    );
    assert.equal(formatCommercialQuoteEmailDate(null), '—');
  });

  it('cuerpo breve con logo oficial y sin presupuesto incrustado', () => {
    const bodies = buildCommercialQuoteEmailBodies({
      referenceCode: 'FF-PRE-20261118-F0TQ',
      contactName: 'Pablo',
      clientName: 'Farmacia Nupre Personalizado',
      validUntil: '2026-12-18',
    });
    assert.match(bodies.subject, /FF-PRE-20261118-F0TQ/);
    assert.match(bodies.text, /Vigencia hasta: 18\/12\/2026/);
    assert.match(bodies.html, /Vigencia hasta: 18\/12\/2026/);
    assert.ok(bodies.html.includes(COMMERCIAL_QUOTE_EMAIL_LOGO_URL));
    assert.match(bodies.html, /PDF adjunto/);
    assert.equal(/Coste recurrente|Implantación|Cuota anual/i.test(bodies.html), false);
    assert.equal(/imprim|ctrl\+p|cmd\+p/i.test(bodies.html), false);
  });
});
