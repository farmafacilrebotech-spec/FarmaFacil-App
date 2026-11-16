import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CommercialQuoteSnapshot } from '../commercial/quote-types.ts';
import { buildContractPreview } from './build-preview.ts';
import type { ContractPartyFarmafacil, ContractPartyPharmacy } from './types.ts';

function sampleSnapshot(
  overrides: Partial<CommercialQuoteSnapshot> = {}
): CommercialQuoteSnapshot {
  return {
    v: 1,
    clientName: 'Farmacia Demo',
    contactName: 'Ana',
    contactEmail: 'ana@example.com',
    pharmacyId: 'ph-1',
    pharmacyName: 'Farmacia Demo',
    planId: 'general',
    planName: 'General',
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
      planRecurringCents: 9750,
      kioskLicenseRecurringCents: 0,
      recurringNetCents: 9750,
      recurringVatCents: 2048,
      recurringGrossCents: 11798,
      firstYearSubscriptionCents: 117000,
      firstYearNetCents: 136000,
      firstYearVatCents: 28560,
      firstYearGrossCents: 164560,
      laterYearsRecurringNetCents: 9750,
    },
    ...overrides,
  };
}

const ffPending: ContractPartyFarmafacil = {
  legalName: 'ReBoTech Solutions, S.L.',
  cif: null,
  address: null,
  representativeName: null,
  representativeNif: null,
  representativeTitle: null,
  entityConfirmed: false,
};

const ffComplete: ContractPartyFarmafacil = {
  legalName: 'ReBoTech Solutions, S.L.',
  cif: 'B12345678',
  address: 'Calle Ejemplo 1, Valencia',
  representativeName: 'Nombre Representante',
  representativeNif: '12345678Z',
  representativeTitle: 'Administradora',
  entityConfirmed: true,
};

const pharmacyComplete: ContractPartyPharmacy = {
  pharmacyId: 'ph-1',
  displayName: 'Farmacia Demo',
  legalName: 'Farmacia Demo S.L.',
  cif: 'B87654321',
  address: 'Calle Mayor 1, Valencia',
  representativeName: 'Ana López',
  representativeNif: '12345678Z',
  representativeTitle: 'Titular',
  contactEmail: 'ana@example.com',
  contactName: 'Ana',
};

const operationalComplete: Record<string, string> = {
  DURACION_INICIAL_MESES: '12',
  RENOVACION_MESES: '12',
  PREAVISO_DIAS: '30',
  SUBSANACION_DIAS: '15',
  FECHA_ACTIVACION: 'pendiente de activación explícita',
  FORMA_PAGO_INICIAL: 'transferencia',
  DIA_CARGO: '1',
  SOPORTE_DETALLE: 'email soporte@farmafacil.solutions · L-V 9-18',
  canal: 'email',
};

describe('buildContractPreview — plantilla maestra', () => {
  it('permite borrador/preview con ReBoTech pendiente y bloquea firma', () => {
    const preview = buildContractPreview({
      modality: 'catalog',
      legalApproval: 'draft_pending_legal_review',
      quoteId: 'q1',
      quoteReference: 'PQ-1',
      quoteStatus: 'accepted',
      snapshot: sampleSnapshot(),
      farmafacil: ffPending,
      pharmacy: pharmacyComplete,
    });

    assert.equal(preview.isDraft, true);
    assert.equal(preview.readyForSignature, false);
    assert.equal(preview.canGenerateSignablePdf, false);
    assert.equal(preview.canGenerateDraftPdf, true);
    assert.ok(preview.filledBody.includes('BORRADOR') || preview.isDraft);
    assert.ok(
      preview.blockers.some((b) => /ReBoTech/i.test(b))
    );
    assert.ok(
      preview.blockers.some((b) => /aprobación jurídica/i.test(b))
    );
    assert.match(preview.filledBody, /97,50/);
    assert.match(preview.filledBody, /PQ-1/);
    assert.match(preview.filledBody, /snapshot v1|Versión del snapshot: 1/i);
    assert.equal(preview.masterTemplateVersion, 'FF-MARCO-v1');
  });

  it('no marca listo si quedan marcadores [completar antes de firma] o [canal]', () => {
    const preview = buildContractPreview({
      modality: 'catalog',
      legalApproval: 'approved',
      quoteId: 'q1',
      quoteReference: 'PQ-1',
      quoteStatus: 'accepted',
      snapshot: sampleSnapshot(),
      farmafacil: ffComplete,
      pharmacy: pharmacyComplete,
      // sin operational → marcadores literales
    });

    assert.equal(preview.readyForSignature, false);
    assert.ok(preview.unresolvedMarkers.length > 0);
    assert.ok(
      preview.unresolvedMarkers.some((m) =>
        /completar antes de firma|canal|DURACION/i.test(m)
      )
    );
  });

  it('listo para firmar solo con jurídico + ReBoTech + campos + sin marcadores', () => {
    const preview = buildContractPreview({
      modality: 'catalog',
      legalApproval: 'approved',
      quoteId: 'q1',
      quoteReference: 'PQ-99',
      quoteStatus: 'accepted',
      snapshot: sampleSnapshot(),
      farmafacil: ffComplete,
      pharmacy: pharmacyComplete,
      operational: operationalComplete,
    });

    if (preview.unresolvedMarkers.length > 0) {
      assert.fail(
        `Marcadores sin resolver: ${preview.unresolvedMarkers.join(', ')}`
      );
    }
    assert.equal(preview.readyForSignature, true);
    assert.equal(preview.canGenerateSignablePdf, true);
    assert.match(preview.filledBody, /Catálogo digital propio/);
    assert.doesNotMatch(preview.filledBody, /79 €\/mes/);
  });

  it('incluye cláusula de asistente en catalog-ai y kiosco en full-kiosk', () => {
    const ai = buildContractPreview({
      modality: 'catalog-ai',
      legalApproval: 'draft_pending_legal_review',
      quoteId: 'q1',
      quoteReference: 'PQ-1',
      quoteStatus: 'accepted',
      snapshot: sampleSnapshot({ planId: 'ai_personalized', planName: 'IA' }),
      farmafacil: ffPending,
      pharmacy: pharmacyComplete,
    });
    assert.match(ai.filledBody, /módulo de asistente/);

    const kiosk = buildContractPreview({
      modality: 'full-kiosk',
      legalApproval: 'draft_pending_legal_review',
      quoteId: 'q1',
      quoteReference: 'PQ-1',
      quoteStatus: 'accepted',
      snapshot: sampleSnapshot({ kioskCount: 1 }),
      farmafacil: ffPending,
      pharmacy: pharmacyComplete,
    });
    assert.match(kiosk.filledBody, /Kiosco y servicios opcionales/);
    assert.match(kiosk.filledBody, /propiedad del equipo permanece/);
  });

  it('aceptar presupuesto no implica readyForSignature', () => {
    const preview = buildContractPreview({
      modality: 'catalog',
      legalApproval: 'approved',
      quoteId: 'q1',
      quoteReference: 'PQ-1',
      quoteStatus: 'accepted',
      snapshot: sampleSnapshot(),
      farmafacil: { ...ffComplete, cif: null, entityConfirmed: false },
      pharmacy: { ...pharmacyComplete, representativeName: null },
    });
    assert.equal(preview.readyForSignature, false);
    assert.ok(preview.missingFields.some((m) => m.key === 'FF_CIF'));
    assert.ok(
      preview.missingFields.some((m) => m.key === 'FARMACIA_REPRESENTANTE')
    );
  });

  it('rechaza presupuestos no aceptados para firma', () => {
    const preview = buildContractPreview({
      modality: 'catalog',
      legalApproval: 'approved',
      quoteId: 'q1',
      quoteReference: 'PQ-1',
      quoteStatus: 'sent',
      snapshot: sampleSnapshot(),
      farmafacil: ffComplete,
      pharmacy: pharmacyComplete,
      operational: operationalComplete,
    });
    assert.equal(preview.readyForSignature, false);
    assert.equal(preview.canGenerateDraftPdf, false);
    assert.ok(preview.blockers.some((b) => /aceptado/i.test(b)));
  });
});
