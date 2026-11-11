/**
 * node --experimental-strip-types --test lib/pharmacies/pharmacy-clients-aggregate.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aggregateLinkedClientsFromOrders } from './pharmacy-clients-aggregate.ts';

describe('aggregateLinkedClientsFromOrders', () => {
  it('agrega por customer_profile_id y toma contacto de pedidos', () => {
    const clients = aggregateLinkedClientsFromOrders([
      {
        customerProfileId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        customerName: 'Ana',
        customerPhone: '600111222',
        createdAt: '2026-01-02T10:00:00.000Z',
      },
      {
        customerProfileId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        customerName: null,
        customerPhone: null,
        createdAt: '2026-01-01T10:00:00.000Z',
      },
      {
        customerProfileId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        customerName: 'Bruno',
        customerPhone: null,
        createdAt: '2026-01-03T10:00:00.000Z',
      },
    ]);

    assert.equal(clients.length, 2);
    assert.equal(clients[0]!.customerProfileId.startsWith('bbbb'), true);
    assert.equal(clients[0]!.displayName, 'Bruno');
    assert.equal(clients[1]!.displayName, 'Ana');
    assert.equal(clients[1]!.phone, '600111222');
    assert.equal(clients[1]!.orderCount, 2);
    assert.equal(clients[1]!.firstLinkedAt, '2026-01-01T10:00:00.000Z');
    assert.equal(clients[1]!.lastOrderAt, '2026-01-02T10:00:00.000Z');
  });

  it('usa «Cliente» si no hay nombre en pedidos', () => {
    const clients = aggregateLinkedClientsFromOrders([
      {
        customerProfileId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        customerName: '  ',
        customerPhone: null,
        createdAt: '2026-02-01T00:00:00.000Z',
      },
    ]);
    assert.equal(clients[0]!.displayName, 'Cliente');
  });
});
