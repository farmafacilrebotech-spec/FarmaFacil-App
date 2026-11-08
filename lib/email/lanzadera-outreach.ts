/**
 * Plantilla corporativa FarmaFácil → Lanzadera (Resend).
 *
 * Solo genera HTML/texto. El envío requiere autorización expresa
 * y no está cableado a ninguna acción de producción.
 */

/** Identidad visual Brand Book FarmaFácil. */
export const LANZADERA_EMAIL_BRAND = {
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

/** Remitente Lanzadera (dominio farmafacil.solutions en Resend). */
export const LANZADERA_EMAIL_FROM =
  'Pilar Reyes · FarmaFácil <pilar@farmafacil.solutions>';

export const LANZADERA_EMAIL_REPLY_TO = 'pilar@farmafacil.solutions';

/** Logo oficial (HTTPS corporativo). */
export const LANZADERA_LOGO_URL =
  'https://www.farmafacil.solutions/images/logo/farmafacil-logo.png';

/**
 * Foto firma — URL HTTPS preferida (web corporativa www).
 * No considerar lista para envío hasta HTTP 200 + image/png.
 */
export const LANZADERA_PHOTO_PUBLIC_URL =
  'https://www.farmafacil.solutions/images/email/firma-pilar.png';

/** Ruta local del asset (vista previa SuperAdmin). */
export const LANZADERA_PHOTO_LOCAL_PATH = '/images/email/firma-pilar.png';

/** Iconos de módulos (existentes en public/images/kiosk/). */
export const LANZADERA_MODULE_ICON_PATHS = {
  catalog: '/images/kiosk/kiosk-qr.png',
  orders: '/images/kiosk/kiosk-cart.png',
  kiosk: '/images/kiosk/kiosk-search.png',
  assistant: '/images/kiosk/kiosk-ai.png',
} as const;

const APP_PUBLIC_ORIGIN = 'https://app.farmafacil.solutions';

export const LANZADERA_EMAIL_SUBJECT =
  'FarmaFácil | Evolución del proyecto e incorporación a Lanzadera en marzo de 2027';

export type LanzaderaImageMode = 'preview' | 'send';

export type LanzaderaOutreachContent = {
  subject: string;
  html: string;
  text: string;
  from: string;
  replyTo: string;
  imageMode: LanzaderaImageMode;
  photoUrl: string;
  /** false hasta autorización de envío */
  sendEnabled: false;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Normaliza el origen de vista previa SuperAdmin.
 *
 * `requestPublicOriginFromHeaders(..., CANONICAL_PRODUCTION_APP_URL)` toma el
 * protocolo del fallback (https) cuando no hay X-Forwarded-Proto. En local eso
 * produce `https://localhost:3010` y el <base>/src relativo rompe las imágenes
 * (naturalWidth=0). Forzamos http en hosts locales.
 */
export function normalizeLanzaderaPreviewOrigin(
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

/**
 * Resuelve assets de imagen.
 * - preview: URL absoluta `http(s)://origen-local/images/...` (iframe srcDoc).
 * - send: HTTPS público en app.farmafacil.solutions (o www para el logo).
 */
function resolveAppAsset(
  path: string,
  mode: LanzaderaImageMode,
  previewOrigin?: string | null
): string {
  if (mode === 'send') {
    return `${APP_PUBLIC_ORIGIN}${path}`;
  }
  const origin = normalizeLanzaderaPreviewOrigin(previewOrigin);
  if (origin) return `${origin}${path}`;
  return path;
}

export type BuildLanzaderaOptions = {
  /**
   * `preview` → imágenes absolutas al origen local (SuperAdmin / iframe).
   * `send` → URLs HTTPS públicas (HTML listo para Resend).
   */
  imageMode?: LanzaderaImageMode;
  /** Origen de la petición (p.ej. http://127.0.0.1:3010). Se normaliza a http en local. */
  previewOrigin?: string | null;
};

function roadmapStageCell(opts: {
  label: string;
  text: string;
  bg: string;
  accent: string;
  isLast?: boolean;
}): string {
  const B = LANZADERA_EMAIL_BRAND;
  const font = "Arial, Helvetica, 'Helvetica Neue', sans-serif";
  const arrow = opts.isLast
    ? ''
    : `<td class="ff-roadmap-arrow" width="12" valign="middle" style="padding:0 2px;font-family:${font};font-size:14px;color:${B.turquoise};text-align:center;">&#8250;</td>`;
  return `
                <td width="96" valign="top" style="padding:0;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td align="center" style="background-color:${opts.bg};border:1px solid ${B.silver};border-radius:10px;padding:12px 8px;font-family:${font};">
                        <div style="width:22px;height:22px;line-height:22px;margin:0 auto 8px auto;border-radius:11px;background-color:${opts.accent};color:${B.white};font-size:11px;font-weight:700;text-align:center;">&#9679;</div>
                        <div style="font-size:11px;font-weight:700;letter-spacing:0.4px;color:${B.header};line-height:1.25;margin:0 0 6px 0;">${opts.label}</div>
                        <div style="font-size:11px;line-height:1.4;color:${B.muted};">${opts.text}</div>
                      </td>
                    </tr>
                  </table>
                </td>${arrow}`;
}

/**
 * Construye el correo Lanzadera. No envía.
 */
export function buildLanzaderaOutreachEmail(
  options?: BuildLanzaderaOptions
): LanzaderaOutreachContent {
  const B = LANZADERA_EMAIL_BRAND;
  const font = "Arial, Helvetica, 'Helvetica Neue', sans-serif";
  const imageMode: LanzaderaImageMode = options?.imageMode ?? 'send';

  const logoUrl = escapeHtml(LANZADERA_LOGO_URL);
  const photoResolved =
    imageMode === 'preview'
      ? resolveAppAsset(
          LANZADERA_PHOTO_LOCAL_PATH,
          'preview',
          options?.previewOrigin
        )
      : LANZADERA_PHOTO_PUBLIC_URL;
  const photoUrl = escapeHtml(photoResolved);

  const iconCatalog = escapeHtml(
    resolveAppAsset(
      LANZADERA_MODULE_ICON_PATHS.catalog,
      imageMode,
      options?.previewOrigin
    )
  );
  const iconOrders = escapeHtml(
    resolveAppAsset(
      LANZADERA_MODULE_ICON_PATHS.orders,
      imageMode,
      options?.previewOrigin
    )
  );
  const iconKiosk = escapeHtml(
    resolveAppAsset(
      LANZADERA_MODULE_ICON_PATHS.kiosk,
      imageMode,
      options?.previewOrigin
    )
  );
  const iconAssistant = escapeHtml(
    resolveAppAsset(
      LANZADERA_MODULE_ICON_PATHS.assistant,
      imageMode,
      options?.previewOrigin
    )
  );

  const moduleCard = (iconSrc: string, title: string, body: string) => `
                  <td class="ff-module-cell" width="50%" valign="top" style="padding:4px;font-family:${font};">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;height:100%;">
                      <tr>
                        <td height="220" valign="top" style="background-color:${B.grayBg};border:1px solid ${B.silver};border-radius:12px;padding:18px 14px 16px 14px;text-align:center;font-family:${font};">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="border-collapse:collapse;margin:0 auto 12px auto;">
                            <tr>
                              <td width="80" height="80" align="center" valign="middle" bgcolor="${B.turquoiseSoft}" style="width:80px;height:80px;background-color:${B.turquoiseSoft};border-radius:40px;-webkit-border-radius:40px;text-align:center;vertical-align:middle;line-height:80px;">
                                <img src="${iconSrc}" width="44" height="44" alt="" style="display:inline-block;border:0;outline:none;width:44px;height:44px;max-width:44px;object-fit:contain;vertical-align:middle;" />
                              </td>
                            </tr>
                          </table>
                          <div style="font-size:14px;font-weight:700;color:${B.header};margin:0 0 8px 0;line-height:1.3;">${title}</div>
                          <div style="font-size:12px;line-height:1.5;color:${B.muted};">${body}</div>
                        </td>
                      </tr>
                    </table>
                  </td>`;

  // No <base>: las imágenes de preview van como URL absolutas http locales.
  // Un base https://localhost (proto mal inferido) rompía todos los /images/...

  const html = `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>FarmaFácil · Lanzadera</title>
  <style type="text/css">
    @media only screen and (max-width: 520px) {
      .ff-roadmap-desktop { width: 100% !important; }
      .ff-roadmap-desktop td { display: block !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; padding: 0 0 8px 0 !important; }
      .ff-roadmap-arrow { display: none !important; max-height: 0 !important; overflow: hidden !important; font-size: 0 !important; line-height: 0 !important; }
      .ff-modules-grid { width: 100% !important; }
      .ff-module-cell { display: block !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
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
</head>
<body style="margin:0;padding:0;background-color:${B.grayBg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- ff-lanzadera-outreach-v3 -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    FarmaFácil: avances del proyecto e incorporación a Lanzadera en marzo de 2027.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;background-color:${B.grayBg};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;width:100%;max-width:600px;background-color:${B.card};border:1px solid ${B.silver};">

          <!-- Cabecera negra compacta -->
          <tr>
            <td align="center" style="background-color:${B.header};padding:22px 24px 18px 24px;text-align:center;">
              <img src="${logoUrl}" width="100" height="100" alt="FarmaFácil" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:100px;height:100px;max-width:100px;object-fit:contain;" />
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
          </tr>

          <!-- Presentación -->
          <tr>
            <td style="padding:32px 28px 8px 28px;font-family:${font};color:${B.text};">
              <h1 style="margin:0 0 18px 0;font-family:${font};font-size:22px;line-height:1.35;font-weight:700;color:${B.header};">
                FarmaFácil: digitalización útil para la farmacia de oficina
              </h1>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Estimado equipo de Lanzadera:
              </p>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Quería compartir con vosotros los avances de FarmaFácil y conocer vuestra
                valoración sobre nuestra posible incorporación a Lanzadera en marzo de 2027.
              </p>
              <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:${B.text};">
                FarmaFácil es una solución SaaS dirigida a farmacias, diseñada para mejorar
                la experiencia del cliente y facilitar su digitalización mediante un catálogo
                digital, la gestión de pedidos, un kiosko de autoservicio y un asistente virtual
                con inteligencia artificial.
              </p>
            </td>
          </tr>

          <!-- Cuatro funcionalidades · cuadrícula 2×2 -->
          <tr>
            <td style="padding:12px 20px 8px 20px;font-family:${font};">
              <table class="ff-modules-grid" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;width:100%;">
                <tr>
                  ${moduleCard(
                    iconCatalog,
                    'Catálogo digital QR',
                    'Productos y servicios al alcance del cliente, con acceso inmediato mediante QR.'
                  )}
                  ${moduleCard(
                    iconOrders,
                    'Pedidos online',
                    'Tus clientes solicitan sus productos fácilmente, desde cualquier lugar y sin esperas.'
                  )}
                </tr>
                <tr>
                  ${moduleCard(
                    iconKiosk,
                    'Kiosko de autoservicio',
                    'Una experiencia de compra ágil, intuitiva y sin colas, directamente en la farmacia.'
                  )}
                  ${moduleCard(
                    iconAssistant,
                    'Asistente virtual con IA',
                    'Información, orientación personalizada y apoyo al farmacéutico, siempre a un clic.'
                  )}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Estado actual -->
          <tr>
            <td style="padding:16px 28px 8px 28px;font-family:${font};color:${B.text};">
              <p style="margin:0 0 12px 0;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${B.turquoiseHover};">
                Estado actual
              </p>
              <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Actualmente contamos con una primera plataforma desplegada en producción,
                funcionalidades de catálogo y pedidos desarrolladas, y una aplicación Android
                para el kiosko en fase de pruebas.
              </p>
              <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Además, hemos realizado <strong>27 encuestas a farmacias</strong> para validar
                sus necesidades y orientar nuestra propuesta comercial.
              </p>
            </td>
          </tr>

          <!-- 27 encuestas -->
          <tr>
            <td style="padding:8px 28px 8px 28px;font-family:${font};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;background-color:${B.header};">
                <tr>
                  <td width="88" align="center" valign="middle" style="padding:20px 8px 20px 16px;">
                    <div style="font-family:${font};font-size:36px;font-weight:700;color:${B.turquoise};line-height:1;">27</div>
                  </td>
                  <td valign="middle" style="padding:18px 20px 18px 8px;font-family:${font};">
                    <div style="font-size:15px;font-weight:700;color:${B.white};margin:0 0 4px 0;">Encuestas realizadas</div>
                    <div style="font-size:13px;line-height:1.5;color:${B.silverDark};">
                      Conversaciones con farmacias para contrastar necesidades y orientar
                      la propuesta. No equivalen a ventas ni a validación comercial definitiva.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hoja de ruta · 5 etapas horizontales -->
          <tr>
            <td style="padding:24px 20px 8px 20px;font-family:${font};color:${B.text};">
              <p style="margin:0 0 6px 16px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${B.turquoiseHover};">
                Hoja de ruta
              </p>
              <p style="margin:0 0 14px 16px;font-size:13px;line-height:1.5;color:${B.muted};">
                Objetivos previstos para los próximos meses (no resultados garantizados):
              </p>
              <table class="ff-roadmap-desktop" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                <tr>
                  ${roadmapStageCell({
                    label: 'NOV 2026',
                    text: 'Completar y estabilizar el MVP',
                    bg: B.turquoiseSoft,
                    accent: B.turquoise,
                  })}
                  ${roadmapStageCell({
                    label: 'DIC 2026',
                    text: 'Iniciar cinco pilotos con farmacias',
                    bg: B.turquoiseSoft,
                    accent: B.turquoise,
                  })}
                  ${roadmapStageCell({
                    label: 'ENE 2027',
                    text: 'Analizar resultados e introducir mejoras',
                    bg: B.turquoiseSoft,
                    accent: B.turquoise,
                  })}
                  ${roadmapStageCell({
                    label: 'FEB 2027',
                    text: 'Comercialización y primeras suscripciones',
                    bg: B.turquoiseSoft,
                    accent: B.turquoise,
                  })}
                  ${roadmapStageCell({
                    label: 'MAR 2027',
                    text: 'Objetivo de incorporación a Lanzadera',
                    bg: B.turquoiseSoftStrong,
                    accent: B.turquoiseHover,
                    isLast: true,
                  })}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cierre aprobado -->
          <tr>
            <td style="padding:20px 28px 24px 28px;font-family:${font};color:${B.text};">
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Creemos que marzo sería un momento especialmente interesante para contar con
                vuestro acompañamiento, ya que necesitaríamos apoyo en la validación comercial,
                la estrategia de crecimiento y la preparación para una expansión nacional.
              </p>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${B.text};">
                ¿Consideráis que esta fase de madurez encaja con el programa de marzo o
                recomendaríais esperar a septiembre?
              </p>
              <p style="margin:0 0 6px 0;font-size:15px;line-height:1.6;color:${B.text};">
                Muchas gracias por vuestro tiempo y orientación.
              </p>
              <p style="margin:0;font-size:15px;line-height:1.6;color:${B.text};">
                Un saludo,
              </p>
            </td>
          </tr>

          <!-- Firma con foto circular -->
          <tr>
            <td style="padding:0 28px 28px 28px;font-family:${font};">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td valign="middle" width="80" style="padding-right:16px;">
                    <img src="${photoUrl}" width="80" height="80" alt="" style="display:block;border:0;outline:none;text-decoration:none;width:80px;height:80px;border-radius:40px;-webkit-border-radius:40px;" />
                  </td>
                  <td valign="middle" style="font-family:${font};color:${B.text};">
                    <div style="font-size:16px;font-weight:700;color:${B.header};line-height:1.35;">Pilar Reyes Bononat</div>
                    <div style="font-size:13px;color:${B.muted};margin-top:3px;line-height:1.4;">Fundadora de FarmaFácil</div>
                    <div style="font-size:13px;margin-top:8px;line-height:1.45;">
                      <a href="mailto:pilar@farmafacil.solutions" style="color:${B.turquoiseHover};text-decoration:none;">pilar@farmafacil.solutions</a>
                    </div>
                    <div style="font-size:13px;margin-top:2px;line-height:1.45;">
                      <a href="https://www.farmafacil.solutions" style="color:${B.turquoiseHover};text-decoration:none;">www.farmafacil.solutions</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Pie negro -->
          <tr>
            <td align="center" style="background-color:${B.header};padding:20px 24px;font-family:${font};font-size:12px;line-height:1.55;color:${B.silverDark};text-align:center;">
              <strong style="color:${B.white};">FarmaFácil</strong><br />
              Tu farmacia, más cerca de tus clientes.<br />
              <a href="https://www.farmafacil.solutions" style="color:${B.turquoise};text-decoration:none;">www.farmafacil.solutions</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = [
    'FarmaFácil: digitalización útil para la farmacia de oficina',
    '',
    'Estimado equipo de Lanzadera:',
    '',
    'Quería compartir con vosotros los avances de FarmaFácil y conocer vuestra valoración sobre nuestra posible incorporación a Lanzadera en marzo de 2027.',
    '',
    'FarmaFácil es una solución SaaS dirigida a farmacias, diseñada para mejorar la experiencia del cliente y facilitar su digitalización mediante un catálogo digital, la gestión de pedidos, un kiosko de autoservicio y un asistente virtual con inteligencia artificial.',
    '',
    '- Catálogo digital QR: productos y servicios al alcance del cliente, con acceso inmediato mediante QR.',
    '- Pedidos online: tus clientes solicitan sus productos fácilmente, desde cualquier lugar y sin esperas.',
    '- Kiosko de autoservicio: una experiencia de compra ágil, intuitiva y sin colas, directamente en la farmacia.',
    '- Asistente virtual con IA: información, orientación personalizada y apoyo al farmacéutico, siempre a un clic.',
    '',
    'Estado actual:',
    'Actualmente contamos con una primera plataforma desplegada en producción, funcionalidades de catálogo y pedidos desarrolladas, y una aplicación Android para el kiosko en fase de pruebas.',
    '',
    'Además, hemos realizado 27 encuestas a farmacias para validar sus necesidades y orientar nuestra propuesta comercial.',
    '',
    'Hoja de ruta (objetivos previstos, no resultados garantizados):',
    '- Noviembre de 2026: completar y estabilizar el MVP.',
    '- Diciembre de 2026: iniciar cinco pilotos con farmacias.',
    '- Enero de 2027: analizar los resultados e introducir mejoras.',
    '- Febrero de 2027: comenzar la comercialización y las primeras suscripciones.',
    '- Marzo de 2027: objetivo de incorporación a Lanzadera.',
    '',
    'Creemos que marzo sería un momento especialmente interesante para contar con vuestro acompañamiento, ya que necesitaríamos apoyo en la validación comercial, la estrategia de crecimiento y la preparación para una expansión nacional.',
    '',
    '¿Consideráis que esta fase de madurez encaja con el programa de marzo o recomendaríais esperar a septiembre?',
    '',
    'Muchas gracias por vuestro tiempo y orientación.',
    '',
    'Un saludo,',
    '',
    'Pilar Reyes Bononat',
    'Fundadora de FarmaFácil',
    'pilar@farmafacil.solutions',
    'www.farmafacil.solutions',
  ].join('\n');

  return {
    subject: LANZADERA_EMAIL_SUBJECT,
    html,
    text,
    from: LANZADERA_EMAIL_FROM,
    replyTo: LANZADERA_EMAIL_REPLY_TO,
    imageMode,
    photoUrl: photoResolved,
    sendEnabled: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Preparación Resend (sin envío hasta autorización)                          */
/* -------------------------------------------------------------------------- */

/**
 * Interruptor de producto. Permanecer false hasta autorización expresa.
 */
export const LANZADERA_PRODUCT_SEND_ENABLED = false;

/** URLs HTTPS del HTML de envío. */
export const LANZADERA_SEND_PUBLIC_ASSETS = {
  logo: LANZADERA_LOGO_URL,
  photo: LANZADERA_PHOTO_PUBLIC_URL,
  iconCatalog: `${APP_PUBLIC_ORIGIN}${LANZADERA_MODULE_ICON_PATHS.catalog}`,
  iconOrders: `${APP_PUBLIC_ORIGIN}${LANZADERA_MODULE_ICON_PATHS.orders}`,
  iconKiosk: `${APP_PUBLIC_ORIGIN}${LANZADERA_MODULE_ICON_PATHS.kiosk}`,
  iconAssistant: `${APP_PUBLIC_ORIGIN}${LANZADERA_MODULE_ICON_PATHS.assistant}`,
} as const;

export type LanzaderaAssetCheck = {
  url: string;
  ok: boolean;
  status: number | null;
  contentType: string | null;
};

export type LanzaderaAssetsReport = {
  ready: boolean;
  checks: LanzaderaAssetCheck[];
  blocking: string[];
};

/** Comprueba assets públicos. No publica ni envía. */
export async function checkLanzaderaPublicAssets(
  fetchImpl: typeof fetch = fetch
): Promise<LanzaderaAssetsReport> {
  const checks: LanzaderaAssetCheck[] = [];
  for (const url of Object.values(LANZADERA_SEND_PUBLIC_ASSETS)) {
    try {
      const res = await fetchImpl(url, { method: 'GET', redirect: 'follow' });
      const contentType = res.headers.get('content-type');
      const ok =
        res.ok &&
        Boolean(contentType && contentType.toLowerCase().includes('image/'));
      checks.push({ url, ok, status: res.status, contentType });
    } catch {
      checks.push({ url, ok: false, status: null, contentType: null });
    }
  }
  const blocking = checks.filter((c) => !c.ok).map((c) => c.url);
  return { ready: blocking.length === 0, checks, blocking };
}

export type LanzaderaResendPayload = {
  from: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  sendEnabled: boolean;
  assetsReady: boolean;
  assetReport: LanzaderaAssetsReport;
};

/** Payload Resend definitivo (imageMode send). No envía. */
export async function prepareLanzaderaResendPayload(
  fetchImpl?: typeof fetch
): Promise<LanzaderaResendPayload> {
  const mail = buildLanzaderaOutreachEmail({ imageMode: 'send' });
  const assetReport = await checkLanzaderaPublicAssets(fetchImpl);

  if (
    mail.html.includes('127.0.0.1') ||
    mail.html.includes('localhost') ||
    /src="\/images\//.test(mail.html)
  ) {
    throw new Error(
      'HTML de envío Lanzadera contiene rutas locales; abortado.'
    );
  }

  if (
    mail.from !== LANZADERA_EMAIL_FROM ||
    mail.replyTo !== LANZADERA_EMAIL_REPLY_TO
  ) {
    throw new Error(
      'From/Reply-To Lanzadera no coinciden con la configuración aprobada.'
    );
  }

  return {
    from: mail.from,
    replyTo: mail.replyTo,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    sendEnabled: LANZADERA_PRODUCT_SEND_ENABLED,
    assetsReady: assetReport.ready,
    assetReport,
  };
}

export type LanzaderaTestSendInput = {
  to: string;
  authorizeSend: boolean;
  confirmPhrase: string;
};

export type LanzaderaTestSendResult =
  | { ok: true; id?: string }
  | {
      ok: false;
      error: string;
      code:
        | 'disabled'
        | 'not_authorized'
        | 'assets_not_ready'
        | 'invalid_to'
        | 'send_failed'
        | 'not_configured';
    };

/**
 * Prueba de envío vía Resend existente (`sendTransactionalEmail`).
 * Bloqueada mientras LANZADERA_PRODUCT_SEND_ENABLED === false.
 * No modifica EMAIL_FROM.
 */
export async function sendLanzaderaTestEmail(
  input: LanzaderaTestSendInput
): Promise<LanzaderaTestSendResult> {
  const to = input.to?.trim();
  if (!to || !to.includes('@')) {
    return { ok: false, error: 'Destinatario inválido.', code: 'invalid_to' };
  }

  if (
    input.authorizeSend !== true ||
    input.confirmPhrase !== 'LANZADERA_TEST_SEND'
  ) {
    return {
      ok: false,
      error:
        'Envío Lanzadera bloqueado: falta autorización expresa (authorizeSend + confirmPhrase).',
      code: 'not_authorized',
    };
  }

  if (!LANZADERA_PRODUCT_SEND_ENABLED) {
    return {
      ok: false,
      error:
        'Envío Lanzadera deshabilitado (LANZADERA_PRODUCT_SEND_ENABLED=false). Autoriza el cambio de bandera y la publicación de la foto antes de probar.',
      code: 'disabled',
    };
  }

  const payload = await prepareLanzaderaResendPayload();
  if (!payload.assetsReady) {
    return {
      ok: false,
      error: `Assets públicos no listos: ${payload.assetReport.blocking.join(', ')}`,
      code: 'assets_not_ready',
    };
  }

  // Import dinámico: evita acoplar el módulo de plantilla a Resend en tests.
  // En Node ESM puro usar createRequire('./send.ts'); Next/bundler resuelve './send'.
  const { sendTransactionalEmail } = await import('./send');
  const result = await sendTransactionalEmail({
    to,
    subject: `[PRUEBA] ${payload.subject}`,
    html: payload.html,
    text: payload.text,
    from: LANZADERA_EMAIL_FROM,
    replyTo: LANZADERA_EMAIL_REPLY_TO,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      code: result.code === 'not_configured' ? 'not_configured' : 'send_failed',
    };
  }

  return { ok: true, id: result.id };
}
