'use server';

import {
  abandonKioskClientTurn,
  createKioskPharmacistConsult,
  pollKioskPharmacistConsult,
} from '@/lib/kiosk/assistant/consults/kiosk';

export async function createKioskPharmacistConsultAction(input: {
  message: string;
  clientRequestId: string;
  turnToken: string;
}) {
  return createKioskPharmacistConsult(input);
}

export async function pollKioskPharmacistConsultAction(input: {
  consultId: string;
  turnToken: string;
}) {
  return pollKioskPharmacistConsult(input);
}

export async function abandonKioskClientTurnAction(input: {
  turnToken: string;
}) {
  return abandonKioskClientTurn(input);
}
