import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PUBLIC_PHARMACY_QR_PURPOSE,
  mapResolveEntrypointRpcPayload,
  normalizePublicEntrypointId,
} from './public-id.ts';

describe('normalizePublicEntrypointId', () => {
  it('acepta public_id de 16 chars [a-z0-9] (formato 042)', () => {
    assert.equal(
      normalizePublicEntrypointId('AbCdEfGhIjKlMnOp'),
      'abcdefghijklmnop'
    );
  });

  it('decodifica URI y valida formato CHECK 009', () => {
    assert.equal(normalizePublicEntrypointId('abc-def'), 'abc-def');
    assert.equal(normalizePublicEntrypointId('  XYZ123  '), 'xyz123');
  });

  it('rechaza vacío, demasiado corto o caracteres inválidos', () => {
    assert.equal(normalizePublicEntrypointId(''), null);
    assert.equal(normalizePublicEntrypointId('ab'), null);
    assert.equal(normalizePublicEntrypointId('ab!'), null);
    assert.equal(normalizePublicEntrypointId('../etc'), null);
  });
});

describe('mapResolveEntrypointRpcPayload — contrato mínimo 044', () => {
  it('purpose del QR público es pharmacy_home (009/042)', () => {
    assert.equal(PUBLIC_PHARMACY_QR_PURPOSE, 'pharmacy_home');
  });

  it('mapea ok solo con public_id y pharmacy_name', () => {
    const result = mapResolveEntrypointRpcPayload({
      status: 'ok',
      public_id: 'abcdefghijklmnop',
      pharmacy_name: 'Farmacia Total PRO',
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.pharmacyName, 'Farmacia Total PRO');
      assert.equal(result.publicId, 'abcdefghijklmnop');
      assert.equal('pharmacyId' in result, false);
      assert.equal('internalRoute' in result, false);
      assert.equal('purpose' in result, false);
    }
  });

  it('ignora campos sensibles si alguien los enviara en el payload', () => {
    const result = mapResolveEntrypointRpcPayload({
      status: 'ok',
      public_id: 'abcdefghijklmnop',
      pharmacy_name: 'Farmacia Total PRO',
      pharmacy_id: '11111111-1111-4111-8111-111111111111',
      internal_route: '/secret',
      purpose: 'campaign',
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(Object.keys(result).sort(), [
        'ok',
        'pharmacyName',
        'publicId',
      ]);
    }
  });

  it('distingue not_found vs inactive (regresión QR)', () => {
    assert.deepEqual(mapResolveEntrypointRpcPayload({ status: 'not_found' }), {
      ok: false,
      reason: 'not_found',
    });
    assert.deepEqual(mapResolveEntrypointRpcPayload({ status: 'inactive' }), {
      ok: false,
      reason: 'inactive',
    });
  });

  it('rechaza payload ok incompleto sin inventar farmacia', () => {
    assert.deepEqual(
      mapResolveEntrypointRpcPayload({
        status: 'ok',
        public_id: 'abcdefghijklmnop',
        pharmacy_name: '',
      }),
      { ok: false, reason: 'error' }
    );
  });

  it('migración 044 filtra purpose pharmacy_home y omite pharmacy_id/internal_route', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const sql = readFileSync(
      join(
        here,
        '../../supabase/migrations/044_resolve_public_entrypoint_v1.sql'
      ),
      'utf8'
    );
    assert.match(sql, /purpose = 'pharmacy_home'/);
    assert.match(sql, /'pharmacy_name'/);
    assert.match(sql, /'public_id'/);
    assert.equal(/'pharmacy_id'/.test(sql), false);
    assert.equal(/'internal_route'/.test(sql), false);
  });
});
