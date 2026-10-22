import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildManualPickupWhatsAppLink,
  buildManualPickupWhatsAppMessage,
} from './whatsapp-notify.ts';

describe('manual WhatsApp pickup notify', () => {
  it('incluye importe confirmado y no inventa productos', () => {
    const msg = buildManualPickupWhatsAppMessage({
      pharmacyName: 'Farmacia Prueba Piloto',
      displayNumber: '0001',
      confirmedAmountEuro: 12.5,
    });
    assert.match(msg, /Farmacia Prueba Piloto/);
    assert.match(msg, /#0001/);
    assert.match(msg, /12,50/);
    assert.doesNotMatch(msg, /ibuprofeno|nota|sanitari/i);
  });

  it('omite cifra si no hay importe confirmado', () => {
    const msg = buildManualPickupWhatsAppMessage({
      pharmacyName: 'Farmacia X',
      displayNumber: '0002',
      confirmedAmountEuro: null,
    });
    assert.doesNotMatch(msg, /Importe total confirmado/);
    assert.doesNotMatch(msg, /\d+[.,]\d{2}\s*€/);
  });

  it('rechaza teléfono inválido', () => {
    const built = buildManualPickupWhatsAppLink({
      pharmacyName: 'Farmacia X',
      displayNumber: '0001',
      customerPhone: '123',
      confirmedAmountEuro: 10,
    });
    assert.equal(built.ok, false);
    if (!built.ok) {
      assert.match(built.error, /teléfono/i);
    }
  });

  it('abre wa.me con +34 y mensaje codificado', () => {
    const built = buildManualPickupWhatsAppLink({
      pharmacyName: 'Farmacia X',
      displayNumber: '0003',
      customerPhone: '612345678',
      confirmedAmountEuro: 0,
    });
    assert.equal(built.ok, true);
    if (built.ok) {
      assert.match(built.href, /^https:\/\/wa\.me\/34612345678\?text=/);
      assert.match(decodeURIComponent(built.href), /0,00/);
    }
  });
});
