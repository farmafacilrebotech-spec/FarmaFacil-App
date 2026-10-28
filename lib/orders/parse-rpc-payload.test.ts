import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseRpcPayload } from './parse-rpc-payload.ts';

describe('parseRpcPayload', () => {
  it('acepta objeto', () => {
    const p = parseRpcPayload({ status: 'ok', total_amount: 2.09 });
    assert.equal(p?.status, 'ok');
    assert.equal(p?.total_amount, 2.09);
  });

  it('acepta string JSON (respuesta jsonb serializada)', () => {
    const p = parseRpcPayload(
      JSON.stringify({
        status: 'ok',
        order_id: 'bda60631-2df5-4c46-acc0-a500ff1cb888',
        total_amount: 2.09,
        updated_at: '2026-10-26T14:11:50.36532+00',
      })
    );
    assert.equal(p?.status, 'ok');
    assert.equal(p?.total_amount, 2.09);
    assert.equal(p?.updated_at, '2026-10-26T14:11:50.36532+00');
  });

  it('rechaza JSON inválido / arrays', () => {
    assert.equal(parseRpcPayload('not-json'), null);
    assert.equal(parseRpcPayload([{ status: 'ok' }]), null);
    assert.equal(parseRpcPayload(null), null);
  });
});
