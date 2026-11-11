/**
 * node --experimental-strip-types --test lib/pharmacies/pharmacy-logo-file.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  pharmacyLogoObjectPath,
  probePharmacyLogoBuffer,
  roleCanManagePharmacyLogo,
} from './pharmacy-logo-file.ts';

function pngStub(width: number, height: number): Uint8Array {
  // Minimal IHDR-like header (not a valid full PNG, but enough for our probe)
  const buf = new Uint8Array(24);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf[4] = 0x0d;
  buf[5] = 0x0a;
  buf[6] = 0x1a;
  buf[7] = 0x0a;
  // IHDR length + type skipped; our reader expects width/height at 16/20
  buf[16] = (width >>> 24) & 0xff;
  buf[17] = (width >>> 16) & 0xff;
  buf[18] = (width >>> 8) & 0xff;
  buf[19] = width & 0xff;
  buf[20] = (height >>> 24) & 0xff;
  buf[21] = (height >>> 16) & 0xff;
  buf[22] = (height >>> 8) & 0xff;
  buf[23] = height & 0xff;
  return buf;
}

describe('probePharmacyLogoBuffer', () => {
  it('acepta PNG con dimensiones válidas', () => {
    const r = probePharmacyLogoBuffer(pngStub(256, 128));
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.probe.mime, 'image/png');
      assert.equal(r.probe.width, 256);
      assert.equal(r.probe.height, 128);
    }
  });

  it('rechaza SVG', () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
    );
    const r = probePharmacyLogoBuffer(svg);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /SVG/i);
  });

  it('rechaza demasiado pequeño', () => {
    const r = probePharmacyLogoBuffer(pngStub(16, 16));
    assert.equal(r.ok, false);
  });
});

describe('roleCanManagePharmacyLogo', () => {
  it('solo owner y admin', () => {
    assert.equal(roleCanManagePharmacyLogo('PHARMACY_OWNER'), true);
    assert.equal(roleCanManagePharmacyLogo('PHARMACY_ADMIN'), true);
    assert.equal(roleCanManagePharmacyLogo('PHARMACIST'), false);
    assert.equal(roleCanManagePharmacyLogo('STAFF'), false);
  });
});

describe('pharmacyLogoObjectPath', () => {
  it('aisla por pharmacy_id', () => {
    assert.equal(
      pharmacyLogoObjectPath('AaBbCcDd-EeFf-0011-2233-445566778899', 'png'),
      'aabbccdd-eeff-0011-2233-445566778899/logo.png'
    );
  });
});
