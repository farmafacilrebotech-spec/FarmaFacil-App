import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Reglas de aislamiento B1 (espejo conceptual del SQL).
 * Documentan: turno A ≠ turno B; UUID de A no autoriza a B.
 */

function canPollConsult(input: {
  turnActive: boolean;
  turnMatchesSession: boolean;
  consultBelongsToTurn: boolean;
  samePharmacy: boolean;
  sameDevice: boolean;
  sameDeviceSession: boolean;
}): 'ok' | 'turn_revoked' | 'forbidden' {
  if (!input.turnActive) return 'turn_revoked';
  if (
    !input.turnMatchesSession ||
    !input.samePharmacy ||
    !input.sameDevice ||
    !input.sameDeviceSession ||
    !input.consultBelongsToTurn
  ) {
    return 'forbidden';
  }
  return 'ok';
}

describe('aislamiento poll kiosko (B1)', () => {
  it('cliente B con UUID de A y turno propio → forbidden', () => {
    assert.equal(
      canPollConsult({
        turnActive: true,
        turnMatchesSession: true,
        consultBelongsToTurn: false,
        samePharmacy: true,
        sameDevice: true,
        sameDeviceSession: true,
      }),
      'forbidden'
    );
  });

  it('turno revocado → turn_revoked aunque UUID coincida', () => {
    assert.equal(
      canPollConsult({
        turnActive: false,
        turnMatchesSession: true,
        consultBelongsToTurn: true,
        samePharmacy: true,
        sameDevice: true,
        sameDeviceSession: true,
      }),
      'turn_revoked'
    );
  });

  it('mismo turno activo y consulta propia → ok', () => {
    assert.equal(
      canPollConsult({
        turnActive: true,
        turnMatchesSession: true,
        consultBelongsToTurn: true,
        samePharmacy: true,
        sameDevice: true,
        sameDeviceSession: true,
      }),
      'ok'
    );
  });
});

describe('gates comerciales (espejo)', () => {
  function canCreate(input: {
    mode: 'demo' | 'contracted' | 'off';
    moduleUsable: boolean;
    pharmacistConsultEnabled: boolean;
  }): boolean {
    return (
      input.moduleUsable &&
      input.mode === 'contracted' &&
      input.pharmacistConsultEnabled
    );
  }

  it('DEMO y sin módulo bloqueados; contratado+permiso ok', () => {
    assert.equal(
      canCreate({
        mode: 'demo',
        moduleUsable: true,
        pharmacistConsultEnabled: false,
      }),
      false
    );
    assert.equal(
      canCreate({
        mode: 'contracted',
        moduleUsable: false,
        pharmacistConsultEnabled: true,
      }),
      false
    );
    assert.equal(
      canCreate({
        mode: 'contracted',
        moduleUsable: true,
        pharmacistConsultEnabled: true,
      }),
      true
    );
  });
});
