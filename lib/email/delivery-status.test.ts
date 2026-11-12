import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  emailHistoryLabel,
  resolveEmailHistoryKind,
} from './delivery-status.ts';

describe('delivery status', () => {
  it('sent+accepted no es entregado', () => {
    const kind = resolveEmailHistoryKind({
      status: 'sent',
      providerStatus: 'accepted',
    });
    assert.equal(kind, 'accepted_by_provider');
    assert.equal(emailHistoryLabel(kind), 'Enviado a Resend');
  });

  it('delivered solo con confirmación', () => {
    assert.equal(
      resolveEmailHistoryKind({
        status: 'sent',
        providerStatus: 'delivered',
      }),
      'delivered'
    );
  });

  it('bounced y blocked', () => {
    assert.equal(
      resolveEmailHistoryKind({ status: 'sent', providerStatus: 'bounced' }),
      'bounced'
    );
    assert.equal(
      resolveEmailHistoryKind({ status: 'blocked' }),
      'blocked'
    );
  });

  it('queued es pendiente', () => {
    assert.equal(
      resolveEmailHistoryKind({ status: 'queued' }),
      'pending_send'
    );
  });
});
