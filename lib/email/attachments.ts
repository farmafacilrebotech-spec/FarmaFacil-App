/**
 * Validación de adjuntos corporativos (Fase B).
 * Binario → Storage privado `email-attachments`; metadatos en BD.
 */

export const EMAIL_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const EMAIL_ATTACHMENT_MAX_COUNT = 5;
export const EMAIL_ATTACHMENT_MAX_TOTAL_BYTES = 8 * 1024 * 1024;

export const EMAIL_ATTACHMENT_ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export type AllowedEmailAttachmentMime =
  (typeof EMAIL_ATTACHMENT_ALLOWED_MIME)[number];

const EXT_TO_MIME: Record<string, AllowedEmailAttachmentMime> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export type AttachmentMetaInput = {
  fileName: string;
  contentType: string;
  byteSize: number;
};

export function sanitizeAttachmentFileName(raw: string): string {
  const base = raw.replace(/[/\\]/g, '').trim();
  const cleaned = base.replace(/[^\w.\- ()áéíóúñÁÉÍÓÚÑ]+/gi, '_');
  return cleaned.slice(0, 180) || 'adjunto';
}

export function inferMimeFromFileName(
  fileName: string
): AllowedEmailAttachmentMime | null {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_MIME[ext] ?? null;
}

export function validateAttachmentMeta(
  input: AttachmentMetaInput
): { ok: true; fileName: string; contentType: AllowedEmailAttachmentMime; byteSize: number }
  | { ok: false; error: string } {
  const fileName = sanitizeAttachmentFileName(input.fileName);
  if (!fileName.includes('.')) {
    return { ok: false, error: `Adjunto «${fileName}»: extensión no permitida.` };
  }
  const inferred = inferMimeFromFileName(fileName);
  const contentType = (input.contentType || inferred || '').toLowerCase();
  if (
    !inferred ||
    !EMAIL_ATTACHMENT_ALLOWED_MIME.includes(
      contentType as AllowedEmailAttachmentMime
    )
  ) {
    return {
      ok: false,
      error: `Tipo no permitido para «${fileName}». Usa PDF, PNG, JPG o DOCX.`,
    };
  }
  if (inferred !== contentType && contentType) {
    // Preferir extensión canónica si el browser manda octet-stream raro
  }
  const mime = inferred;
  if (
    !Number.isFinite(input.byteSize) ||
    input.byteSize <= 0 ||
    input.byteSize > EMAIL_ATTACHMENT_MAX_BYTES
  ) {
    return {
      ok: false,
      error: `«${fileName}» supera el tamaño máximo (5 MB) o es inválido.`,
    };
  }
  return { ok: true, fileName, contentType: mime, byteSize: input.byteSize };
}

export function validateAttachmentBatch(
  items: AttachmentMetaInput[]
): { ok: true; items: Array<{ fileName: string; contentType: AllowedEmailAttachmentMime; byteSize: number }> }
  | { ok: false; error: string } {
  if (items.length > EMAIL_ATTACHMENT_MAX_COUNT) {
    return {
      ok: false,
      error: `Máximo ${EMAIL_ATTACHMENT_MAX_COUNT} adjuntos por envío.`,
    };
  }
  const out: Array<{
    fileName: string;
    contentType: AllowedEmailAttachmentMime;
    byteSize: number;
  }> = [];
  let total = 0;
  for (const item of items) {
    const v = validateAttachmentMeta(item);
    if (!v.ok) return v;
    total += v.byteSize;
    if (total > EMAIL_ATTACHMENT_MAX_TOTAL_BYTES) {
      return {
        ok: false,
        error: 'El tamaño total de adjuntos supera 8 MB.',
      };
    }
    out.push({
      fileName: v.fileName,
      contentType: v.contentType,
      byteSize: v.byteSize,
    });
  }
  return { ok: true, items: out };
}
