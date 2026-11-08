/**
 * Kit + plantillas corporativas FarmaFácil (Resend).
 * Archivo único (sin imports relativos) para convivir node:test + tsc.
 * No altera la plantilla Lanzadera.
 */

export const FF_EMAIL_BRAND = {
  header: '#111827',
  turquoise: '#2EC4C7',
  turquoiseHover: '#26B1B3',
  turquoiseSoft: '#E8F8F9',
  turquoiseSoftStrong: '#D5F3F5',
  grayBg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  silver: '#E7EEF3',
  silverDark: '#C5D0D8',
  white: '#FFFFFF',
} as const;

export const FF_EMAIL_FROM =
  'Pilar Reyes · FarmaFácil <pilar@farmafacil.solutions>';

export const FF_EMAIL_REPLY_TO = 'pilar@farmafacil.solutions';

export const FF_LOGO_URL =
  'https://www.farmafacil.solutions/images/logo/farmafacil-logo.png';

export const FF_PHOTO_PUBLIC_URL =
  'https://www.farmafacil.solutions/images/email/firma-pilar.png';

export const FF_PHOTO_LOCAL_PATH = '/images/email/firma-pilar.png';

export const FF_MODULE_ICON_PATHS = {
  catalog: '/images/kiosk/kiosk-qr.png',
  orders: '/images/kiosk/kiosk-cart.png',
  kiosk: '/images/kiosk/kiosk-search.png',
  assistant: '/images/kiosk/kiosk-ai.png',
} as const;

export const FF_APP_PUBLIC_ORIGIN = 'https://app.farmafacil.solutions';

export const FF_EMAIL_FONT =
  "Arial, Helvetica, 'Helvetica Neue', sans-serif";

export type FfEmailImageMode = 'preview' | 'send';

export type FfEmailContent = {
  templateId: string;
  subject: string;
  html: string;
  text: string;
  from: string;
  replyTo: string;
  imageMode: FfEmailImageMode;
  photoUrl: string;
  sendEnabled: false;
};

export type BuildFfEmailOptions = {
  imageMode?: FfEmailImageMode;
  previewOrigin?: string | null;
  /** Personalización futura (opcional). */
  vars?: Record<string, string | undefined | null>;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function normalizeFfPreviewOrigin(
  previewOrigin?: string | null
): string | null {
  const raw = (previewOrigin || '').trim().replace(/\/$/, '');
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (/^(localhost|127\.0\.0\.1)$/i.test(u.hostname)) {
      u.protocol = 'http:';
      return u.origin;
    }
    return u.origin;
  } catch {
    return raw;
  }
}

export function resolveFfAppAsset(
  path: string,
  mode: FfEmailImageMode,
  previewOrigin?: string | null
): string {
  if (mode === 'send') {
    return `${FF_APP_PUBLIC_ORIGIN}${path}`;
  }
  const origin = normalizeFfPreviewOrigin(previewOrigin);
  if (origin) return `${origin}${path}`;
  return path;
}

export function resolveFfPhotoUrl(
  mode: FfEmailImageMode,
  previewOrigin?: string | null
): string {
  return mode === 'preview'
    ? resolveFfAppAsset(FF_PHOTO_LOCAL_PATH, 'preview', previewOrigin)
    : FF_PHOTO_PUBLIC_URL;
}

export function applyEmailVars(
  template: string,
  vars?: Record<string, string | undefined | null>
): string {
  if (!vars) return template;
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    if (value == null || value === '') continue;
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}

export function ffEmailHead(title: string): string {
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(title)}</title>
  <style type="text/css">
    @media only screen and (max-width: 520px) {
      .ff-modules-grid { width: 100% !important; }
      .ff-module-cell { display: block !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
      .ff-cta { display: block !important; width: 100% !important; }
    }
  </style>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style type="text/css">
    body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>`;
}

export function ffEmailHeaderHtml(logoUrl: string): string {
  const B = FF_EMAIL_BRAND;
  const font = FF_EMAIL_FONT;
  return `
          <tr>
            <td align="center" style="background-color:${B.header};padding:22px 24px 18px 24px;text-align:center;">
              <img src="${escapeHtml(logoUrl)}" width="100" height="100" alt="FarmaFácil" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:100px;height:100px;max-width:100px;object-fit:contain;" />
              <div style="font-family:${font};font-size:18px;font-weight:700;color:${B.white};letter-spacing:0.3px;line-height:1.3;margin-top:10px;">
                FarmaFácil
              </div>
              <div style="font-family:${font};font-size:12px;color:${B.silverDark};margin-top:4px;letter-spacing:0.2px;line-height:1.4;">
                Tu farmacia, más cerca de tus clientes
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:${B.turquoise};height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>`;
}

export const FF_EMAIL_PHONE_DISPLAY = '+34 711 520 218';
export const FF_EMAIL_PHONE_TEL = '+34711520218';

export function ffEmailSignatureHtml(photoUrl: string): string {
  const B = FF_EMAIL_BRAND;
  const font = FF_EMAIL_FONT;
  return `
          <tr>
            <td style="padding:0 28px 28px 28px;font-family:${font};">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td valign="middle" width="80" style="padding-right:16px;">
                    <img src="${escapeHtml(photoUrl)}" width="80" height="80" alt="" style="display:block;border:0;outline:none;text-decoration:none;width:80px;height:80px;border-radius:40px;-webkit-border-radius:40px;" />
                  </td>
                  <td valign="middle" style="font-family:${font};color:${B.text};">
                    <div style="font-size:16px;font-weight:700;color:${B.header};line-height:1.35;">Pilar Reyes Bononat</div>
                    <div style="font-size:13px;color:${B.muted};margin-top:3px;line-height:1.4;">Fundadora y Directora | FarmaFácil</div>
                    <div style="font-size:13px;margin-top:8px;line-height:1.45;">
                      <a href="mailto:pilar@farmafacil.solutions" style="color:${B.turquoiseHover};text-decoration:none;">pilar@farmafacil.solutions</a>
                    </div>
                    <div style="font-size:13px;margin-top:2px;line-height:1.45;">
                      <a href="tel:${FF_EMAIL_PHONE_TEL}" style="color:${B.turquoiseHover};text-decoration:none;">${FF_EMAIL_PHONE_DISPLAY}</a>
                    </div>
                    <div style="font-size:13px;margin-top:2px;line-height:1.45;">
                      <a href="https://www.farmafacil.solutions" style="color:${B.turquoiseHover};text-decoration:none;">www.farmafacil.solutions</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

export function ffEmailFooterHtml(): string {
  const B = FF_EMAIL_BRAND;
  const font = FF_EMAIL_FONT;
  return `
          <tr>
            <td align="center" style="background-color:${B.header};padding:20px 24px;font-family:${font};font-size:12px;line-height:1.55;color:${B.silverDark};text-align:center;">
              <strong style="color:${B.white};">FarmaFácil</strong><br />
              Tu farmacia, más cerca de tus clientes.<br />
              <a href="https://www.farmafacil.solutions" style="color:${B.turquoise};text-decoration:none;">www.farmafacil.solutions</a>
            </td>
          </tr>`;
}

export function ffModuleCardHtml(
  iconSrc: string,
  title: string,
  body: string
): string {
  const B = FF_EMAIL_BRAND;
  const font = FF_EMAIL_FONT;
  return `
                  <td class="ff-module-cell" width="50%" valign="top" style="padding:4px;font-family:${font};">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;height:100%;">
                      <tr>
                        <td height="220" valign="top" style="background-color:${B.grayBg};border:1px solid ${B.silver};border-radius:12px;padding:18px 14px 16px 14px;text-align:center;font-family:${font};">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="border-collapse:collapse;margin:0 auto 12px auto;">
                            <tr>
                              <td width="80" height="80" align="center" valign="middle" bgcolor="${B.turquoiseSoft}" style="width:80px;height:80px;background-color:${B.turquoiseSoft};border-radius:40px;-webkit-border-radius:40px;text-align:center;vertical-align:middle;line-height:80px;">
                                <img src="${escapeHtml(iconSrc)}" width="44" height="44" alt="" style="display:inline-block;border:0;outline:none;width:44px;height:44px;max-width:44px;object-fit:contain;vertical-align:middle;" />
                              </td>
                            </tr>
                          </table>
                          <div style="font-size:14px;font-weight:700;color:${B.header};margin:0 0 8px 0;line-height:1.3;">${escapeHtml(title)}</div>
                          <div style="font-size:12px;line-height:1.5;color:${B.muted};">${escapeHtml(body)}</div>
                        </td>
                      </tr>
                    </table>
                  </td>`;
}

/** Cuatro tarjetas 2×2 (mismos textos comerciales que Lanzadera). */
export function ffFeatureModulesGridHtml(icons: {
  catalog: string;
  orders: string;
  kiosk: string;
  assistant: string;
}): string {
  return `
              <table class="ff-modules-grid" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;width:100%;">
                <tr>
                  ${ffModuleCardHtml(
                    icons.catalog,
                    'Catálogo digital QR',
                    'Productos y servicios al alcance del cliente, con acceso inmediato mediante QR.'
                  )}
                  ${ffModuleCardHtml(
                    icons.orders,
                    'Pedidos online',
                    'Tus clientes solicitan sus productos fácilmente, desde cualquier lugar y sin esperas.'
                  )}
                </tr>
                <tr>
                  ${ffModuleCardHtml(
                    icons.kiosk,
                    'Kiosko de autoservicio',
                    'Una experiencia de compra ágil, intuitiva y sin colas, directamente en la farmacia.'
                  )}
                  ${ffModuleCardHtml(
                    icons.assistant,
                    'Asistente virtual con IA',
                    'Información, orientación personalizada y apoyo al farmacéutico, siempre a un clic.'
                  )}
                </tr>
              </table>`;
}

export function ffCtaButtonHtml(label: string, mailtoHref: string): string {
  const B = FF_EMAIL_BRAND;
  const font = FF_EMAIL_FONT;
  return `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:8px auto 0 auto;">
                <tr>
                  <td class="ff-cta" align="center" bgcolor="${B.turquoise}" style="border-radius:8px;background-color:${B.turquoise};">
                    <a href="${escapeHtml(mailtoHref)}" style="display:inline-block;padding:14px 28px;font-family:${font};font-size:15px;font-weight:700;color:${B.white};text-decoration:none;border-radius:8px;">
                      ${escapeHtml(label)}
                    </a>
                  </td>
                </tr>
              </table>`;
}

export function ffWrapBody(
  templateId: string,
  preheader: string,
  innerRowsHtml: string
): string {
  const B = FF_EMAIL_BRAND;
  return `${ffEmailHead('FarmaFácil')}
<body style="margin:0;padding:0;background-color:${B.grayBg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- ${escapeHtml(templateId)} -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;background-color:${B.grayBg};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;width:100%;max-width:600px;background-color:${B.card};border:1px solid ${B.silver};">
${innerRowsHtml}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function assertSendHtmlHasNoLocalAssets(html: string): void {
  if (
    html.includes('127.0.0.1') ||
    html.includes('localhost') ||
    /src="\/images\//.test(html)
  ) {
    throw new Error('HTML de envío contiene rutas locales; abortado.');
  }
}

/**
 * Plantilla corporativa: solicitud de presupuesto a imprentas.
 * Identificador: ff-printing-quote-v1
 * Envío deshabilitado hasta autorización expresa.
 */

export const PRINTING_QUOTE_TEMPLATE_ID = 'ff-printing-quote-v1';

export const PRINTING_QUOTE_SUBJECT =
  'FarmaFácil | Solicitud de presupuesto de material corporativo';

type PrintingSubSection = {
  title: string;
  intro?: string;
  bullets: readonly string[];
  note?: string;
};

type PrintingBulletSection = {
  title: string;
  intro?: string;
  bullets?: readonly string[];
  note?: string;
  subsections?: readonly PrintingSubSection[];
};

const PRINTING_SECTIONS: readonly PrintingBulletSection[] = [
  {
    title: '1. Tarjetas de visita — 1.000 unidades',
    bullets: [
      'Formato horizontal: 85 × 55 mm.',
      'Impresión a doble cara y a todo color.',
      'Papel de 350–400 g.',
      'Acabado laminado mate.',
      'Diseño corporativo negro, turquesa y plateado.',
      'Diseño disponible en PDF con código QR.',
    ],
  },
  {
    title: '2. Flyers publicitarios — 1.000 unidades',
    bullets: [
      'Formato A5.',
      'Impresión a doble cara y a todo color.',
      'Papel de 170–250 g.',
      'Acabado mate.',
      'Diseño corporativo con código QR.',
    ],
  },
  {
    title: '3. Carpetas para dosieres comerciales',
    intro:
      'Carpetas A4 personalizadas para entregar presentaciones comerciales, documentación y contratos a las farmacias.',
    bullets: [
      'Formato A4.',
      'Solapas interiores para sujetar documentos.',
      'Papel o cartulina de alta calidad.',
      'Impresión corporativa a todo color.',
      'Acabado mate.',
      'Presupuesto para 50, 100 y 250 unidades.',
      'Presupuesto separado para documentos interiores del dosier (indicar opciones disponibles).',
    ],
  },
  {
    title: '4. Vinilos circulares para kioskos — 50 unidades',
    bullets: [
      'Diámetro: 15 cm.',
      'Forma circular.',
      'Logotipo oficial de FarmaFácil.',
      'Fondo negro, aro y letras plateadas, símbolo central turquesa.',
      'Vinilo adhesivo resistente y fácil de limpiar.',
      'Acabado mate o satinado.',
      'Troquelado circular individual.',
    ],
    note:
      'Se colocarán en la columna frontal de los kioskos de autoservicio. Solicitar recomendación de adhesivo adecuado para la superficie del kiosko y resistente a la limpieza habitual.',
  },
  {
    title: '5. Pegatinas troqueladas redondas — 500 unidades',
    bullets: [
      '250 unidades de 5 cm de diámetro.',
      '250 unidades de 7 cm de diámetro.',
      'Impresión a todo color del logotipo oficial.',
      'Vinilo adhesivo resistente al agua.',
      'Acabado mate.',
      'Corte circular individual.',
    ],
  },
  {
    title: '6. Roll-ups publicitarios',
    intro:
      'Los roll-ups se utilizarán para promocionar el catálogo digital de FarmaFácil en farmacias, demostraciones comerciales y eventos. El diseño será genérico, sin un QR fijo integrado, para poder utilizarlo en diferentes farmacias.',
    bullets: [
      'Presupuesto para 2, 5 y 10 unidades.',
      'Tamaño orientativo: 85 × 200 cm.',
      'Impresión a todo color.',
      'Diseño corporativo de FarmaFácil.',
      'Estructura enrollable incluida.',
      'Bolsa de transporte incluida.',
      'Material resistente y de buena calidad.',
      'Solicitar recomendaciones sobre materiales y acabados.',
    ],
  },
  {
    title: '7. Material promocional para farmacias',
    intro:
      'Materiales genéricos para farmacias, demostraciones y puntos de venta. Preferimos diseños sin QR integrado fijo, salvo donde se indique lo contrario.',
    subsections: [
      {
        title: 'A. Carteles o expositores de mostrador',
        bullets: [
          'Tamaños A4 y A3.',
          'Cantidad: 5 y 10 unidades de cada tamaño, presupuestadas por separado.',
          'Impresión corporativa a todo color.',
          'Material rígido y resistente.',
          'Aptos para colocación sobre mostradores.',
          'Diseño genérico con espacio para un QR independiente.',
        ],
      },
      {
        title: 'B. Adhesivos QR personalizados',
        bullets: [
          '10 unidades de 15 × 15 cm.',
          '10 unidades de 10 × 10 cm.',
          'Acabado mate.',
          'Resistentes a la limpieza habitual.',
          'Posibilidad de imprimir distintos códigos QR en un mismo pedido.',
        ],
      },
      {
        title: 'C. Vinilos promocionales para escaparates',
        bullets: [
          'Presupuesto alternativo: 5 unidades de 40 × 60 cm.',
          'Presupuesto alternativo: 10 unidades de 40 × 60 cm.',
          'Diseño corporativo genérico sin QR integrado.',
          'Vinilo apto para cristales, preferiblemente removible.',
        ],
        note:
          'Estos vinilos son una alternativa a los roll-ups para farmacias que no dispongan de suficiente espacio.',
      },
    ],
  },
] as const;

const PRINTING_INFO_REQUESTED = [
  'Precio unitario y total de cada producto.',
  'Presupuesto con IVA desglosado.',
  'Precio individual y descuento por pedido conjunto.',
  'Cantidades mínimas de fabricación.',
  'Recomendaciones de materiales y acabados.',
  'Plazos de fabricación y entrega.',
  'Gastos de envío a Valencia.',
  'Posibilidad de solicitar muestras.',
  'Requisitos de los archivos para imprenta.',
] as const;

function printingBulletRowsHtml(
  items: readonly string[],
  font: string,
  B: typeof FF_EMAIL_BRAND
): string {
  return items
    .map(
      (item) => `
                <tr>
                  <td width="22" valign="top" style="padding:4px 8px 4px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                      <td width="10" height="10" bgcolor="${B.turquoise}" style="background-color:${B.turquoise};border-radius:5px;font-size:0;line-height:0;">&nbsp;</td>
                    </tr></table>
                  </td>
                  <td valign="top" style="padding:2px 0;font-family:${font};font-size:14px;line-height:1.5;color:${B.text};">
                    ${escapeHtml(item)}
                  </td>
                </tr>`
    )
    .join('');
}

function printingSectionHtml(
  section: PrintingBulletSection,
  font: string,
  B: typeof FF_EMAIL_BRAND
): string {
  const bulletsHtml = section.bullets?.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                      ${printingBulletRowsHtml(section.bullets, font, B)}
                    </table>`
    : '';

  const subsectionsHtml = (section.subsections || [])
    .map(
      (sub) => `
                    <p style="margin:14px 0 8px 0;font-size:13px;font-weight:700;line-height:1.4;color:${B.turquoiseHover};">
                      ${escapeHtml(sub.title)}
                    </p>
                    ${
                      sub.intro
                        ? `<p style="margin:0 0 8px 0;font-size:14px;line-height:1.55;color:${B.text};">${escapeHtml(sub.intro)}</p>`
                        : ''
                    }
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                      ${printingBulletRowsHtml(sub.bullets, font, B)}
                    </table>
                    ${
                      sub.note
                        ? `<p style="margin:8px 0 0 0;font-size:13px;line-height:1.55;color:${B.muted};">${escapeHtml(sub.note)}</p>`
                        : ''
                    }`
    )
    .join('');

  return `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:0 0 16px 0;border:1px solid ${B.silver};background-color:${B.grayBg};">
                <tr>
                  <td style="padding:14px 16px;font-family:${font};">
                    <p style="margin:0 0 8px 0;font-size:14px;font-weight:700;line-height:1.4;color:${B.header};">
                      ${escapeHtml(section.title)}
                    </p>
                    ${
                      section.intro
                        ? `<p style="margin:0 0 10px 0;font-size:14px;line-height:1.55;color:${B.text};">${escapeHtml(section.intro)}</p>`
                        : ''
                    }
                    ${bulletsHtml}
                    ${subsectionsHtml}
                    ${
                      section.note
                        ? `<p style="margin:10px 0 0 0;font-size:13px;line-height:1.55;color:${B.muted};">${escapeHtml(section.note)}</p>`
                        : ''
                    }
                  </td>
                </tr>
              </table>`;
}

/**
 * vars futuros (opcionales): printerName, contactName
 */
export function buildPrintingQuoteEmail(
  options?: BuildFfEmailOptions
): FfEmailContent {
  const B = FF_EMAIL_BRAND;
  const font = FF_EMAIL_FONT;
  const imageMode = options?.imageMode ?? 'send';
  const photoUrl = resolveFfPhotoUrl(imageMode, options?.previewOrigin);

  const contactName = options?.vars?.contactName?.trim();
  const greeting = contactName
    ? `Buenos días, ${contactName}:`
    : 'Buenos días:';

  const sectionsHtml = PRINTING_SECTIONS.map((s) =>
    printingSectionHtml(s, font, B)
  ).join('');

  const infoRowsHtml = printingBulletRowsHtml(PRINTING_INFO_REQUESTED, font, B);

  const inner = `
${ffEmailHeaderHtml(FF_LOGO_URL)}
          <tr>
            <td style="padding:32px 28px 8px 28px;font-family:${font};color:${B.text};">
              <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${B.turquoiseHover};">
                Solicitud de presupuesto
              </p>
              <h1 style="margin:0 0 18px 0;font-family:${font};font-size:22px;line-height:1.35;font-weight:700;color:${B.header};">
                Solicitud de presupuesto | Material corporativo FarmaFácil
              </h1>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${B.text};">
                ${escapeHtml(greeting)}
              </p>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Mi nombre es Pilar Reyes, fundadora y directora de FarmaFácil, una solución tecnológica para la digitalización de farmacias.
              </p>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Estamos preparando nuestro lanzamiento comercial y buscamos una imprenta con la que colaborar tanto para esta primera producción como para futuros pedidos.
              </p>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Nos gustaría solicitar presupuesto para los siguientes materiales:
              </p>
              ${sectionsHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:4px 28px 12px 28px;font-family:${font};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;border:1px solid ${B.turquoise};background-color:#F0FBFC;">
                <tr>
                  <td style="padding:16px 18px;font-family:${font};color:${B.text};">
                    <p style="margin:0 0 10px 0;font-size:14px;font-weight:700;color:${B.header};">
                      Información solicitada
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                      ${infoRowsHtml}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 20px 28px;font-family:${font};color:${B.text};">
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Disponemos del logotipo oficial y de parte de los diseños preparados, que podemos facilitar para su valoración.
              </p>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Nuestra intención es establecer una colaboración continuada, ya que FarmaFácil se encuentra en fase de lanzamiento y prevemos realizar nuevos pedidos conforme incorporemos farmacias.
              </p>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Muchas gracias por vuestra atención.
              </p>
              <p style="margin:0 0 6px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Quedo pendiente de vuestra propuesta.
              </p>
              <p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:${B.text};">
                Un saludo,
              </p>
            </td>
          </tr>
${ffEmailSignatureHtml(photoUrl)}
${ffEmailFooterHtml()}
`.trim();

  const html = ffWrapBody(
    PRINTING_QUOTE_TEMPLATE_ID,
    'Solicitud de presupuesto de material corporativo FarmaFácil.',
    inner
  );

  if (imageMode === 'send') assertSendHtmlHasNoLocalAssets(html);

  const textSections = PRINTING_SECTIONS.flatMap((s) => {
    const lines = [`${s.title}`, ...(s.intro ? [s.intro] : [])];
    if (s.bullets?.length) lines.push(...s.bullets.map((b) => `- ${b}`));
    for (const sub of s.subsections || []) {
      lines.push('', sub.title);
      if (sub.intro) lines.push(sub.intro);
      lines.push(...sub.bullets.map((b) => `- ${b}`));
      if (sub.note) lines.push(sub.note);
    }
    if (s.note) lines.push(s.note);
    lines.push('');
    return lines;
  });

  const text = [
    'Solicitud de presupuesto | Material corporativo FarmaFácil',
    '',
    greeting,
    '',
    'Mi nombre es Pilar Reyes, fundadora y directora de FarmaFácil, una solución tecnológica para la digitalización de farmacias.',
    '',
    'Estamos preparando nuestro lanzamiento comercial y buscamos una imprenta con la que colaborar tanto para esta primera producción como para futuros pedidos.',
    '',
    'Nos gustaría solicitar presupuesto para los siguientes materiales:',
    '',
    ...textSections,
    'Información solicitada:',
    ...PRINTING_INFO_REQUESTED.map((i) => `- ${i}`),
    '',
    'Disponemos del logotipo oficial y de parte de los diseños preparados, que podemos facilitar para su valoración.',
    '',
    'Nuestra intención es establecer una colaboración continuada, ya que FarmaFácil se encuentra en fase de lanzamiento y prevemos realizar nuevos pedidos conforme incorporemos farmacias.',
    '',
    'Muchas gracias por vuestra atención.',
    '',
    'Quedo pendiente de vuestra propuesta.',
    '',
    'Un saludo,',
    '',
    'Pilar Reyes Bononat',
    'Fundadora y Directora | FarmaFácil',
    'pilar@farmafacil.solutions',
    FF_EMAIL_PHONE_DISPLAY,
    'www.farmafacil.solutions',
  ].join('\n');

  return {
    templateId: PRINTING_QUOTE_TEMPLATE_ID,
    subject: PRINTING_QUOTE_SUBJECT,
    html,
    text,
    from: FF_EMAIL_FROM,
    replyTo: FF_EMAIL_REPLY_TO,
    imageMode,
    photoUrl,
    sendEnabled: false,
  };
}

/**
 * Plantilla corporativa: invitación a conocer / demo FarmaFácil.
 * Identificador: ff-pharmacy-demo-v1
 * Envío deshabilitado hasta autorización expresa.
 */

export const PHARMACY_DEMO_TEMPLATE_ID = 'ff-pharmacy-demo-v1';

export const PHARMACY_DEMO_SUBJECT =
  'FarmaFácil | Descubre una nueva forma de conectar con tus clientes';

const DEMO_MAILTO =
  'mailto:pilar@farmafacil.solutions?subject=' +
  encodeURIComponent('Solicitud de demostración de FarmaFácil');

/**
 * vars futuros (opcionales): pharmacyName, contactName
 */
export function buildPharmacyDemoEmail(
  options?: BuildFfEmailOptions
): FfEmailContent {
  const B = FF_EMAIL_BRAND;
  const font = FF_EMAIL_FONT;
  const imageMode = options?.imageMode ?? 'send';
  const photoUrl = resolveFfPhotoUrl(imageMode, options?.previewOrigin);
  const origin = options?.previewOrigin;

  const icons = {
    catalog: resolveFfAppAsset(
      FF_MODULE_ICON_PATHS.catalog,
      imageMode,
      origin
    ),
    orders: resolveFfAppAsset(FF_MODULE_ICON_PATHS.orders, imageMode, origin),
    kiosk: resolveFfAppAsset(FF_MODULE_ICON_PATHS.kiosk, imageMode, origin),
    assistant: resolveFfAppAsset(
      FF_MODULE_ICON_PATHS.assistant,
      imageMode,
      origin
    ),
  };

  const contactName = options?.vars?.contactName?.trim();
  const pharmacyName = options?.vars?.pharmacyName?.trim();
  const greeting = contactName
    ? `Buenos días, ${contactName}:`
    : 'Buenos días:';
  const pharmacyLine = pharmacyName
    ? ` pensada también para ${pharmacyName}`
    : '';

  const inner = `
${ffEmailHeaderHtml(FF_LOGO_URL)}
          <tr>
            <td style="padding:32px 28px 8px 28px;font-family:${font};color:${B.text};">
              <h1 style="margin:0 0 18px 0;font-family:${font};font-size:22px;line-height:1.35;font-weight:700;color:${B.header};">
                Descubre FarmaFácil
              </h1>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${B.text};">
                ${escapeHtml(greeting)}
              </p>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Soy Pilar Reyes Bononat, fundadora de FarmaFácil, una solución tecnológica creada para ayudar a las farmacias a mejorar la experiencia de sus clientes y facilitar su digitalización${escapeHtml(pharmacyLine)}.
              </p>
              <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Estamos desarrollando una plataforma que permite incorporar nuevas herramientas digitales a la farmacia, sin necesidad de sustituir su programa de gestión habitual.
              </p>
              <p style="margin:18px 0 12px 0;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${B.turquoiseHover};">
                ¿Qué puede aportar FarmaFácil a tu farmacia?
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 20px 8px 20px;font-family:${font};">
              ${ffFeatureModulesGridHtml(icons)}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 8px 28px;font-family:${font};color:${B.text};">
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Actualmente estamos preparando las primeras pruebas con farmacias y nos gustaría enseñarte cómo funciona FarmaFácil.
              </p>
              <p style="margin:0 0 8px 0;font-size:16px;font-weight:700;line-height:1.45;color:${B.header};">
                ¿Te gustaría conocer la plataforma?
              </p>
              <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Podemos concertar una breve demostración, sin compromiso, y valorar qué funcionalidades podrían resultar más útiles para tu farmacia.
              </p>
              ${ffCtaButtonHtml('Solicitar una demostración', DEMO_MAILTO)}
              <p style="margin:22px 0 0 0;font-size:15px;line-height:1.6;color:${B.text};">
                Muchas gracias por tu tiempo.
              </p>
              <p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:${B.text};">
                Un cordial saludo,
              </p>
            </td>
          </tr>
${ffEmailSignatureHtml(photoUrl)}
${ffEmailFooterHtml()}
`.trim();

  const html = ffWrapBody(
    PHARMACY_DEMO_TEMPLATE_ID,
    'Descubre FarmaFácil: catálogo QR, pedidos, kiosko y asistente IA.',
    inner
  );

  if (imageMode === 'send') assertSendHtmlHasNoLocalAssets(html);

  const text = [
    'Descubre FarmaFácil',
    '',
    greeting,
    '',
    `Soy Pilar Reyes Bononat, fundadora de FarmaFácil, una solución tecnológica creada para ayudar a las farmacias a mejorar la experiencia de sus clientes y facilitar su digitalización${pharmacyLine}.`,
    '',
    'Estamos desarrollando una plataforma que permite incorporar nuevas herramientas digitales a la farmacia, sin necesidad de sustituir su programa de gestión habitual.',
    '',
    '¿Qué puede aportar FarmaFácil a tu farmacia?',
    '',
    '- Catálogo digital QR: productos y servicios al alcance del cliente, con acceso inmediato mediante QR.',
    '- Pedidos online: tus clientes solicitan sus productos fácilmente, desde cualquier lugar y sin esperas.',
    '- Kiosko de autoservicio: una experiencia de compra ágil, intuitiva y sin colas, directamente en la farmacia.',
    '- Asistente virtual con IA: información, orientación personalizada y apoyo al farmacéutico, siempre a un clic.',
    '',
    'Actualmente estamos preparando las primeras pruebas con farmacias y nos gustaría enseñarte cómo funciona FarmaFácil.',
    '',
    '¿Te gustaría conocer la plataforma?',
    'Podemos concertar una breve demostración, sin compromiso, y valorar qué funcionalidades podrían resultar más útiles para tu farmacia.',
    '',
    'Para solicitar una demostración: pilar@farmafacil.solutions (asunto: Solicitud de demostración de FarmaFácil)',
    '',
    'Muchas gracias por tu tiempo.',
    '',
    'Un cordial saludo,',
    '',
    'Pilar Reyes Bononat',
    'Fundadora de FarmaFácil',
    'pilar@farmafacil.solutions',
    'www.farmafacil.solutions',
  ].join('\n');

  return {
    templateId: PHARMACY_DEMO_TEMPLATE_ID,
    subject: PHARMACY_DEMO_SUBJECT,
    html,
    text,
    from: FF_EMAIL_FROM,
    replyTo: FF_EMAIL_REPLY_TO,
    imageMode,
    photoUrl,
    sendEnabled: false,
  };
}

/**
 * Plantilla corporativa: invitación al programa piloto (30 días).
 * Identificador: ff-pharmacy-pilot-v1
 * Envío deshabilitado hasta autorización expresa.
 */

export const PHARMACY_PILOT_TEMPLATE_ID = 'ff-pharmacy-pilot-v1';

export const PHARMACY_PILOT_SUBJECT =
  'FarmaFácil | Invitación a participar en nuestro programa piloto';

const PILOT_MAILTO =
  'mailto:pilar@farmafacil.solutions?subject=' +
  encodeURIComponent('Quiero participar en el piloto de FarmaFácil');

const INCLUDES = [
  'Configuración inicial de la farmacia en FarmaFácil.',
  'Acceso a los módulos seleccionados para la prueba.',
  'Acompañamiento durante la puesta en marcha.',
  'Seguimiento para resolver incidencias y recoger sugerencias.',
  'Evaluación conjunta de los resultados al finalizar.',
] as const;

/**
 * vars futuros (opcionales): pharmacyName, contactName, modulesOffered
 */
export function buildPharmacyPilotEmail(
  options?: BuildFfEmailOptions
): FfEmailContent {
  const B = FF_EMAIL_BRAND;
  const font = FF_EMAIL_FONT;
  const imageMode = options?.imageMode ?? 'send';
  const photoUrl = resolveFfPhotoUrl(imageMode, options?.previewOrigin);

  const contactName = options?.vars?.contactName?.trim();
  const pharmacyName = options?.vars?.pharmacyName?.trim();
  const greeting = contactName
    ? `Buenos días, ${contactName}:`
    : 'Buenos días:';
  const pharmacyBit = pharmacyName ? ` ${pharmacyName}` : ' tu farmacia';

  const includesHtml = INCLUDES.map(
    (item) => `
                <tr>
                  <td width="28" valign="top" style="padding:6px 10px 6px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                      <td width="14" height="14" bgcolor="${B.turquoise}" style="background-color:${B.turquoise};border-radius:7px;font-size:0;line-height:0;">&nbsp;</td>
                    </tr></table>
                  </td>
                  <td valign="top" style="padding:4px 0;font-family:${font};font-size:15px;line-height:1.5;color:${B.text};">
                    ${escapeHtml(item)}
                  </td>
                </tr>`
  ).join('');

  const inner = `
${ffEmailHeaderHtml(FF_LOGO_URL)}
          <tr>
            <td style="padding:32px 28px 12px 28px;font-family:${font};color:${B.text};">
              <h1 style="margin:0 0 18px 0;font-family:${font};font-size:22px;line-height:1.35;font-weight:700;color:${B.header};">
                Invitación al programa piloto
              </h1>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;background-color:${B.header};margin:0 0 20px 0;">
                <tr>
                  <td align="center" style="padding:22px 16px;font-family:${font};">
                    <div style="font-size:28px;font-weight:700;color:${B.turquoise};line-height:1.2;">30 días</div>
                    <div style="font-size:14px;color:${B.silverDark};margin-top:6px;line-height:1.4;">de prueba con acompañamiento FarmaFácil</div>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${B.text};">
                ${escapeHtml(greeting)}
              </p>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Soy Pilar Reyes Bononat, fundadora de FarmaFácil.
              </p>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Estamos dando un paso muy importante en el desarrollo del proyecto: la puesta en marcha de nuestro programa piloto con farmacias.
              </p>
              <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Nos gustaría invitarte a participar en esta primera fase, en la que un grupo reducido de farmacias podrá probar nuestras herramientas digitales y ayudarnos a perfeccionar la plataforma antes de su lanzamiento comercial.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 8px 28px;font-family:${font};color:${B.text};">
              <p style="margin:0 0 10px 0;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${B.turquoiseHover};">
                ¿En qué consiste el programa piloto?
              </p>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Durante <strong>30 días</strong>,${escapeHtml(pharmacyBit)} podrá probar las funcionalidades que acordemos previamente, en función de sus necesidades y de la disponibilidad de cada módulo.
              </p>
              <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:${B.text};">
                El objetivo es comprobar cómo FarmaFácil puede ayudar a mejorar la atención al cliente, facilitar la consulta de productos y agilizar determinados procesos dentro de la farmacia.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 8px 28px;font-family:${font};color:${B.text};">
              <p style="margin:0 0 10px 0;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${B.turquoiseHover};">
                ¿Qué incluye esta colaboración?
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:0 0 8px 0;">
                ${includesHtml}
              </table>
              <p style="margin:12px 0 8px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Queremos que esta experiencia sea útil para tu farmacia y, al mismo tiempo, nos permita seguir construyendo una solución adaptada a las necesidades reales del sector.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 28px 8px 28px;font-family:${font};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;border:1px solid ${B.silver};background-color:${B.grayBg};">
                <tr>
                  <td style="padding:16px 18px;font-family:${font};color:${B.text};">
                    <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:${B.header};">
                      Prueba de software: gratuita durante 30 días.
                    </p>
                    <p style="margin:0 0 8px 0;font-size:13px;line-height:1.55;color:${B.muted};">
                      El kiosko físico es opcional y está sujeto a condiciones específicas de cesión:
                    </p>
                    <p style="margin:0 0 4px 0;font-size:13px;line-height:1.55;color:${B.muted};">
                      · Fianza reembolsable: 1.000 €.
                    </p>
                    <p style="margin:0 0 4px 0;font-size:13px;line-height:1.55;color:${B.muted};">
                      · Instalación y puesta en marcha: 200 € + IVA.
                    </p>
                    <p style="margin:0 0 10px 0;font-size:13px;line-height:1.55;color:${B.muted};">
                      · Transporte: presupuesto según ubicación.
                    </p>
                    <p style="margin:0;font-size:13px;line-height:1.55;color:${B.muted};">
                      Si la farmacia continúa contratando FarmaFácil al finalizar el piloto, los 200 € abonados por la instalación se descontarán del alta definitiva, conforme a las condiciones acordadas.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 8px 28px;font-family:${font};color:${B.text};">
              <p style="margin:0 0 8px 0;font-size:16px;font-weight:700;line-height:1.45;color:${B.header};">
                ¿Te gustaría formar parte de las primeras farmacias piloto de FarmaFácil?
              </p>
              <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Estaré encantada de concertar una visita para enseñarte la plataforma y explicarte cómo podríamos organizar la prueba.
              </p>
              ${ffCtaButtonHtml('Quiero participar', PILOT_MAILTO)}
              <p style="margin:22px 0 0 0;font-size:15px;line-height:1.6;color:${B.text};">
                Muchas gracias por tu confianza y por ayudarnos a dar forma al futuro de FarmaFácil.
              </p>
              <p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:${B.text};">
                Un cordial saludo,
              </p>
            </td>
          </tr>
${ffEmailSignatureHtml(photoUrl)}
${ffEmailFooterHtml()}
`.trim();

  const html = ffWrapBody(
    PHARMACY_PILOT_TEMPLATE_ID,
    'Invitación al programa piloto FarmaFácil: 30 días de prueba.',
    inner
  );

  if (imageMode === 'send') assertSendHtmlHasNoLocalAssets(html);

  const text = [
    'Invitación al programa piloto — FarmaFácil',
    '',
    greeting,
    '',
    'Soy Pilar Reyes Bononat, fundadora de FarmaFácil.',
    '',
    'Estamos dando un paso muy importante en el desarrollo del proyecto: la puesta en marcha de nuestro programa piloto con farmacias.',
    '',
    'Nos gustaría invitarte a participar en esta primera fase, en la que un grupo reducido de farmacias podrá probar nuestras herramientas digitales y ayudarnos a perfeccionar la plataforma antes de su lanzamiento comercial.',
    '',
    '¿En qué consiste el programa piloto?',
    `Durante 30 días,${pharmacyBit} podrá probar las funcionalidades que acordemos previamente, en función de sus necesidades y de la disponibilidad de cada módulo.`,
    '',
    'El objetivo es comprobar cómo FarmaFácil puede ayudar a mejorar la atención al cliente, facilitar la consulta de productos y agilizar determinados procesos dentro de la farmacia.',
    '',
    '¿Qué incluye esta colaboración?',
    ...INCLUDES.map((i) => `- ${i}`),
    '',
    'Prueba de software: gratuita durante 30 días.',
    'El kiosko físico es opcional y está sujeto a condiciones específicas de cesión:',
    '- Fianza reembolsable: 1.000 €.',
    '- Instalación y puesta en marcha: 200 € + IVA.',
    '- Transporte: presupuesto según ubicación.',
    'Si la farmacia continúa contratando FarmaFácil al finalizar el piloto, los 200 € abonados por la instalación se descontarán del alta definitiva, conforme a las condiciones acordadas.',
    '',
    '¿Te gustaría formar parte de las primeras farmacias piloto de FarmaFácil?',
    'Estaré encantada de concertar una visita para enseñarte la plataforma y explicarte cómo podríamos organizar la prueba.',
    '',
    'Para participar: pilar@farmafacil.solutions (asunto: Quiero participar en el piloto de FarmaFácil)',
    '',
    'Muchas gracias por tu confianza y por ayudarnos a dar forma al futuro de FarmaFácil.',
    '',
    'Un cordial saludo,',
    '',
    'Pilar Reyes Bononat',
    'Fundadora de FarmaFácil',
    'pilar@farmafacil.solutions',
    'www.farmafacil.solutions',
  ].join('\n');

  return {
    templateId: PHARMACY_PILOT_TEMPLATE_ID,
    subject: PHARMACY_PILOT_SUBJECT,
    html,
    text,
    from: FF_EMAIL_FROM,
    replyTo: FF_EMAIL_REPLY_TO,
    imageMode,
    photoUrl,
    sendEnabled: false,
  };
}

