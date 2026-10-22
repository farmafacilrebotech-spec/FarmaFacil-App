import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mapCommercialRpcError } from './rpc-errors.ts';

describe('mapCommercialRpcError', () => {
  it('mapea códigos conocidos sin filtrar secretos', () => {
    assert.equal(
      mapCommercialRpcError('forbidden_commercial_trials'),
      'No tienes permiso para gestionar pilotos.'
    );
    assert.equal(
      mapCommercialRpcError('extension_reason_required'),
      'Indica un motivo de ampliación (mín. 3 caracteres).'
    );
    assert.match(
      mapCommercialRpcError('Faltan condiciones obligatorias para activar'),
      /readiness/i
    );
  });

  it('no devolución genérica con detalles de conexión', () => {
    const msg = mapCommercialRpcError(
      'connection to host db.example.com port 5432 failed'
    );
    assert.equal(msg, 'No se ha podido completar la operación comercial.');
    assert.doesNotMatch(msg, /5432|example\.com/);
  });
});
