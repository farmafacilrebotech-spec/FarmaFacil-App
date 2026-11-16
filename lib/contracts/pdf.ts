import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage } from 'pdf-lib';

import { commercialOfferLabel } from './offer-label.ts';
import type { ContractPreviewModel } from './types.ts';

const LOGO_RELATIVE = 'public/images/logos/farmafacil-logo-512.png';

/** A4 */
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 48;
const MARGIN_TOP = 52;
/** Espacio reservado para pie (referencia + página); evita cortar checklist. */
const MARGIN_BOTTOM = 68;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

/** Identidad FarmaFácil (referencia estética; no contenido ficticio). */
const TEAL = rgb(0x1a / 255, 0xbb / 255, 0xb3 / 255); // #1ABBB3
const TEAL_SOFT = rgb(0xe6 / 255, 0xf7 / 255, 0xf6 / 255);
const TEAL_HEADER = rgb(0xd4 / 255, 0xf1 / 255, 0xef / 255);
const NAVY = rgb(0x0b / 255, 0x3a / 255, 0x5c / 255);
const INK = rgb(0x1a / 255, 0x24 / 255, 0x2e / 255);
const MUTED = rgb(0x5a / 255, 0x6a / 255, 0x76 / 255);
const WARN = rgb(0x8a / 255, 0x55 / 255, 0x0a / 255);
const WARN_BG = rgb(0xff / 255, 0xf6 / 255, 0xe8 / 255);
const LINE = rgb(0xd7 / 255, 0xe4 / 255, 0xe3 / 255);
const WHITE = rgb(1, 1, 1);

type Fonts = { regular: PDFFont; bold: PDFFont };

function wrapLines(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const paragraphs = text.split(/\n/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        if (font.widthOfTextAtSize(word, size) <= maxWidth) {
          current = word;
        } else {
          // Palabra demasiado larga: cortar
          let chunk = '';
          for (const ch of word) {
            const tryChunk = chunk + ch;
            if (font.widthOfTextAtSize(tryChunk, size) <= maxWidth) {
              chunk = tryChunk;
            } else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          current = chunk;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

async function embedCircularLogo(
  pdf: PDFDocument,
  cwd: string = process.cwd()
): Promise<{
  draw: (page: PDFPage, x: number, y: number, size: number) => void;
} | null> {
  try {
    const bytes = await readFile(path.join(cwd, LOGO_RELATIVE));
    const png = await pdf.embedPng(bytes);
    const iw = png.width;
    const ih = png.height;
    return {
      draw: (page, x, y, size) => {
        const scale = size / Math.max(iw, ih);
        const w = iw * scale;
        const h = ih * scale;
        page.drawImage(png, {
          x: x + (size - w) / 2,
          y: y + (size - h) / 2,
          width: w,
          height: h,
        });
      },
    };
  } catch {
    return null;
  }
}

type BodySection = { title: string | null; paragraphs: string[] };

/**
 * Parte el cuerpo contractual aprobado en apartados sin alterar el texto.
 * Detecta títulos numerados / «Condiciones generales» / «Aceptación y firmas».
 */
function splitBodySections(filledBody: string): BodySection[] {
  const rawBlocks = filledBody
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const sections: BodySection[] = [];
  let current: BodySection = { title: null, paragraphs: [] };

  const isHeading = (block: string): string | null => {
    const first = block.split('\n')[0]?.trim() ?? '';
    if (/^\d+\.\s+\S/.test(first)) return first;
    if (/^Condiciones generales del servicio$/i.test(first)) return first;
    if (/^Aceptación y firmas$/i.test(first)) return first;
    if (/^Uso autorizado$/i.test(first)) return first;
    if (/^Disponibilidad y soporte$/i.test(first)) return first;
    if (/^Uso, daños y devolución$/i.test(first)) return first;
    if (/^Coste de personalización$/i.test(first)) return first;
    if (/^Confirmación de los importes$/i.test(first)) return first;
    if (/^POR EL PROVEEDOR$/i.test(first)) return first;
    if (/^POR LA FARMACIA$/i.test(first)) return first;
    if (/^Observaciones o condiciones particulares/i.test(first)) {
      return 'Observaciones o condiciones particulares aceptadas por ambas partes';
    }
    if (/^Checklist de cierre\b/i.test(first)) return 'Checklist de cierre';
    if (/^Versión de plantilla:/i.test(first)) return 'Versión de plantilla';
    return null;
  };

  for (const block of rawBlocks) {
    const first = block.split('\n')[0]?.trim() ?? '';
    const heading = isHeading(block);
    if (heading) {
      if (current.title || current.paragraphs.length) sections.push(current);
      let rest = '';
      if (/^Checklist de cierre\b/i.test(first)) {
        const afterColon = first.replace(/^Checklist de cierre\s*:?\s*/i, '').trim();
        const more = block.split('\n').slice(1).join('\n').trim();
        rest = [afterColon, more].filter(Boolean).join('\n');
      } else if (/^Versión de plantilla:/i.test(first)) {
        rest = block.replace(/^Versión de plantilla:\s*/i, '').trim();
      } else if (/^Observaciones o condiciones particulares/i.test(first)) {
        rest = block
          .replace(
            /^Observaciones o condiciones particulares aceptadas por ambas partes:\s*/i,
            ''
          )
          .trim();
      } else {
        rest = block.slice(heading.length).replace(/^\n+/, '').trim();
      }
      current = {
        title: heading,
        paragraphs: rest ? [rest] : [],
      };
    } else {
      current.paragraphs.push(block);
    }
  }
  if (current.title || current.paragraphs.length) sections.push(current);
  return sections;
}

function dash(value: string | null | undefined): string {
  const v = value?.trim();
  return v && v.length > 0 ? v : '—';
}

type LayoutCtx = {
  pdf: PDFDocument;
  fonts: Fonts;
  logo: Awaited<ReturnType<typeof embedCircularLogo>>;
  asDraft: boolean;
  reference: string;
  pages: PDFPage[];
  page: PDFPage;
  y: number;
};

function newPage(ctx: LayoutCtx): void {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.pages.push(ctx.page);
  ctx.y = PAGE_H - MARGIN_TOP;
  if (ctx.asDraft) drawDraftWatermark(ctx.page, ctx.fonts.bold);
}

function ensureSpace(ctx: LayoutCtx, need: number): void {
  if (ctx.y - need < MARGIN_BOTTOM + 8) {
    newPage(ctx);
  }
}

function drawTealRule(ctx: LayoutCtx, y?: number): void {
  const yy = y ?? ctx.y;
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: yy,
    width: CONTENT_W,
    height: 2.2,
    color: TEAL,
  });
}

function drawTextLine(
  ctx: LayoutCtx,
  text: string,
  opts: {
    x?: number;
    maxWidth?: number;
    size?: number;
    bold?: boolean;
    color?: ReturnType<typeof rgb>;
    gapAfter?: number;
  } = {}
): void {
  const size = opts.size ?? 10;
  const font = opts.bold ? ctx.fonts.bold : ctx.fonts.regular;
  const color = opts.color ?? INK;
  const x = opts.x ?? MARGIN_X;
  const maxWidth = opts.maxWidth ?? CONTENT_W;
  const gapAfter = opts.gapAfter ?? size * 1.35;
  const lines = wrapLines(text, font, size, maxWidth);
  for (const line of lines) {
    ensureSpace(ctx, gapAfter + 2);
    if (line) {
      ctx.page.drawText(line, { x, y: ctx.y, size, font, color });
    }
    ctx.y -= gapAfter;
  }
}

function drawSectionTitle(ctx: LayoutCtx, title: string, keepWith = 52): void {
  const size = 12;
  // Mantener título + primeras líneas del cuerpo en la misma página
  ensureSpace(ctx, 16 + keepWith);
  ctx.y -= 6;
  ctx.page.drawText(title, {
    x: MARGIN_X,
    y: ctx.y,
    size,
    font: ctx.fonts.bold,
    color: NAVY,
  });
  ctx.y -= 8;
  drawTealRule(ctx, ctx.y);
  ctx.y -= 14;
}

function drawKeyValueGrid(
  ctx: LayoutCtx,
  rows: Array<[string, string]>,
  cols = 2
): void {
  const gap = 10;
  const colW = (CONTENT_W - gap * (cols - 1)) / cols;
  const rowH = 38;
  let i = 0;
  while (i < rows.length) {
    const slice = rows.slice(i, i + cols);
    ensureSpace(ctx, rowH + 6);
    for (let c = 0; c < slice.length; c++) {
      const [label, value] = slice[c]!;
      const x = MARGIN_X + c * (colW + gap);
      ctx.page.drawRectangle({
        x,
        y: ctx.y - rowH + 8,
        width: colW,
        height: rowH,
        color: WHITE,
        borderColor: LINE,
        borderWidth: 0.8,
      });
      ctx.page.drawText(label.toUpperCase(), {
        x: x + 10,
        y: ctx.y - 6,
        size: 7.5,
        font: ctx.fonts.bold,
        color: TEAL,
      });
      const valueLines = wrapLines(value, ctx.fonts.bold, 10, colW - 20);
      ctx.page.drawText(valueLines[0] ?? '—', {
        x: x + 10,
        y: ctx.y - 22,
        size: 10,
        font: ctx.fonts.bold,
        color: NAVY,
      });
    }
    ctx.y -= rowH + 8;
    i += cols;
  }
}

function drawAmountTable(
  ctx: LayoutCtx,
  title: string,
  rows: Array<[string, string]>,
  highlight = false
): void {
  const headerH = 22;
  const rowH = 18;
  const tableH = headerH + rows.length * rowH + 8;
  ensureSpace(ctx, tableH + 28);

  drawTextLine(ctx, title, {
    bold: true,
    size: 10.5,
    color: NAVY,
    gapAfter: 12,
  });

  const top = ctx.y;
  const boxH = headerH + rows.length * rowH + 4;
  if (highlight) {
    ctx.page.drawRectangle({
      x: MARGIN_X,
      y: top - boxH + 4,
      width: CONTENT_W,
      height: boxH,
      color: TEAL_SOFT,
    });
  }

  // Header
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: top - headerH,
    width: CONTENT_W,
    height: headerH,
    color: TEAL_HEADER,
  });
  ctx.page.drawText('Concepto', {
    x: MARGIN_X + 10,
    y: top - 15,
    size: 9,
    font: ctx.fonts.bold,
    color: NAVY,
  });
  ctx.page.drawText('Importe', {
    x: MARGIN_X + CONTENT_W - 110,
    y: top - 15,
    size: 9,
    font: ctx.fonts.bold,
    color: NAVY,
  });

  let yy = top - headerH;
  for (const [concept, amount] of rows) {
    yy -= rowH;
    ctx.page.drawLine({
      start: { x: MARGIN_X, y: yy + rowH },
      end: { x: MARGIN_X + CONTENT_W, y: yy + rowH },
      thickness: 0.4,
      color: LINE,
    });
    const conceptLines = wrapLines(concept, ctx.fonts.regular, 9, CONTENT_W - 130);
    ctx.page.drawText(conceptLines[0] ?? concept, {
      x: MARGIN_X + 10,
      y: yy + 5,
      size: 9,
      font: ctx.fonts.regular,
      color: INK,
    });
    ctx.page.drawText(amount, {
      x: MARGIN_X + CONTENT_W - 110,
      y: yy + 5,
      size: 9,
      font: ctx.fonts.bold,
      color: NAVY,
    });
  }
  ctx.y = yy - 14;
}

function drawSignatureBlock(
  ctx: LayoutCtx,
  title: string,
  lines: Array<[string, string]>,
  locked: boolean
): void {
  const boxH = 132;
  ensureSpace(ctx, boxH + 16);
  const top = ctx.y;

  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: top - boxH,
    width: CONTENT_W,
    height: boxH,
    color: WHITE,
    borderColor: TEAL,
    borderWidth: 1.4,
  });
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: top - 22,
    width: CONTENT_W,
    height: 22,
    color: TEAL_SOFT,
  });
  ctx.page.drawText(title, {
    x: MARGIN_X + 12,
    y: top - 15,
    size: 10.5,
    font: ctx.fonts.bold,
    color: NAVY,
  });

  let yy = top - 38;
  for (const [label, value] of lines) {
    ctx.page.drawText(`${label}:`, {
      x: MARGIN_X + 12,
      y: yy,
      size: 9,
      font: ctx.fonts.regular,
      color: MUTED,
    });
    ctx.page.drawText(dash(value), {
      x: MARGIN_X + 118,
      y: yy,
      size: 9,
      font: ctx.fonts.bold,
      color: INK,
    });
    yy -= 14;
  }

  yy -= 6;
  ctx.page.drawText('Firma:', {
    x: MARGIN_X + 12,
    y: yy,
    size: 9,
    font: ctx.fonts.regular,
    color: MUTED,
  });
  ctx.page.drawLine({
    start: { x: MARGIN_X + 55, y: yy - 2 },
    end: { x: MARGIN_X + CONTENT_W - 20, y: yy - 2 },
    thickness: 0.8,
    color: LINE,
  });

  if (locked) {
    ctx.page.drawRectangle({
      x: MARGIN_X + 12,
      y: top - boxH + 10,
      width: CONTENT_W - 24,
      height: 18,
      color: WARN_BG,
    });
    ctx.page.drawText(
      'Firma bloqueada — faltan requisitos (BORRADOR no firmable).',
      {
        x: MARGIN_X + 18,
        y: top - boxH + 15,
        size: 8,
        font: ctx.fonts.bold,
        color: WARN,
      }
    );
  }

  ctx.y = top - boxH - 14;
}

function stampFooters(
  pages: PDFPage[],
  fonts: Fonts,
  reference: string,
  asDraft: boolean
): void {
  const total = pages.length;
  for (let i = 0; i < total; i++) {
    const page = pages[i]!;
    const label = `Página ${i + 1} de ${total}`;
    const ref = `Ref. ${reference}${asDraft ? ' · BORRADOR' : ''}`;
    page.drawLine({
      start: { x: MARGIN_X, y: 36 },
      end: { x: MARGIN_X + CONTENT_W, y: 36 },
      thickness: 0.8,
      color: TEAL,
    });
    page.drawText(ref, {
      x: MARGIN_X,
      y: 22,
      size: 7.5,
      font: fonts.regular,
      color: MUTED,
    });
    const w = fonts.regular.widthOfTextAtSize(label, 7.5);
    page.drawText(label, {
      x: MARGIN_X + CONTENT_W - w,
      y: 22,
      size: 7.5,
      font: fonts.regular,
      color: MUTED,
    });
  }
}

function drawDraftWatermark(page: PDFPage, fontBold: PDFFont) {
  const { width, height } = page.getSize();
  page.drawText('BORRADOR', {
    x: width / 2 - 110,
    y: height / 2 - 10,
    size: 56,
    font: fontBold,
    color: rgb(0.78, 0.62, 0.42),
    rotate: degrees(32),
    opacity: 0.055,
  });
}

function drawCoverHeader(
  ctx: LayoutCtx,
  preview: ContractPreviewModel
): void {
  const logoSize = 58;
  if (ctx.logo) {
    ctx.logo.draw(ctx.page, MARGIN_X, ctx.y - logoSize, logoSize);
  }

  const titleX = MARGIN_X + (ctx.logo ? logoSize + 16 : 0);
  ctx.page.drawText('FARMAFÁCIL', {
    x: titleX,
    y: ctx.y - 18,
    size: 11,
    font: ctx.fonts.bold,
    color: TEAL,
  });
  ctx.page.drawText('Contrato de servicios', {
    x: titleX,
    y: ctx.y - 38,
    size: 18,
    font: ctx.fonts.bold,
    color: NAVY,
  });
  ctx.page.drawText(
    `${preview.templateLabel} · ${preview.masterTemplateVersion}`,
    {
      x: titleX,
      y: ctx.y - 54,
      size: 9,
      font: ctx.fonts.regular,
      color: MUTED,
    }
  );

  ctx.y -= logoSize + 16;
  drawTealRule(ctx);
  ctx.y -= 16;

  if (ctx.asDraft) {
    ensureSpace(ctx, 36);
    ctx.page.drawRectangle({
      x: MARGIN_X,
      y: ctx.y - 28,
      width: CONTENT_W,
      height: 32,
      color: WARN_BG,
      borderColor: WARN,
      borderWidth: 0.8,
    });
    ctx.page.drawText('BORRADOR — No es un contrato definitivo ni firmable.', {
      x: MARGIN_X + 12,
      y: ctx.y - 12,
      size: 9.5,
      font: ctx.fonts.bold,
      color: WARN,
    });
    ctx.page.drawText(
      'Pendiente de datos legales y/o revisión jurídica. La firma permanece bloqueada.',
      {
        x: MARGIN_X + 12,
        y: ctx.y - 24,
        size: 8,
        font: ctx.fonts.regular,
        color: WARN,
      }
    );
    ctx.y -= 42;
  }

  drawTextLine(
    ctx,
    'La aceptación del presupuesto no firma este contrato ni activa el servicio.',
    { size: 8.5, color: MUTED, gapAfter: 14 }
  );
}

/**
 * PDF desde la plantilla maestra.
 * Si no está listo para firmar → siempre marcado como BORRADOR (no firmable).
 * Si se pide firmable con pendientes → lanza error.
 */
export async function buildContractPdfBytes(
  preview: ContractPreviewModel,
  opts?: { signable?: boolean; draft?: boolean; cwd?: string }
): Promise<Uint8Array> {
  if (!preview.filledBody.trim()) {
    throw new Error(
      'No hay texto de plantilla; no se puede generar el PDF.'
    );
  }

  const wantSignable = opts?.signable === true && opts?.draft !== true;
  if (wantSignable && !preview.canGenerateSignablePdf) {
    throw new Error(
      'No se puede emitir un PDF firmable: faltan datos legales, aprobación jurídica o marcadores pendientes.'
    );
  }

  const asDraft = !preview.readyForSignature || !wantSignable;

  const pdf = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const logo = await embedCircularLogo(pdf, opts?.cwd);
  const reference =
    preview.quoteReference?.trim() ||
    preview.quoteId ||
    preview.masterTemplateVersion;

  const first = pdf.addPage([PAGE_W, PAGE_H]);
  const ctx: LayoutCtx = {
    pdf,
    fonts,
    logo,
    asDraft,
    reference,
    pages: [first],
    page: first,
    y: PAGE_H - MARGIN_TOP,
  };
  if (asDraft) drawDraftWatermark(ctx.page, fonts.bold);

  // ——— Portada / resumen ———
  drawCoverHeader(ctx, preview);

  drawTextLine(ctx, 'Resumen del contrato', {
    bold: true,
    size: 13,
    color: NAVY,
    gapAfter: 10,
  });
  drawTealRule(ctx);
  ctx.y -= 14;

  const activationFromBody = preview.filledBody.match(
    /Fecha de activación:\s*([^\n]+)/i
  );
  const fechaInicio =
    activationFromBody?.[1]?.trim() || '[FECHA_ACTIVACION]';

  drawKeyValueGrid(ctx, [
    ['Referencia', dash(preview.quoteReference ?? preview.quoteId)],
    [
      'Farmacia',
      dash(preview.pharmacy.displayName ?? preview.pharmacy.legalName),
    ],
    ['Plan', dash(preview.amounts.planName)],
    ['Fecha de inicio', dash(fechaInicio)],
    ['Periodicidad', dash(preview.amounts.formatted.PERIODICIDAD)],
    ['Modalidad', dash(preview.templateLabel)],
  ]);

  ctx.y -= 4;
  ensureSpace(ctx, 40);
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - 28,
    width: CONTENT_W,
    height: 32,
    color: TEAL_SOFT,
  });
  ctx.page.drawText('Resumen de importes (snapshot del presupuesto aceptado)', {
    x: MARGIN_X + 12,
    y: ctx.y - 12,
    size: 10,
    font: fonts.bold,
    color: NAVY,
  });
  ctx.page.drawText(
    `Presupuesto ${dash(preview.quoteReference)} · snapshot v${preview.snapshotVersion} · IVA ${dash(preview.amounts.formatted.IVA_PCT)}`,
    {
      x: MARGIN_X + 12,
      y: ctx.y - 24,
      size: 8,
      font: fonts.regular,
      color: MUTED,
    }
  );
  ctx.y -= 40;

  const oneTimeRows: Array<[string, string]> = [
    ['Alta de aplicación', preview.amounts.formatted.CUOTA_ALTA],
    [
      'Personalización de kiosco',
      preview.amounts.formatted.PERSONALIZACION_KIOSCO,
    ],
    ['Total pagos únicos (neto)', preview.amounts.formatted.PAGO_UNICO_NETO],
    ['Total pagos únicos (con IVA)', preview.amounts.formatted.PAGO_UNICO_IVA],
  ];
  drawAmountTable(ctx, 'Pagos únicos', oneTimeRows, true);

  const recurringRows: Array<[string, string]> = [
    [
      `Cuota de software / plan (${preview.amounts.formatted.PERIODICIDAD})`,
      preview.amounts.formatted.PLAN_RECURRENTE,
    ],
    [
      'Alquiler de kiosco (si aplica)',
      preview.amounts.formatted.ALQUILER_KIOSCO,
    ],
    [
      `Total recurrente neto (${preview.amounts.formatted.PERIODICIDAD})`,
      preview.amounts.formatted.CUOTA_RECURRENTE,
    ],
    [
      `Total recurrente con IVA`,
      preview.amounts.formatted.CUOTA_RECURRENTE_IVA,
    ],
  ];
  drawAmountTable(ctx, 'Cuotas recurrentes', recurringRows, false);

  drawTextLine(
    ctx,
    'Los importes económicos de este documento proceden exclusivamente del presupuesto aceptado (snapshot). Las tablas de precios de documentos de referencia no son fuente de datos.',
    { size: 8, color: MUTED, gapAfter: 12 }
  );

  // Portada = solo resumen; partes y condiciones empiezan en página nueva.
  newPage(ctx);

  // ——— Cuerpo contractual (texto aprobado) ———
  const sections = splitBodySections(preview.filledBody);
  const signatureTitles = new Set(['POR EL PROVEEDOR', 'POR LA FARMACIA']);
  const skipCoverNoise = (title: string | null, paragraphs: string[]) => {
    // Evitar repetir el front-matter tipográfico de la plantilla en la portada visual
    if (!title && paragraphs[0]?.startsWith('Contrato de servicios FarmaFácil')) {
      return true;
    }
    return false;
  };

  let deferredSignatures: BodySection[] = [];
  let inSignatureTail = false;
  const conditionSections: BodySection[] = [];

  for (const section of sections) {
    if (skipCoverNoise(section.title, section.paragraphs)) continue;
    if (
      section.title === 'Aceptación y firmas' ||
      (section.title && signatureTitles.has(section.title)) ||
      inSignatureTail
    ) {
      inSignatureTail = true;
      deferredSignatures.push(section);
      continue;
    }
    conditionSections.push(section);
  }

  // Partes + servicios primero; resto de condiciones después
  for (const section of conditionSections) {
    if (section.title) {
      drawSectionTitle(ctx, section.title);
    } else {
      ctx.y -= 4;
    }
    for (const para of section.paragraphs) {
      // Listas tipo «Clave: valor» con algo más de aire
      const lines = para.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          ctx.y -= 4;
          continue;
        }
        drawTextLine(ctx, trimmed, {
          size: 9.5,
          color: INK,
          gapAfter: 12.5,
        });
      }
      ctx.y -= 4;
    }
    ctx.y -= 6;
  }

  // ——— Firmas (título + intro + primer bloque juntos; evita huérfanos) ———
  ensureSpace(ctx, 210);
  drawSectionTitle(ctx, 'Aceptación y firmas', 180);

  const acceptanceIntro = deferredSignatures.find(
    (s) => s.title === 'Aceptación y firmas'
  );
  if (acceptanceIntro) {
    for (const para of acceptanceIntro.paragraphs) {
      drawTextLine(ctx, para, { size: 9.5, gapAfter: 12.5 });
      ctx.y -= 2;
    }
  } else {
    for (const s of deferredSignatures) {
      if (!s.title) {
        for (const para of s.paragraphs) {
          drawTextLine(ctx, para, { size: 9.5, gapAfter: 12.5 });
        }
      }
    }
  }

  ctx.y -= 4;
  drawSignatureBlock(
    ctx,
    'POR EL PROVEEDOR',
    [
      ['Razón social', preview.farmafacil.legalName],
      ['Nombre', preview.farmafacil.representativeName],
      ['Cargo', preview.farmafacil.representativeTitle],
      ['NIF/DNI', preview.farmafacil.representativeNif],
    ],
    asDraft
  );
  drawSignatureBlock(
    ctx,
    'POR LA FARMACIA',
    [
      [
        'Farmacia / razón social',
        preview.pharmacy.legalName ?? preview.pharmacy.displayName,
      ],
      ['Nombre', preview.pharmacy.representativeName],
      ['Cargo/condición', preview.pharmacy.representativeTitle],
      ['NIF/DNI', preview.pharmacy.representativeNif],
    ],
    asDraft
  );

  // Observaciones / checklist / versión (texto aprobado restante)
  for (const s of deferredSignatures) {
    if (
      !s.title ||
      s.title === 'Aceptación y firmas' ||
      signatureTitles.has(s.title)
    ) {
      continue;
    }
    // Evitar reimprimir el bloque «Firma:» vacío del texto fuente
    if (/^Firma:?$/i.test(s.paragraphs.join('\n'))) continue;
    drawSectionTitle(ctx, s.title);
    for (const para of s.paragraphs) {
      if (/^Firma:?$/i.test(para.trim())) continue;
      drawTextLine(ctx, para, { size: 9.5, gapAfter: 12 });
    }
  }

  stampFooters(ctx.pages, fonts, reference, asDraft);
  return pdf.save();
}

export function contractPdfFilename(
  preview: ContractPreviewModel,
  opts?: { signable?: boolean }
): string {
  const ref = (preview.quoteReference ?? preview.quoteId).replace(
    /[^\w.-]+/g,
    '_'
  );
  const cif = (preview.pharmacy.cif ?? 'SIN_CIF').replace(/[^\w.-]+/g, '_');
  const draft =
    opts?.signable && preview.canGenerateSignablePdf ? '' : '_BORRADOR';
  return `Contrato_FarmaFacil_${preview.templateKey}_${cif}_${ref}${draft}.pdf`;
}
