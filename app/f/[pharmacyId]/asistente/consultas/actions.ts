'use server';

import { revalidatePath } from 'next/cache';

import {
  replyPharmacyAssistantConsult,
  resolvePharmacyAssistantConsult,
} from '@/lib/kiosk/assistant/consults/mutations';
import {
  getPharmacyAssistantPendingConsultCount,
  listPharmacyAssistantConsults,
} from '@/lib/kiosk/assistant/consults/queries';
import type { PharmacistConsultStatus } from '@/lib/kiosk/assistant/consults/types';

function revalidateConsults(pharmacyId: string) {
  revalidatePath(`/f/${pharmacyId}/asistente/consultas`);
  revalidatePath(`/f/${pharmacyId}/asistente`);
}

export async function listPharmacyAssistantConsultsAction(
  pharmacyId: string,
  options?: { status?: PharmacistConsultStatus | 'all'; limit?: number }
) {
  return listPharmacyAssistantConsults(pharmacyId, options);
}

export async function getPharmacyAssistantPendingConsultCountAction(
  pharmacyId: string
) {
  return getPharmacyAssistantPendingConsultCount(pharmacyId);
}

export async function replyPharmacyAssistantConsultAction(input: {
  pharmacyId: string;
  consultId: string;
  reply: string;
}) {
  const result = await replyPharmacyAssistantConsult(input);
  if (result.ok) revalidateConsults(input.pharmacyId);
  return result;
}

export async function resolvePharmacyAssistantConsultAction(input: {
  pharmacyId: string;
  consultId: string;
}) {
  const result = await resolvePharmacyAssistantConsult(input);
  if (result.ok) revalidateConsults(input.pharmacyId);
  return result;
}
