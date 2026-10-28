import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canIssueQuoteLink,
  deriveQuoteBudgetStatus,
  valuationLockedByStatus,
  valuationNeedsExplicitRevision,
} from './quote-status.ts';

describe('deriveQuoteBudgetStatus', () => {
  const base = {
    source: 'public_qr',
    linesValuedAt: null as string | null,
    customerAcceptedAt: null as string | null,
    customerRejectedAt: null as string | null,
    quoteExpiresAt: null as string | null,
    quoteLegacyTotalOnly: false,
  };

  it('pending_valuation sin lines_valued', () => {
    assert.equal(deriveQuoteBudgetStatus(base), 'pending_valuation');
  });

  it('pending_acceptance tras valorar', () => {
    assert.equal(
      deriveQuoteBudgetStatus({
        ...base,
        linesValuedAt: '2026-10-26T12:00:00.000Z',
        quoteExpiresAt: '2099-01-01T00:00:00.000Z',
      }),
      'pending_acceptance'
    );
  });

  it('expired si quote_expires_at pasado', () => {
    assert.equal(
      deriveQuoteBudgetStatus({
        ...base,
        linesValuedAt: '2026-10-26T12:00:00.000Z',
        quoteExpiresAt: '2020-01-01T00:00:00.000Z',
        nowMs: Date.parse('2026-10-26T12:00:00.000Z'),
      }),
      'expired'
    );
  });

  it('accepted / rejected prevalecen sobre caducidad', () => {
    assert.equal(
      deriveQuoteBudgetStatus({
        ...base,
        linesValuedAt: '2026-10-26T12:00:00.000Z',
        customerAcceptedAt: '2026-10-26T13:00:00.000Z',
        quoteExpiresAt: '2020-01-01T00:00:00.000Z',
      }),
      'accepted'
    );
    assert.equal(
      deriveQuoteBudgetStatus({
        ...base,
        linesValuedAt: '2026-10-26T12:00:00.000Z',
        customerRejectedAt: '2026-10-26T13:00:00.000Z',
      }),
      'rejected'
    );
  });

  it('legacy y no public_qr', () => {
    assert.equal(
      deriveQuoteBudgetStatus({ ...base, quoteLegacyTotalOnly: true }),
      'legacy'
    );
    assert.equal(
      deriveQuoteBudgetStatus({ ...base, source: 'kiosk' }),
      'not_applicable'
    );
  });
});

describe('canIssueQuoteLink', () => {
  it('solo pendiente de aceptación vigente', () => {
    assert.equal(
      canIssueQuoteLink({
        source: 'public_qr',
        linesValuedAt: '2026-10-26T12:00:00.000Z',
        customerAcceptedAt: null,
        quoteExpiresAt: '2099-01-01T00:00:00.000Z',
        status: 'request_pending',
      }),
      true
    );
    assert.equal(
      canIssueQuoteLink({
        source: 'public_qr',
        linesValuedAt: '2026-10-26T12:00:00.000Z',
        customerAcceptedAt: '2026-10-26T13:00:00.000Z',
        quoteExpiresAt: '2099-01-01T00:00:00.000Z',
        status: 'request_pending',
      }),
      false
    );
  });
});

describe('revision / lock helpers', () => {
  it('needs revision tras accept en request_pending', () => {
    assert.equal(
      valuationNeedsExplicitRevision({
        source: 'public_qr',
        customerAcceptedAt: 'x',
        status: 'request_pending',
      }),
      true
    );
  });
  it('locked en preparing/ready', () => {
    assert.equal(valuationLockedByStatus('preparing'), true);
    assert.equal(valuationLockedByStatus('request_pending'), false);
  });
});
