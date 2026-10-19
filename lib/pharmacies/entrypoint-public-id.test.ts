/**
 * npm run test:pharmacy-qr
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ENTRYPOINT_PUBLIC_ID_LENGTH,
  assertEntrypointBelongsToPharmacy,
  generateEntrypointPublicId,
  isValidEntrypointPublicId,
  resolveEnsureHomeEntrypoint,
} from './entrypoint-public-id.ts';

describe('generateEntrypointPublicId', () => {
  it('genera id de longitud fija [a-z0-9], sin datos de farmacia', () => {
    const id = generateEntrypointPublicId(() => {
      const buf = new Uint8Array(ENTRYPOINT_PUBLIC_ID_LENGTH);
      for (let i = 0; i < buf.length; i++) buf[i] = i * 7 + 3;
      return buf;
    });
    assert.equal(id.length, 16);
    assert.equal(isValidEntrypointPublicId(id), true);
    assert.match(id, /^[a-z0-9]+$/);
  });

  it('dos semillas distintas → ids distintos (unicidad de formato)', () => {
    const a = generateEntrypointPublicId(() => new Uint8Array(16).fill(1));
    const b = generateEntrypointPublicId(() => new Uint8Array(16).fill(2));
    assert.notEqual(a, b);
  });
});

describe('resolveEnsureHomeEntrypoint — alta / backfill idempotente', () => {
  it('alta: sin existente → created=true con el nuevo id', () => {
    assert.deepEqual(
      resolveEnsureHomeEntrypoint({
        existingPublicId: null,
        newlyGeneratedPublicId: 'abcdefghijklmnop',
      }),
      { publicId: 'abcdefghijklmnop', created: true }
    );
  });

  it('backfill: si ya hay public_id → no lo modifica', () => {
    assert.deepEqual(
      resolveEnsureHomeEntrypoint({
        existingPublicId: 'existingid123456',
        newlyGeneratedPublicId: 'shouldnotuse0000',
      }),
      { publicId: 'existingid123456', created: false }
    );
  });
});

describe('aislamiento por farmacia', () => {
  it('rechaza usar entrypoint de otra farmacia', () => {
    assert.equal(
      assertEntrypointBelongsToPharmacy({
        entrypointPharmacyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        requestedPharmacyId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      }),
      false
    );
    assert.equal(
      assertEntrypointBelongsToPharmacy({
        entrypointPharmacyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        requestedPharmacyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }),
      true
    );
  });
});
