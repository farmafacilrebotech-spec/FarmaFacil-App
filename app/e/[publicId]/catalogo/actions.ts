'use server';

import { createPublicCatalogRequest } from '@/lib/kiosk/public-catalog-request';
import type { CreatePublicCatalogRequestResult } from '@/lib/kiosk/public-catalog-request';

export type SubmitPublicCatalogRequestInput = {
  publicId: string;
  clientRequestId: string;
  lines: Array<{ productId: string; quantity: number }>;
  customerName: string;
  customerPhone: string;
  privacyAccepted: boolean;
  customerNote?: string;
  /** Opt-in vínculo cuenta (RPC). false = invitado aunque haya sesión. */
  linkToCustomer?: boolean;
};

/**
 * Server action: solicitud pública QR.
 * No acepta pharmacy_id ni customer_profile_id del cliente.
 */
export async function submitPublicCatalogRequestAction(
  input: SubmitPublicCatalogRequestInput
): Promise<CreatePublicCatalogRequestResult> {
  return createPublicCatalogRequest({
    publicId: input.publicId,
    clientRequestId: input.clientRequestId,
    lines: input.lines,
    contact: {
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      privacyAccepted: input.privacyAccepted,
      customerNote: input.customerNote ?? null,
    },
    linkToCustomer: input.linkToCustomer === true,
  });
}
