import type {
  ContractPartyFarmafacil,
  ContractPartyPharmacy,
} from './types';

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export type RebotechStatusBlock = {
  entityConfirmed?: boolean;
  provisionalLegalName?: string | null;
  legalName?: string | null;
  cif?: string | null;
  address?: string | null;
  representativeName?: string | null;
  representativeNif?: string | null;
  representativeTitle?: string | null;
};

/**
 * Datos de ReBoTech / FarmaFácil.
 * No inventa CIF, domicilio ni representación. Solo usa STATUS + env confirmados.
 */
export function loadFarmafacilParty(input: {
  rebotech?: RebotechStatusBlock | null;
  env?: NodeJS.ProcessEnv;
}): ContractPartyFarmafacil {
  const env = input.env ?? process.env;
  const st = input.rebotech ?? {};

  const legalName =
    trimOrNull(env.FF_LEGAL_NAME) ??
    trimOrNull(st.legalName) ??
    trimOrNull(st.provisionalLegalName) ??
    'ReBoTech Solutions, S.L.';

  const cif = trimOrNull(env.FF_CIF) ?? trimOrNull(st.cif);
  const address = trimOrNull(env.FF_LEGAL_ADDRESS) ?? trimOrNull(st.address);
  const representativeName =
    trimOrNull(env.FF_REPRESENTATIVE_NAME) ??
    trimOrNull(st.representativeName);
  const representativeNif =
    trimOrNull(env.FF_REPRESENTATIVE_NIF) ?? trimOrNull(st.representativeNif);
  const representativeTitle =
    trimOrNull(env.FF_REPRESENTATIVE_TITLE) ??
    trimOrNull(st.representativeTitle);

  const envConfirmed = trimOrNull(env.FF_REBOTECH_LEGAL_CONFIRMED) === 'true';
  const statusConfirmed = st.entityConfirmed === true;
  const hasAllLegal =
    Boolean(cif) &&
    Boolean(address) &&
    Boolean(representativeName) &&
    Boolean(representativeNif) &&
    Boolean(representativeTitle) &&
    Boolean(trimOrNull(env.FF_LEGAL_NAME) ?? trimOrNull(st.legalName));

  return {
    legalName,
    cif,
    address,
    representativeName,
    representativeNif,
    representativeTitle,
    entityConfirmed: (envConfirmed || statusConfirmed) && hasAllLegal,
  };
}

export function buildPharmacyAddress(parts: {
  addressLine?: string | null;
  postalCode?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
}): string | null {
  const chunks = [
    trimOrNull(parts.addressLine),
    trimOrNull(parts.postalCode),
    trimOrNull(parts.city),
    trimOrNull(parts.province),
    trimOrNull(parts.country),
  ].filter(Boolean) as string[];
  if (chunks.length === 0) return null;
  return chunks.join(', ');
}

export function buildPharmacyParty(input: {
  pharmacyId?: string | null;
  name?: string | null;
  legalName?: string | null;
  cif?: string | null;
  addressLine?: string | null;
  postalCode?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  representativeName?: string | null;
  representativeNif?: string | null;
  representativeTitle?: string | null;
  contactEmail?: string | null;
  contactName?: string | null;
}): ContractPartyPharmacy {
  return {
    pharmacyId: trimOrNull(input.pharmacyId),
    displayName: trimOrNull(input.name),
    legalName: trimOrNull(input.legalName) ?? trimOrNull(input.name),
    cif: trimOrNull(input.cif),
    address: buildPharmacyAddress(input),
    representativeName: trimOrNull(input.representativeName),
    representativeNif: trimOrNull(input.representativeNif),
    representativeTitle: trimOrNull(input.representativeTitle),
    contactEmail: trimOrNull(input.contactEmail),
    contactName: trimOrNull(input.contactName),
  };
}
