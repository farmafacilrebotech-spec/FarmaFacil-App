/**
 * Cuerpo breve del email de envío de presupuesto comercial.
 * No reproduce el presupuesto completo; el PDF va adjunto.
 */

/** Logo circular oficial en www (mismo recurso que EMAIL-10 / firma). */
export const COMMERCIAL_QUOTE_EMAIL_LOGO_URL =
  'https://www.farmafacil.solutions/images/logo/farmafacil-logo.png';

/** Vigencia en correo: siempre DD/MM/AAAA. */
export function formatCommercialQuoteEmailDate(
  iso: string | null | undefined
): string {
  if (!iso) return '—';
  const trimmed = iso.trim();
  const d = new Date(trimmed.length === 10 ? `${trimmed}T12:00:00Z` : trimmed);
  if (Number.isNaN(d.getTime())) return trimmed;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export function buildCommercialQuoteEmailBodies(input: {
  referenceCode: string;
  contactName: string;
  clientName: string;
  validUntil: string | null;
}): { subject: string; html: string; text: string } {
  const ref = input.referenceCode.trim();
  const name = input.contactName?.trim() || 'hola';
  const client = input.clientName?.trim() || 'tu farmacia';
  const vigencia = formatCommercialQuoteEmailDate(input.validUntil);
  const logoSrc = COMMERCIAL_QUOTE_EMAIL_LOGO_URL;

  const subject = `Presupuesto FarmaFácil ${ref} · ${client}`;

  const text = [
    `Hola ${name},`,
    '',
    `Te enviamos el presupuesto ${ref} para ${client}.`,
    'El detalle económico completo está en el PDF adjunto.',
    `Vigencia hasta: ${vigencia}.`,
    '',
    'La aceptación de este presupuesto no firma contrato, no activa piloto ni genera cobros.',
    '',
    'Un saludo,',
    'Equipo FarmaFácil',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f7f8;font-family:Arial,Helvetica,sans-serif;color:#0B0B0B">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f8;padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #C5CCD3;border-radius:8px;padding:28px 28px 24px">
          <tr>
            <td style="padding-bottom:16px;border-bottom:3px solid #1ABBB3">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px">
                    <img src="${escapeHtml(logoSrc)}" alt="FarmaFácil" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:50%;object-fit:cover;border:0"/>
                  </td>
                  <td style="vertical-align:middle">
                    <div style="font-size:20px;font-weight:700;color:#0B0B0B;line-height:1.2">FarmaFácil</div>
                    <div style="font-size:13px;color:#1ABBB3;margin-top:2px">Presupuesto comercial</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;font-size:14px;line-height:1.55;color:#0B0B0B">
              <p style="margin:0 0 12px">Hola ${escapeHtml(name)},</p>
              <p style="margin:0 0 12px">
                Te enviamos el presupuesto <strong>${escapeHtml(ref)}</strong>
                para <strong>${escapeHtml(client)}</strong>.
              </p>
              <p style="margin:0 0 12px">
                El detalle económico completo está en el <strong>PDF adjunto</strong>.
              </p>
              <p style="margin:0 0 12px;color:#5b6570;font-size:13px">
                Vigencia hasta: ${escapeHtml(vigencia)}.
              </p>
              <p style="margin:0;color:#5b6570;font-size:12px">
                La aceptación no firma contrato, no activa piloto ni genera cobros.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px;border-top:1px solid #C5CCD3;font-size:12px;color:#5b6570">
              Equipo FarmaFácil
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
