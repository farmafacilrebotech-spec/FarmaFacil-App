import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  MASTER_TEMPLATE_VERSION,
  MODALITY_LABELS,
  composeMasterContractBody,
  findUnresolvedMarkers,
} from '../../legal/contracts/v1/master-template';
import type { RebotechStatusBlock } from './party-data';
import type {
  ContractTemplateKey,
  ContractTemplateMeta,
  LegalApprovalStatus,
} from './types';

export type ContractsStatusFile = {
  legalApproval?: string;
  masterTemplateVersion?: string;
  rebotech?: RebotechStatusBlock;
};

export async function loadContractsStatus(
  cwd: string = process.cwd()
): Promise<ContractsStatusFile> {
  const filePath = path.join(cwd, 'legal/contracts/STATUS.json');
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as ContractsStatusFile;
  } catch {
    return {};
  }
}

export async function loadLegalApprovalStatus(
  cwd: string = process.cwd()
): Promise<LegalApprovalStatus> {
  const status = await loadContractsStatus(cwd);
  if (status.legalApproval === 'approved') return 'approved';
  return 'draft_pending_legal_review';
}

/**
 * Carga la plantilla maestra única y selecciona la modalidad.
 * Ya no usa drafts/*.md por modalidad.
 */
export function loadMasterTemplate(
  key: ContractTemplateKey,
  values: Record<string, string | null | undefined>
): ContractTemplateMeta {
  const body = composeMasterContractBody({ modality: key, values });
  return {
    key,
    label: MODALITY_LABELS[key],
    masterVersion: MASTER_TEMPLATE_VERSION,
    sourceStatus: 'LOADED',
    body,
  };
}

export { findUnresolvedMarkers, MASTER_TEMPLATE_VERSION };

/**
 * Sustituye [CAMPO] por valores. Conserva marcadores sin valor.
 * @deprecated preferir composeMasterContractBody + findUnresolvedMarkers
 */
export function fillTemplateBrackets(
  body: string,
  values: Record<string, string | null | undefined>
): { filled: string; unresolved: string[] } {
  const PLACEHOLDER_RE = /\[([^\]]+)\]/g;
  const unresolved = new Set<string>();
  const filled = body.replace(PLACEHOLDER_RE, (full, key: string) => {
    const trimmed = String(key).trim();
    const v = values[trimmed];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
    unresolved.add(trimmed);
    return full;
  });
  return { filled, unresolved: Array.from(unresolved).sort() };
}

/** Compat tests / legacy parse — drafts ya no son fuente. */
export function parseTemplateFile(
  key: ContractTemplateKey,
  _raw: string
): ContractTemplateMeta {
  return loadMasterTemplate(key, {});
}

export async function loadContractTemplate(
  key: ContractTemplateKey,
  _cwd: string = process.cwd()
): Promise<ContractTemplateMeta> {
  return loadMasterTemplate(key, {});
}
