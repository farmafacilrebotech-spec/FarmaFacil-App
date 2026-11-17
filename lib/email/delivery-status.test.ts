import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  emailHistoryLabel,
  resolveEmailHistoryKind,
} from './delivery-status.ts';
import { EMAIL_EMPTY_BODY_ERROR } from './content-messages.ts';

describe('delivery-status EMAIL-09', () => {
  it('dry-run sent → Envío simulado (no aceptado Resend)', () => {
    const kind = resolveEmailHistoryKind({
      status: 'sent',
      providerStatus: 'accepted',
      dryRun: true,
      providerMessageId: 'dry-run-abcdef12',
    });
    assert.equal(kind, 'simulated');
    assert.equal(emailHistoryLabel(kind), 'Envío simulado');
  });

  it('provider_status simulated → Envío simulado', () => {
    const kind = resolveEmailHistoryKind({
      status: 'sent',
      providerStatus: 'simulated',
      dryRun: false,
    });
    assert.equal(kind, 'simulated');
  });

  it('live accepted → Aceptado por el proveedor', () => {
    const kind = resolveEmailHistoryKind({
      status: 'sent',
      providerStatus: 'accepted',
      dryRun: false,
      providerMessageId: '01a1e5a4-0272-7912-a8d0-544e5d1b9b67',
    });
    assert.equal(kind, 'accepted_by_provider');
    assert.equal(emailHistoryLabel(kind), 'Aceptado por el proveedor');
  });

  it('live delivered only when not simulated', () => {
    assert.equal(
      resolveEmailHistoryKind({
        status: 'sent',
        providerStatus: 'delivered',
        dryRun: false,
        deliveredAt: '2026-11-17T00:00:00Z',
      }),
      'delivered'
    );
    assert.equal(
      resolveEmailHistoryKind({
        status: 'sent',
        providerStatus: 'delivered',
        dryRun: true,
      }),
      'simulated'
    );
  });

  it('failed → Error de envío', () => {
    assert.equal(
      resolveEmailHistoryKind({ status: 'failed', dryRun: false }),
      'error'
    );
    assert.equal(emailHistoryLabel('error'), 'Error de envío');
  });

  it('mensaje vacío EMAIL-09 permanece estable', () => {
    assert.equal(
      EMAIL_EMPTY_BODY_ERROR,
      'Escribe el contenido del email antes de enviarlo'
    );
  });
});
