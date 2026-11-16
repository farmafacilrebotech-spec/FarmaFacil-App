import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildContractPreview } from './build-preview.ts';
import { buildContractPdfBytes, contractPdfFilename } from './pdf.ts';
import type { CommercialQuoteSnapshot } from '../commercial/quote-types.ts';
import type { ContractPartyFarmafacil, ContractPartyPharmacy } from './types.ts';

const snapshot: CommercialQuoteSnapshot = {
  v: 1,
  clientName: 'Farmacia Demo',
  contactName: 'Ana',
  contactEmail: 'ana@example.com',
  pharmacyId: 'ph-1',
  pharmacyName: 'Farmacia Demo',
  planId: 'personalized',
  planName: 'Catálogo',
  interval: 'monthly',
  cohortPricing: 'normal',
  kioskCount: 0,
  onsiteInstallIncluded: false,
  includeAppSignupFee: true,
  appSignupFeeCents: 19000,
  hardwareUnitCents: 0,
  hardwareCents: 0,
  kioskLicenseMonthlyCents: 0,
  vatBps: 2100,
  saasAnnualDiscountBps: 0,
  notes: null,
  validUntil: null,
  commercialConditions: [],
  breakdown: {
    oneTimeNetCents: 19000,
    oneTimeVatCents: 3990,
    oneTimeGrossCents: 22990,
    planRecurringCents: 7900,
    kioskLicenseRecurringCents: 0,
    recurringNetCents: 7900,
    recurringVatCents: 1659,
    recurringGrossCents: 9559,
    firstYearSubscriptionCents: 94800,
    firstYearNetCents: 113800,
    firstYearVatCents: 23898,
    firstYearGrossCents: 137698,
    laterYearsRecurringNetCents: 7900,
  },
};

const ffPending: ContractPartyFarmafacil = {
  legalName: 'ReBoTech Solutions, S.L.',
  cif: null,
  address: null,
  representativeName: null,
  representativeNif: null,
  representativeTitle: null,
  entityConfirmed: false,
};

const pharmacy: ContractPartyPharmacy = {
  pharmacyId: 'ph-1',
  displayName: 'Farmacia Demo',
  legalName: 'Farmacia Demo S.L.',
  cif: 'B87654321',
  address: 'Calle Mayor 1',
  representativeName: 'Ana',
  representativeNif: '1',
  representativeTitle: 'Titular',
  contactEmail: 'ana@example.com',
  contactName: 'Ana',
};

describe('buildContractPdfBytes', () => {
  it('genera PDF de borrador y rechaza firmable con pendientes', async () => {
    const preview = buildContractPreview({
      modality: 'catalog',
      legalApproval: 'draft_pending_legal_review',
      quoteId: 'q1',
      quoteReference: 'PQ-1',
      quoteStatus: 'accepted',
      snapshot,
      farmafacil: ffPending,
      pharmacy,
    });

    const draft = await buildContractPdfBytes(preview, { signable: false });
    assert.ok(draft.byteLength > 500);
    assert.match(contractPdfFilename(preview), /BORRADOR/);

    await assert.rejects(
      () => buildContractPdfBytes(preview, { signable: true }),
      /firmable/i
    );
  });
});
