import type { CommercialQuoteSnapshot } from '../commercial/quote-types';

import {
  MASTER_TEMPLATE_VERSION,
  composeMasterContractBody,
  findUnresolvedMarkers,
} from '../../legal/contracts/v1/master-template';
import { amountsFromAcceptedSnapshot } from './amounts-from-snapshot';
import type {
  ContractMissingField,
  ContractPartyFarmafacil,
  ContractPartyPharmacy,
  ContractPreviewModel,
  ContractTemplateKey,
  LegalApprovalStatus,
} from './types';
import { CONTRACT_TEMPLATE_LABELS } from './types';

function pushMissing(
  list: ContractMissingField[],
  key: string,
  label: string,
  required: boolean,
  reason: string,
  present: boolean,
  where?: string
) {
  if (present) return;
  list.push({ key, label, required, reason, where: where ?? null });
}

export function collectMissingFields(input: {
  farmafacil: ContractPartyFarmafacil;
  pharmacy: ContractPartyPharmacy;
  quoteReference: string | null;
  quoteAccepted: boolean;
  modality: ContractTemplateKey;
  operational?: Record<string, string | null | undefined>;
}): ContractMissingField[] {
  const missing: ContractMissingField[] = [];
  const { farmafacil: ff, pharmacy: ph } = input;
  const op = input.operational ?? {};

  pushMissing(
    missing,
    'REBOTECH_ENTITY',
    'Datos legales de ReBoTech confirmados',
    true,
    'ReBoTech aún no está constituida o faltan CIF, domicilio y representación confirmados en STATUS/env.',
    ff.entityConfirmed,
    'legal/contracts/STATUS.json o variables FF_*'
  );
  pushMissing(
    missing,
    'FF_CIF',
    'CIF de ReBoTech / FarmaFácil',
    true,
    'Configura FF_CIF / STATUS.rebotech.cif. No se inventa.',
    Boolean(ff.cif),
    'Configuración de plataforma (env / STATUS)'
  );
  pushMissing(
    missing,
    'FF_RAZON_SOCIAL_CONFIRMADA',
    'Razón social confirmada de ReBoTech',
    true,
    'Hasta la constitución, solo hay nombre provisional. Confirma FF_LEGAL_NAME o STATUS.rebotech.legalName.',
    Boolean(ff.entityConfirmed),
    'Configuración de plataforma (env / STATUS)'
  );
  pushMissing(
    missing,
    'FF_DOMICILIO',
    'Domicilio de ReBoTech',
    true,
    'Falta FF_LEGAL_ADDRESS / STATUS.rebotech.address.',
    Boolean(ff.address),
    'Configuración de plataforma (env / STATUS)'
  );
  pushMissing(
    missing,
    'FF_REPRESENTANTE',
    'Representante de ReBoTech',
    true,
    'Falta FF_REPRESENTATIVE_NAME.',
    Boolean(ff.representativeName),
    'Configuración de plataforma (env / STATUS)'
  );
  pushMissing(
    missing,
    'FF_REPRESENTANTE_NIF',
    'DNI/NIE del representante ReBoTech',
    true,
    'Falta FF_REPRESENTATIVE_NIF.',
    Boolean(ff.representativeNif),
    'Configuración de plataforma (env / STATUS)'
  );
  pushMissing(
    missing,
    'FF_CARGO_REPRESENTANTE',
    'Cargo del representante ReBoTech',
    true,
    'Falta FF_REPRESENTATIVE_TITLE.',
    Boolean(ff.representativeTitle),
    'Configuración de plataforma (env / STATUS)'
  );

  pushMissing(
    missing,
    'FARMACIA_RAZON_SOCIAL',
    'Nombre legal de la farmacia',
    true,
    'Completa legal_name (o name) en la ficha de farmacia.',
    Boolean(ph.legalName),
    'Ficha de farmacia → Datos generales'
  );
  pushMissing(
    missing,
    'FARMACIA_CIF',
    'CIF de la farmacia',
    true,
    'Completa el CIF en la ficha; no se inventa.',
    Boolean(ph.cif),
    'Ficha de farmacia → Datos generales'
  );
  pushMissing(
    missing,
    'FARMACIA_DOMICILIO',
    'Dirección de la farmacia',
    true,
    'Completa address_line / ciudad en la ficha.',
    Boolean(ph.address),
    'Ficha de farmacia → Datos generales'
  );
  pushMissing(
    missing,
    'FARMACIA_REPRESENTANTE',
    'Representante de la farmacia',
    true,
    'Indica el representante al preparar el contrato.',
    Boolean(ph.representativeName),
    'Pantalla Contratos (campo representante)'
  );
  pushMissing(
    missing,
    'FARMACIA_REPRESENTANTE_NIF',
    'NIF del representante de la farmacia',
    true,
    'Indica el NIF del representante al preparar el contrato.',
    Boolean(ph.representativeNif),
    'Pantalla Contratos (campo NIF)'
  );
  pushMissing(
    missing,
    'FARMACIA_CARGO',
    'Cargo del representante de la farmacia',
    true,
    'Indica el cargo/condición del firmante.',
    Boolean(ph.representativeTitle),
    'Pantalla Contratos (campo cargo)'
  );
  pushMissing(
    missing,
    'CONTACT_EMAIL',
    'Email de contacto confirmado',
    true,
    'El presupuesto debe tener contactEmail.',
    Boolean(ph.contactEmail),
    'Presupuesto comercial / ficha de contacto'
  );

  if (!input.quoteAccepted) {
    missing.push({
      key: 'QUOTE_ACCEPTED',
      label: 'Presupuesto aceptado',
      required: true,
      reason: 'Solo se genera contrato desde un presupuesto en estado accepted.',
      where: 'Tarifas → Presupuestos',
    });
  }

  if (!input.quoteReference) {
    missing.push({
      key: 'PRESUPUESTO_REF',
      label: 'Referencia de presupuesto',
      required: false,
      reason: 'Sin reference_code; se usará el id del presupuesto en el PDF.',
      where: 'Presupuesto comercial',
    });
  }

  const opsRequired: Array<{ key: string; label: string; where: string }> = [
    {
      key: 'DURACION_INICIAL_MESES',
      label: 'Duración inicial (meses)',
      where: 'Configuración de contrato / completar antes de firma',
    },
    {
      key: 'RENOVACION_MESES',
      label: 'Periodo de renovación (meses)',
      where: 'Configuración de contrato / completar antes de firma',
    },
    {
      key: 'PREAVISO_DIAS',
      label: 'Días de preaviso',
      where: 'Configuración de contrato / completar antes de firma',
    },
    {
      key: 'SUBSANACION_DIAS',
      label: 'Días para subsanar incumplimiento',
      where: 'Configuración de contrato / completar antes de firma',
    },
    {
      key: 'FECHA_ACTIVACION',
      label: 'Fecha de activación',
      where: 'Configuración de contrato (no se activa al aceptar presupuesto)',
    },
    {
      key: 'FORMA_PAGO_INICIAL',
      label: 'Forma de pago inicial',
      where: 'Configuración de contrato / completar antes de firma',
    },
    {
      key: 'DIA_CARGO',
      label: 'Día de cargo de domiciliación',
      where: 'Configuración de contrato / completar antes de firma',
    },
  ];

  for (const item of opsRequired) {
    pushMissing(
      missing,
      item.key,
      item.label,
      true,
      'Campo operativo pendiente: [completar antes de firma].',
      Boolean(op[item.key]?.toString().trim()),
      item.where
    );
  }

  // Marcadores literales del texto fuente (soporte) — no inventar contenido.
  pushMissing(
    missing,
    'SOPORTE_DETALLE',
    'Canales, horario y tiempos de soporte',
    true,
    'El texto fuente exige [completar antes de firma] en disponibilidad y soporte.',
    Boolean(op.SOPORTE_DETALLE?.toString().trim()),
    'Configuración de soporte / completar antes de firma'
  );
  pushMissing(
    missing,
    'canal',
    'Canal de comunicación de incidencias',
    true,
    'El texto fuente exige indicar el [canal] de incidencias.',
    Boolean(op.canal?.toString().trim() || op.CANAL_INCIDENCIAS?.toString().trim()),
    'Configuración de soporte / completar antes de firma'
  );

  if (input.modality === 'full-kiosk') {
    const kioskFields = [
      ['KIOSCO_MODELO', 'Modelo / referencia del kiosco'],
      ['KIOSCO_SERIE', 'Número de serie del kiosco'],
      ['KIOSCO_ESTADO', 'Estado y accesorios del kiosco'],
      ['KIOSCO_ENTREGA_UBICACION', 'Fecha de entrega y ubicación'],
      ['KIOSCO_DEVOLUCION_DIAS', 'Plazo de devolución del kiosco (días)'],
      ['KIOSCO_DEVOLUCION_LUGAR', 'Lugar de devolución del kiosk'],
    ] as const;
    for (const [key, label] of kioskFields) {
      pushMissing(
        missing,
        key,
        label,
        true,
        'Obligatorio en modalidad Completo + kiosco.',
        Boolean(op[key]?.toString().trim()),
        'Ficha de kiosco / completar antes de firma'
      );
    }
  }

  return missing;
}

export function buildFieldValues(input: {
  farmafacil: ContractPartyFarmafacil;
  pharmacy: ContractPartyPharmacy;
  amountsFormatted: Record<string, string>;
  contractDateLabel: string;
  operational?: Record<string, string | null | undefined>;
}): Record<string, string | null> {
  const ff = input.farmafacil;
  const ph = input.pharmacy;
  const op = input.operational ?? {};
  return {
    FF_RAZON_SOCIAL: ff.legalName,
    FF_CIF: ff.cif,
    FF_DOMICILIO: ff.address,
    FF_REPRESENTANTE: ff.representativeName,
    FF_CARGO_REPRESENTANTE: ff.representativeTitle,
    FF_REPRESENTANTE_NIF: ff.representativeNif,
    FARMACIA_RAZON_SOCIAL: ph.legalName,
    FARMACIA_NOMBRE: ph.displayName ?? ph.legalName,
    FARMACIA_CIF: ph.cif,
    FARMACIA_DOMICILIO: ph.address,
    FARMACIA_REPRESENTANTE: ph.representativeName,
    FARMACIA_REPRESENTANTE_NIF: ph.representativeNif,
    FARMACIA_CARGO: ph.representativeTitle,
    CONTACT_EMAIL: ph.contactEmail,
    CONTACT_NAME: ph.contactName,
    FECHA_CONTRATO: input.contractDateLabel,
    LUGAR_FECHA_FIRMA:
      op.LUGAR_FECHA_FIRMA?.toString() ?? input.contractDateLabel,
    FACTURACION_A:
      op.FACTURACION_A?.toString() ??
      ([ph.legalName, ph.cif, ph.address, ph.contactEmail]
        .filter(Boolean)
        .join(' / ') || null),
    ANEXO_ENCARGO_ESTADO:
      op.ANEXO_ENCARGO_ESTADO?.toString() ??
      'pendiente de completar y firmar antes de activar el servicio (documento independiente)',
    // Opcional: vacío tipográfico para no dejar marcador bloqueante
    OBSERVACIONES: op.OBSERVACIONES?.toString()?.trim() || '—',
    KIOSCO_PERSONALIZACION_MARCA:
      op.KIOSCO_PERSONALIZACION_MARCA?.toString()?.trim() ||
      'según ficha económica del presupuesto',
    DURACION_INICIAL_MESES: op.DURACION_INICIAL_MESES?.toString() ?? null,
    RENOVACION_MESES: op.RENOVACION_MESES?.toString() ?? null,
    PREAVISO_DIAS: op.PREAVISO_DIAS?.toString() ?? null,
    SUBSANACION_DIAS: op.SUBSANACION_DIAS?.toString() ?? null,
    FECHA_ACTIVACION: op.FECHA_ACTIVACION?.toString() ?? null,
    FORMA_PAGO_INICIAL: op.FORMA_PAGO_INICIAL?.toString() ?? null,
    DIA_CARGO: op.DIA_CARGO?.toString() ?? null,
    KIOSCO_MODELO: op.KIOSCO_MODELO?.toString() ?? null,
    KIOSCO_SERIE: op.KIOSCO_SERIE?.toString() ?? null,
    KIOSCO_ESTADO: op.KIOSCO_ESTADO?.toString() ?? null,
    KIOSCO_ENTREGA_UBICACION: op.KIOSCO_ENTREGA_UBICACION?.toString() ?? null,
    KIOSCO_DEVOLUCION_DIAS: op.KIOSCO_DEVOLUCION_DIAS?.toString() ?? null,
    KIOSCO_DEVOLUCION_LUGAR: op.KIOSCO_DEVOLUCION_LUGAR?.toString() ?? null,
    'completar antes de firma': op.SOPORTE_DETALLE?.toString() ?? null,
    canal:
      op.canal?.toString() ?? op.CANAL_INCIDENCIAS?.toString() ?? null,
    ...input.amountsFormatted,
  };
}

export function buildContractPreview(input: {
  modality: ContractTemplateKey;
  legalApproval: LegalApprovalStatus;
  quoteId: string;
  quoteReference: string | null;
  quoteStatus: string;
  snapshot: CommercialQuoteSnapshot;
  farmafacil: ContractPartyFarmafacil;
  pharmacy: ContractPartyPharmacy;
  operational?: Record<string, string | null | undefined>;
  contractDate?: Date;
}): ContractPreviewModel {
  const amounts = amountsFromAcceptedSnapshot({
    quoteId: input.quoteId,
    quoteReference: input.quoteReference,
    snapshot: input.snapshot,
  });

  const quoteAccepted = input.quoteStatus === 'accepted';
  const missingFields = collectMissingFields({
    farmafacil: input.farmafacil,
    pharmacy: input.pharmacy,
    quoteReference: input.quoteReference,
    quoteAccepted,
    modality: input.modality,
    operational: input.operational,
  });

  const requiredMissing = missingFields.filter((m) => m.required);
  const blockers: string[] = [];

  if (input.legalApproval !== 'approved') {
    blockers.push(
      'Plantilla maestra pendiente de revisión y aprobación jurídica. No está lista para firmar ni emitir como definitiva.'
    );
  }
  if (!input.farmafacil.entityConfirmed) {
    blockers.push(
      'Datos legales de ReBoTech no confirmados (constitución pendiente). Se permiten borradores y vista previa; se bloquean firma y emisión definitiva.'
    );
  }
  if (!quoteAccepted) {
    blockers.push('El presupuesto debe estar aceptado.');
  }
  for (const m of requiredMissing) {
    const where = m.where ? ` → ${m.where}` : '';
    blockers.push(`${m.label}: ${m.reason}${where}`);
  }

  const date = input.contractDate ?? new Date();
  const contractDateLabel = date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const values = buildFieldValues({
    farmafacil: input.farmafacil,
    pharmacy: input.pharmacy,
    amountsFormatted: amounts.formatted,
    contractDateLabel,
    operational: input.operational,
  });

  const filledBody = composeMasterContractBody({
    modality: input.modality,
    values,
  });
  const unresolvedMarkers = findUnresolvedMarkers(filledBody);
  if (unresolvedMarkers.length > 0) {
    blockers.push(
      `Quedan marcadores sin resolver: ${unresolvedMarkers.join(', ')}.`
    );
  }

  const readyForSignature =
    input.legalApproval === 'approved' &&
    input.farmafacil.entityConfirmed &&
    quoteAccepted &&
    requiredMissing.length === 0 &&
    unresolvedMarkers.length === 0;

  const canGenerateDraftPdf = quoteAccepted && filledBody.length > 0;
  const canGenerateSignablePdf = readyForSignature;

  return {
    templateKey: input.modality,
    templateLabel: CONTRACT_TEMPLATE_LABELS[input.modality],
    masterTemplateVersion: MASTER_TEMPLATE_VERSION,
    legalApproval: input.legalApproval,
    rebotechEntityConfirmed: input.farmafacil.entityConfirmed,
    isDraft: !readyForSignature,
    quoteId: input.quoteId,
    quoteReference: input.quoteReference,
    quoteStatus: input.quoteStatus,
    snapshotVersion: amounts.snapshotVersion,
    readyForSignature,
    canGenerateDraftPdf,
    canGenerateSignablePdf,
    canGeneratePdf: canGenerateDraftPdf,
    canSendEmail: false,
    canMarkSigned: readyForSignature,
    blockers,
    missingFields,
    unresolvedMarkers,
    farmafacil: input.farmafacil,
    pharmacy: input.pharmacy,
    amounts,
    filledBody,
  };
}
