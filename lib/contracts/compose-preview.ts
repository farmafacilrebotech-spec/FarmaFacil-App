import type { CommercialQuoteSnapshot } from '../commercial/quote-types.ts';

import { buildContractPreview } from './build-preview.ts';
import { loadFarmafacilParty, buildPharmacyParty } from './party-data.ts';
import { selectContractTemplateKey } from './select-template.ts';
import {
  loadContractsStatus,
  loadLegalApprovalStatus,
} from './template-loader.ts';
import type { ContractPreviewModel } from './types.ts';

export async function composeContractPreviewFromQuote(input: {
  quoteId: string;
  quoteReference: string | null;
  quoteStatus: string;
  snapshot: CommercialQuoteSnapshot;
  pharmacy?: {
    id?: string | null;
    name?: string | null;
    legal_name?: string | null;
    cif?: string | null;
    address_line?: string | null;
    postal_code?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
  } | null;
  pharmacySignerName?: string | null;
  pharmacySignerNif?: string | null;
  pharmacySignerTitle?: string | null;
  operational?: Record<string, string | null | undefined>;
  cwd?: string;
}): Promise<ContractPreviewModel> {
  const snap = input.snapshot;
  const modality = selectContractTemplateKey({
    planId: snap.planId,
    kioskCount: snap.kioskCount,
  });

  const [status, legalApproval] = await Promise.all([
    loadContractsStatus(input.cwd),
    loadLegalApprovalStatus(input.cwd),
  ]);

  const pharmacyCif =
    input.pharmacy?.cif?.trim() ||
    (snap as { pharmacyCif?: string | null }).pharmacyCif ||
    null;

  const pharmacy = buildPharmacyParty({
    pharmacyId: input.pharmacy?.id ?? snap.pharmacyId,
    name: input.pharmacy?.name ?? snap.pharmacyName ?? snap.clientName,
    legalName: input.pharmacy?.legal_name ?? snap.pharmacyName ?? snap.clientName,
    cif: pharmacyCif,
    addressLine: input.pharmacy?.address_line,
    postalCode: input.pharmacy?.postal_code,
    city: input.pharmacy?.city,
    province: input.pharmacy?.province,
    country: input.pharmacy?.country,
    representativeName: input.pharmacySignerName,
    representativeNif: input.pharmacySignerNif,
    representativeTitle: input.pharmacySignerTitle,
    contactEmail: snap.contactEmail,
    contactName: snap.contactName,
  });

  const farmafacil = loadFarmafacilParty({ rebotech: status.rebotech });

  return buildContractPreview({
    modality,
    legalApproval,
    quoteId: input.quoteId,
    quoteReference: input.quoteReference,
    quoteStatus: input.quoteStatus,
    snapshot: snap,
    farmafacil,
    pharmacy,
    operational: input.operational,
  });
}
