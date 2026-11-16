'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentProfile } from '@/lib/auth/platform';
import { createClient } from '@/lib/supabase/server';
import { composeContractPreviewFromQuote } from '@/lib/contracts/compose-preview';
import { buildContractPdfBytes, contractPdfFilename } from '@/lib/contracts/pdf';
import {
  canManageCommercialContracts,
  loadAcceptedQuoteForContract,
  previewContractForQuote,
} from '@/lib/contracts/queries';
import type {
  ContractEmailSendEntry,
  ContractPreviewModel,
} from '@/lib/contracts/types';

export type ContractPrepareInput = {
  quoteId: string;
  pharmacySignerName?: string;
  pharmacySignerNif?: string;
  pharmacySignerTitle?: string;
  operational?: Record<string, string | null | undefined>;
};

export async function getContractEmailSendReadiness(): Promise<{
  ready: boolean;
  missing: string[];
}> {
  const missing: string[] = [];
  if (!process.env.RESEND_API_KEY?.trim()) missing.push('RESEND_API_KEY');
  if (!process.env.EMAIL_FROM?.trim()) missing.push('EMAIL_FROM');
  return { ready: missing.length === 0, missing };
}

export async function previewContractAction(
  input: ContractPrepareInput
): Promise<
  { ok: true; preview: ContractPreviewModel } | { ok: false; error: string }
> {
  return previewContractForQuote(input);
}

/**
 * Guarda/actualiza borrador aunque ReBoTech no esté constituida.
 * No firma ni activa servicio.
 */
export async function upsertContractDraftAction(
  input: ContractPrepareInput
): Promise<{ ok: true; contractId: string } | { ok: false; error: string }> {
  if (!(await canManageCommercialContracts())) {
    return { ok: false, error: 'Sin permiso para gestionar contratos.' };
  }

  const loaded = await loadAcceptedQuoteForContract(input.quoteId);
  if (!loaded.ok) return loaded;
  if (loaded.quote.status !== 'accepted') {
    return {
      ok: false,
      error: 'Solo se puede crear contrato desde un presupuesto aceptado.',
    };
  }

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

  const { profile } = await getCurrentProfile();
  const supabase = createClient();

  const payload = {
    quote_id: loaded.quote.id,
    pharmacy_id: loaded.quote.pharmacyId,
    template_key: preview.templateKey,
    lifecycle_status: 'draft',
    legal_approval_snapshot: preview.legalApproval,
    quote_reference_code: loaded.quote.referenceCode,
    pharmacy_signer_name: input.pharmacySignerName?.trim() || null,
    pharmacy_signer_nif: input.pharmacySignerNif?.trim() || null,
    contact_email: preview.pharmacy.contactEmail,
    missing_fields: preview.missingFields.map((m) => m.key),
    filled_snapshot: {
      kind: 'draft',
      masterTemplateVersion: preview.masterTemplateVersion,
      templateKey: preview.templateKey,
      amounts: preview.amounts,
      farmafacil: preview.farmafacil,
      pharmacy: preview.pharmacy,
      operational: input.operational ?? {},
      blockers: preview.blockers,
      unresolvedMarkers: preview.unresolvedMarkers,
      readyForSignature: preview.readyForSignature,
      rebotechEntityConfirmed: preview.rebotechEntityConfirmed,
      snapshotVersion: preview.snapshotVersion,
      quoteReference: preview.quoteReference,
      quoteId: preview.quoteId,
    },
    updated_by: profile?.id ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from('commercial_contracts')
    .select('id, lifecycle_status, signed_at')
    .eq('quote_id', loaded.quote.id)
    .maybeSingle();

  if (existing?.signed_at) {
    return {
      ok: false,
      error: 'El contrato ya está firmado; no se puede sobrescribir el borrador.',
    };
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('commercial_contracts')
      .update({
        ...payload,
        lifecycle_status:
          existing.lifecycle_status === 'signed'
            ? 'signed'
            : 'preview_ready',
      })
      .eq('id', existing.id);
    if (error) {
      console.error('[contracts] update', error.code, error.message);
      return { ok: false, error: 'No se ha podido actualizar el contrato.' };
    }
    revalidatePath('/contratos');
    return { ok: true, contractId: existing.id as string };
  }

  const { data: inserted, error } = await supabase
    .from('commercial_contracts')
    .insert({
      ...payload,
      lifecycle_status: 'preview_ready',
      created_by: profile?.id ?? null,
      email_sends: [],
      signed_at: null,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    console.error('[contracts] insert', error?.code, error?.message);
    return {
      ok: false,
      error:
        error?.code === '42P01'
          ? 'Migración 069 no aplicada: tabla commercial_contracts inexistente.'
          : 'No se ha podido crear el borrador de contrato.',
    };
  }

  revalidatePath('/contratos');
  return { ok: true, contractId: inserted.id as string };
}

/**
 * Descarga PDF de borrador (siempre marcado BORRADOR si no está listo).
 * No emite PDF firmable con campos pendientes.
 */
export async function downloadContractPdfAction(
  input: ContractPrepareInput & { signable?: boolean }
): Promise<
  | {
      ok: true;
      base64: string;
      filename: string;
      readyForSignature: boolean;
      isDraft: boolean;
    }
  | { ok: false; error: string }
> {
  const previewResult = await previewContractForQuote(input);
  if (!previewResult.ok) return previewResult;

  const preview = previewResult.preview;
  if (!preview.canGenerateDraftPdf) {
    return {
      ok: false,
      error:
        preview.blockers[0] ??
        'No se puede generar el PDF de borrador.',
    };
  }

  const wantSignable = input.signable === true;
  if (wantSignable && !preview.canGenerateSignablePdf) {
    return {
      ok: false,
      error:
        'No se genera PDF firmable: faltan datos legales de ReBoTech, aprobación jurídica o campos/marcadores pendientes. Usa el PDF de borrador.',
    };
  }

  try {
    const bytes = await buildContractPdfBytes(preview, {
      signable: wantSignable && preview.canGenerateSignablePdf,
    });
    const base64 = Buffer.from(bytes).toString('base64');
    const isDraft = !(wantSignable && preview.canGenerateSignablePdf);
    const filename = contractPdfFilename(preview, {
      signable: !isDraft,
    });

    const supabase = createClient();
    await supabase
      .from('commercial_contracts')
      .update({
        lifecycle_status: isDraft ? 'pdf_generated' : 'awaiting_signature',
        updated_at: new Date().toISOString(),
      })
      .eq('quote_id', input.quoteId);

    revalidatePath('/contratos');
    return {
      ok: true,
      base64,
      filename,
      readyForSignature: preview.readyForSignature,
      isDraft,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error al generar el PDF.',
    };
  }
}

/**
 * Envío por correo: estado independiente.
 * No marca «enviado» si la plataforma no está configurada o el proveedor no confirma.
 * Puede adjuntar borrador; no implica contrato definitivo ni firma.
 */
export async function sendContractEmailAction(
  input: ContractPrepareInput
): Promise<
  | { ok: true; providerId?: string }
  | { ok: false; error: string; code?: string }
> {
  if (!(await canManageCommercialContracts())) {
    return { ok: false, error: 'Sin permiso.', code: 'forbidden' };
  }

  const readiness = await getContractEmailSendReadiness();
  if (!readiness.ready) {
    await appendContractEmailSend(input.quoteId, {
      at: new Date().toISOString(),
      to: '',
      status: 'not_configured',
      error: `Falta configurar ${readiness.missing.join(', ')}`,
    });
    return {
      ok: false,
      code: 'not_configured',
      error: `Envío no disponible: falta configurar ${readiness.missing.join(', ')}. No se ha enviado ningún correo ni se marca como enviado.`,
    };
  }

  const previewResult = await previewContractForQuote(input);
  if (!previewResult.ok) return previewResult;

  const preview = previewResult.preview;
  const to = preview.pharmacy.contactEmail?.trim();
  if (!to) {
    return {
      ok: false,
      error: 'Falta el email de contacto confirmado del presupuesto.',
    };
  }
  if (!preview.canGenerateDraftPdf) {
    return {
      ok: false,
      error: 'No se puede enviar: el PDF de borrador no está disponible.',
    };
  }

  // No enviar como «definitivo» si ReBoTech/jurídico/marcadores pendientes.
  const sendAsDraft = !preview.readyForSignature;

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildContractPdfBytes(preview, { signable: false });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error al generar el PDF.',
    };
  }

  const filename = contractPdfFilename(preview, { signable: false });
  const subject = sendAsDraft
    ? `BORRADOR contrato FarmaFácil — ${preview.quoteReference ?? preview.quoteId}`
    : `Contrato FarmaFácil — ${preview.quoteReference ?? preview.quoteId}`;
  const draftNote = sendAsDraft
    ? 'Este documento es un BORRADOR. No es un contrato definitivo ni firmable. Pendiente de datos legales de ReBoTech y/o revisión jurídica y/o campos obligatorios.'
    : 'La firma y la activación del servicio son pasos independientes.';

  const apiKey = process.env.RESEND_API_KEY!.trim();
  const from = process.env.EMAIL_FROM!.trim();

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: [
          'Adjuntamos el contrato FarmaFácil generado desde el presupuesto aceptado.',
          `Referencia presupuesto: ${preview.quoteReference ?? preview.quoteId}`,
          `Snapshot v${preview.snapshotVersion}`,
          `Plantilla: ${preview.masterTemplateVersion} · ${preview.templateLabel}`,
          draftNote,
          'La aceptación del presupuesto no firma el contrato ni activa el servicio.',
        ].join('\n'),
        html: `<p>Adjuntamos el contrato FarmaFácil generado desde el presupuesto aceptado.</p>
<p>Referencia presupuesto: <strong>${preview.quoteReference ?? preview.quoteId}</strong><br/>
Snapshot v${preview.snapshotVersion}<br/>
Plantilla: ${preview.masterTemplateVersion} · ${preview.templateLabel}</p>
<p><strong>${draftNote}</strong></p>
<p>La aceptación del presupuesto no firma el contrato ni activa el servicio.</p>`,
        attachments: [
          {
            filename,
            content: Buffer.from(pdfBytes).toString('base64'),
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[contracts] email send failed', res.status, body);
      await appendContractEmailSend(input.quoteId, {
        at: new Date().toISOString(),
        to,
        status: 'failed',
        error: 'El proveedor de email rechazó el envío.',
      });
      return {
        ok: false,
        code: 'send_failed',
        error: 'No se ha podido enviar el email. No se registra como enviado.',
      };
    }

    const json = (await res.json().catch(() => null)) as { id?: string } | null;
    const providerId = json?.id;
    if (!providerId) {
      await appendContractEmailSend(input.quoteId, {
        at: new Date().toISOString(),
        to,
        status: 'failed',
        error: 'El proveedor no devolvió id de envío.',
      });
      return {
        ok: false,
        code: 'send_failed',
        error: 'El proveedor no confirmó el envío. No se marca como enviado.',
      };
    }

    await appendContractEmailSend(input.quoteId, {
      at: new Date().toISOString(),
      to,
      status: 'sent',
      providerId,
    });

    const supabase = createClient();
    await supabase
      .from('commercial_contracts')
      .update({
        lifecycle_status: 'emailed',
        updated_at: new Date().toISOString(),
      })
      .eq('quote_id', input.quoteId);

    revalidatePath('/contratos');
    return { ok: true, providerId };
  } catch (err) {
    console.error('[contracts] email fetch', err);
    await appendContractEmailSend(input.quoteId, {
      at: new Date().toISOString(),
      to,
      status: 'failed',
      error: 'Error de red al contactar el proveedor de email.',
    });
    return {
      ok: false,
      code: 'send_failed',
      error: 'No se ha podido enviar el email. No se marca como enviado.',
    };
  }
}

async function appendContractEmailSend(
  quoteId: string,
  entry: ContractEmailSendEntry
) {
  const supabase = createClient();
  const { data } = await supabase
    .from('commercial_contracts')
    .select('id, email_sends')
    .eq('quote_id', quoteId)
    .maybeSingle();
  if (!data?.id) return;
  const prev = Array.isArray(data.email_sends) ? data.email_sends : [];
  await supabase
    .from('commercial_contracts')
    .update({
      email_sends: [...prev, entry],
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.id);
}

/**
 * Firma explícita — bloqueada si ReBoTech no confirmada, plantilla no aprobada
 * o quedan campos/marcadores pendientes. No activa el servicio.
 */
export async function markContractSignedAction(input: {
  contractId: string;
  quoteId?: string;
  pharmacySignerName?: string;
  pharmacySignerNif?: string;
  pharmacySignerTitle?: string;
  operational?: Record<string, string | null | undefined>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await canManageCommercialContracts())) {
    return { ok: false, error: 'Sin permiso.' };
  }

  const supabase = createClient();
  const { data: row } = await supabase
    .from('commercial_contracts')
    .select('id, quote_id, pharmacy_signer_name, pharmacy_signer_nif, filled_snapshot')
    .eq('id', input.contractId)
    .maybeSingle();

  if (!row?.id) {
    return { ok: false, error: 'Contrato no encontrado.' };
  }

  const quoteId = input.quoteId ?? (row.quote_id as string);
  const snap = (row.filled_snapshot ?? {}) as {
    operational?: Record<string, string | null | undefined>;
  };

  const previewResult = await previewContractForQuote({
    quoteId,
    pharmacySignerName:
      input.pharmacySignerName ??
      (row.pharmacy_signer_name as string | null) ??
      undefined,
    pharmacySignerNif:
      input.pharmacySignerNif ??
      (row.pharmacy_signer_nif as string | null) ??
      undefined,
    pharmacySignerTitle: input.pharmacySignerTitle,
    operational: input.operational ?? snap.operational,
  });

  if (!previewResult.ok) return previewResult;
  const preview = previewResult.preview;

  if (!preview.canMarkSigned || !preview.readyForSignature) {
    const detail =
      preview.blockers.slice(0, 5).join(' · ') ||
      'Faltan requisitos de firma.';
    return {
      ok: false,
      error: `Firma bloqueada. ${detail}`,
    };
  }

  const { error } = await supabase
    .from('commercial_contracts')
    .update({
      lifecycle_status: 'signed',
      signed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.contractId);

  if (error) {
    return { ok: false, error: 'No se ha podido registrar la firma.' };
  }

  // No activa el servicio automáticamente.
  revalidatePath('/contratos');
  return { ok: true };
}
