import { createClient } from '@/lib/supabase/server';
import { hasPlatformPermission } from '@/lib/auth/platform';
import type { CommercialQuoteSnapshot } from '@/lib/commercial/quote-types';

import { composeContractPreviewFromQuote } from './compose-preview.ts';
import type {
  CommercialContractListItem,
  ContractEmailSendEntry,
  ContractLifecycleStatus,
  ContractPreviewModel,
  ContractTemplateKey,
  LegalApprovalStatus,
} from './types.ts';

export async function canManageCommercialContracts(): Promise<boolean> {
  const direct = await hasPlatformPermission(
    'platform.commercial_contracts.manage'
  );
  if (direct.ok) return true;
  const quotes = await hasPlatformPermission(
    'platform.commercial_quotes.manage'
  );
  return quotes.ok;
}

function mapSnapshot(raw: unknown): CommercialQuoteSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as CommercialQuoteSnapshot;
  if (s.v !== 1) return null;
  return s;
}

function mapEmailSends(raw: unknown): ContractEmailSendEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is ContractEmailSendEntry =>
      e != null &&
      typeof e === 'object' &&
      typeof (e as ContractEmailSendEntry).at === 'string' &&
      typeof (e as ContractEmailSendEntry).to === 'string'
  );
}

export async function listCommercialContracts(): Promise<
  | { ok: true; rows: CommercialContractListItem[] }
  | { ok: false; error: string }
> {
  if (!(await canManageCommercialContracts())) {
    return { ok: false, error: 'Sin permiso para gestionar contratos.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('commercial_contracts')
    .select(
      `
      id,
      quote_id,
      quote_reference_code,
      pharmacy_id,
      template_key,
      lifecycle_status,
      legal_approval_snapshot,
      missing_fields,
      contact_email,
      email_sends,
      created_at,
      updated_at,
      signed_at,
      pharmacy:pharmacies ( id, name )
    `
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[contracts] list', error.code, error.message);
    return {
      ok: false,
      error:
        error.code === '42P01' || error.message?.includes('does not exist')
          ? 'La tabla de contratos aún no está aplicada (migración 069).'
          : 'No se han podido cargar los contratos.',
    };
  }

  const rows: CommercialContractListItem[] = (data ?? []).map((row) => {
    const pharmacyJoin = row.pharmacy as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
    const pharmacy = Array.isArray(pharmacyJoin)
      ? pharmacyJoin[0]
      : pharmacyJoin;
    const missingRaw = row.missing_fields;
    const missingFields = Array.isArray(missingRaw)
      ? missingRaw.map(String)
      : [];

    return {
      id: row.id as string,
      quoteId: row.quote_id as string,
      quoteReference: (row.quote_reference_code as string | null) ?? null,
      pharmacyId: (row.pharmacy_id as string | null) ?? null,
      pharmacyName: pharmacy?.name ?? null,
      templateKey: row.template_key as ContractTemplateKey,
      lifecycleStatus: row.lifecycle_status as ContractLifecycleStatus,
      legalApprovalSnapshot:
        row.legal_approval_snapshot as LegalApprovalStatus,
      missingFields,
      contactEmail: (row.contact_email as string | null) ?? null,
      emailSends: mapEmailSends(row.email_sends),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      signedAt: (row.signed_at as string | null) ?? null,
    };
  });

  return { ok: true, rows };
}

export async function loadAcceptedQuoteForContract(quoteId: string): Promise<
  | {
      ok: true;
      quote: {
        id: string;
        referenceCode: string | null;
        status: string;
        pharmacyId: string | null;
        snapshot: CommercialQuoteSnapshot;
      };
      pharmacy: {
        id: string;
        name: string;
        legal_name: string | null;
        cif: string | null;
        address_line: string | null;
        postal_code: string | null;
        city: string | null;
        province: string | null;
        country: string | null;
      } | null;
    }
  | { ok: false; error: string }
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('commercial_quotes')
    .select(
      `
      id,
      reference_code,
      status,
      pharmacy_id,
      snapshot,
      pharmacy:pharmacies (
        id, name, legal_name, cif, address_line, postal_code, city, province, country
      )
    `
    )
    .eq('id', quoteId)
    .maybeSingle();

  if (error || !data) {
    console.error('[contracts] quote', error?.code, error?.message);
    return { ok: false, error: 'Presupuesto no encontrado.' };
  }

  const snapshot = mapSnapshot(data.snapshot);
  if (!snapshot) {
    return { ok: false, error: 'Snapshot del presupuesto no válido.' };
  }

  const pharmacyJoin = data.pharmacy as
    | {
        id: string;
        name: string;
        legal_name: string | null;
        cif: string | null;
        address_line: string | null;
        postal_code: string | null;
        city: string | null;
        province: string | null;
        country: string | null;
      }
    | {
        id: string;
        name: string;
        legal_name: string | null;
        cif: string | null;
        address_line: string | null;
        postal_code: string | null;
        city: string | null;
        province: string | null;
        country: string | null;
      }[]
    | null;
  const pharmacy = Array.isArray(pharmacyJoin)
    ? pharmacyJoin[0]
    : pharmacyJoin;

  return {
    ok: true,
    quote: {
      id: data.id as string,
      referenceCode: (data.reference_code as string | null) ?? null,
      status: data.status as string,
      pharmacyId: (data.pharmacy_id as string | null) ?? null,
      snapshot,
    },
    pharmacy: pharmacy
      ? {
          id: pharmacy.id,
          name: pharmacy.name,
          legal_name: pharmacy.legal_name,
          cif: pharmacy.cif,
          address_line: pharmacy.address_line,
          postal_code: pharmacy.postal_code,
          city: pharmacy.city,
          province: pharmacy.province,
          country: pharmacy.country,
        }
      : null,
  };
}

export async function previewContractForQuote(input: {
  quoteId: string;
  pharmacySignerName?: string | null;
  pharmacySignerNif?: string | null;
  pharmacySignerTitle?: string | null;
  operational?: Record<string, string | null | undefined>;
}): Promise<
  { ok: true; preview: ContractPreviewModel } | { ok: false; error: string }
> {
  if (!(await canManageCommercialContracts())) {
    return { ok: false, error: 'Sin permiso para gestionar contratos.' };
  }

  const loaded = await loadAcceptedQuoteForContract(input.quoteId);
  if (!loaded.ok) return loaded;

  const preview = await composeContractPreviewFromQuote({
    quoteId: loaded.quote.id,
    quoteReference: loaded.quote.referenceCode,
    quoteStatus: loaded.quote.status,
    snapshot: loaded.quote.snapshot,
    pharmacy: loaded.pharmacy,
    pharmacySignerName: input.pharmacySignerName,
    pharmacySignerNif: input.pharmacySignerNif,
    pharmacySignerTitle: input.pharmacySignerTitle,
    operational: input.operational,
  });

  return { ok: true, preview };
}

/** Presupuestos aceptados elegibles para contrato (con o sin borrador ya creado). */
export async function listAcceptedQuotesForContracts(): Promise<
  | {
      ok: true;
      quotes: Array<{
        id: string;
        referenceCode: string | null;
        pharmacyName: string | null;
        planName: string | null;
        kioskCount: number;
        contactEmail: string | null;
      }>;
    }
  | { ok: false; error: string }
> {
  if (!(await canManageCommercialContracts())) {
    return { ok: false, error: 'Sin permiso.' };
  }

  const supabase = createClient();
  const { data: quotes, error } = await supabase
    .from('commercial_quotes')
    .select(
      `
      id,
      reference_code,
      status,
      kiosk_count,
      snapshot,
      pharmacy:pharmacies ( name )
    `
    )
    .eq('status', 'accepted')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) {
    return {
      ok: false,
      error: 'No se han podido cargar presupuestos aceptados.',
    };
  }

  const rows = (quotes ?? []).map((q) => {
    const snap = mapSnapshot(q.snapshot);
    const pharmacyJoin = q.pharmacy as
      | { name: string }
      | { name: string }[]
      | null;
    const pharmacy = Array.isArray(pharmacyJoin)
      ? pharmacyJoin[0]
      : pharmacyJoin;
    return {
      id: q.id as string,
      referenceCode: (q.reference_code as string | null) ?? null,
      pharmacyName:
        pharmacy?.name ?? snap?.pharmacyName ?? snap?.clientName ?? null,
      planName: snap?.planName ?? null,
      kioskCount: Number(q.kiosk_count ?? snap?.kioskCount ?? 0),
      contactEmail: snap?.contactEmail ?? null,
    };
  });

  return { ok: true, quotes: rows };
}
