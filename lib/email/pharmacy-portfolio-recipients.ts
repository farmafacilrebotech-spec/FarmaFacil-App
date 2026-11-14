/**
 * Punto de integración: destinatarios con consentimiento comercial
 * desde Cartera de farmacias.
 *
 * Estado actual: no existe tabla de Cartera / autorizaciones comerciales
 * de farmacias en staging. No inventar datos. El envío manual sigue libre.
 */

export type PharmacyPortfolioRecipient = {
  pharmacyId: string;
  pharmacyName: string;
  contactName: string | null;
  email: string;
  city: string | null;
  province: string | null;
  authorizedAt: string;
};

export type PharmacyPortfolioRecipientsResult =
  | {
      ok: true;
      available: boolean;
      recipients: PharmacyPortfolioRecipient[];
      notice: string | null;
    }
  | { ok: false; error: string };

/**
 * Consulta Cartera. Hoy: integración no disponible (sin inventar filas).
 * Cuando exista el modelo, sustituir el cuerpo por la query real.
 */
export async function listPharmacyPortfolioCommercialRecipients(_input?: {
  query?: string;
}): Promise<PharmacyPortfolioRecipientsResult> {
  return {
    ok: true,
    available: false,
    recipients: [],
    notice:
      'La selección desde Cartera de farmacias estará disponible cuando el registro de autorizaciones comerciales esté operativo. Mientras tanto puedes introducir cualquier email válido manualmente.',
  };
}
