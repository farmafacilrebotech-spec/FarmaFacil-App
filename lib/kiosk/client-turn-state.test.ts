import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bindClientTurnToSession,
  emptyKioskClientTurn,
  parseStoredClientTurn,
} from './client-turn-state.ts';

const BIND_A = {
  pharmacyId: 'ph-a',
  deviceId: 'dev-a',
  sessionId: 'sess-a',
};

describe('kiosk client-turn-state', () => {
  it('genera token impredecible de longitud suficiente', () => {
    const a = emptyKioskClientTurn(BIND_A);
    const b = emptyKioskClientTurn(BIND_A);
    assert.ok(a.token.length >= 32);
    assert.notEqual(a.token, b.token);
  });

  it('bind crea turno nuevo si cambia sesión o farmacia', () => {
    const t = emptyKioskClientTurn(BIND_A);
    const other = bindClientTurnToSession(t, {
      ...BIND_A,
      sessionId: 'sess-b',
    });
    assert.notEqual(other.token, t.token);
    assert.equal(other.sessionId, 'sess-b');
  });

  it('parse rechaza token corto o JSON inválido', () => {
    assert.equal(parseStoredClientTurn('nope'), null);
    assert.equal(
      parseStoredClientTurn(
        JSON.stringify({ ...BIND_A, token: 'short', createdAt: 1 })
      ),
      null
    );
  });
});
