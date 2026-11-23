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
      /preparaci[oó]n/i
    );
  });

  it('mapea technical_plan_missing y SKU desconocido en español', () => {
    assert.match(
      mapCommercialRpcError('technical_plan_missing: personalizado', 'P0002'),
      /cat[aá]logo t[eé]cnico/i
    );
    assert.doesNotMatch(
      mapCommercialRpcError('technical_plan_missing: personalizado'),
      /technical_plan_missing/
    );
    assert.match(
      mapCommercialRpcError('unknown_commercial_sku'),
      /no existe o est[aá] inactivo/i
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
