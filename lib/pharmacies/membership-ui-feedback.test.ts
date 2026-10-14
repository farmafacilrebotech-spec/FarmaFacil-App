/**
 * Pruebas focalizadas (node:test) para feedback de acciones de usuarios.
 * Ejecutar: node --experimental-strip-types --test lib/pharmacies/membership-ui-feedback.test.ts
 * (Node 22+) o vía npm run test:membership-ui si está definido.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  interpretMembershipActionResult,
  shouldShowErrorFeedback,
  shouldShowSuccessFeedback,
} from './membership-ui-feedback.ts';

describe('interpretMembershipActionResult', () => {
  it('maps ok:false to error and never success', () => {
    const result = interpretMembershipActionResult({
      ok: false,
      error: 'No se ha podido reenviar la invitación por email.',
    });
    assert.equal(result.kind, 'error');
    assert.match(result.message, /reenviar/i);
    assert.equal(
      shouldShowSuccessFeedback({
        ok: false,
        error: 'x',
      }),
      false
    );
    assert.equal(
      shouldShowErrorFeedback({
        ok: false,
        error: 'x',
      }),
      true
    );
  });

  it('maps ok:true with email warning to partial_success', () => {
    const result = interpretMembershipActionResult({
      ok: true,
      message:
        'La invitación se ha creado, pero no se ha podido enviar el correo. Puedes volver a enviarlo.',
    });
    assert.equal(result.kind, 'partial_success');
    assert.equal(
      shouldShowSuccessFeedback({
        ok: true,
        message: result.message,
      }),
      true
    );
  });

  it('maps plain ok:true to success', () => {
    const result = interpretMembershipActionResult({
      ok: true,
      message: 'Acceso suspendido. El usuario ya no puede entrar a esta farmacia.',
    });
    assert.equal(result.kind, 'success');
    assert.equal(shouldShowErrorFeedback({ ok: true, message: 'ok' }), false);
  });
});
