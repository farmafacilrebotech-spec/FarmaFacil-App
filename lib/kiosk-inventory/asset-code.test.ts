import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { kioskAssetStablePath } from './types.ts';

/** Espejo de la regla SQL asset_code ~ '^KSK-[0-9]{4,}$' */
function isValidAssetCode(code: string): boolean {
  return /^KSK-[0-9]{4,}$/.test(code);
}

function formatAssetCode(n: number): string {
  const width = Math.max(4, String(n).length);
  return `KSK-${String(n).padStart(width, '0')}`;
}

describe('kiosk asset codes', () => {
  it('formatea KSK-0001 y códigos largos', () => {
    assert.equal(formatAssetCode(1), 'KSK-0001');
    assert.equal(formatAssetCode(12), 'KSK-0012');
    assert.equal(formatAssetCode(10000), 'KSK-10000');
    assert.equal(isValidAssetCode('KSK-0001'), true);
    assert.equal(isValidAssetCode('KSK-1'), false);
    assert.equal(isValidAssetCode('KSK-ABCD'), false);
  });

  it('path estable del QR no incluye farmacia', () => {
    const path = kioskAssetStablePath('KSK-0001');
    assert.equal(path, '/inventario-kioskos/codigo/KSK-0001');
    assert.equal(path.includes('farmacia'), false);
  });
});
