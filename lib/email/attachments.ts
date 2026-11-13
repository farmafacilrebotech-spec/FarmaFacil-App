/**
 * Validación de adjuntos corporativos (Fase B + 086).
 * Extensión + MIME declarado + magic bytes. Storage privado `email-attachments`.
 * Límites alineados con bucket y con Resend (payload razonable 1:1).
 */

export const EMAIL_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const EMAIL_ATTACHMENT_MAX_COUNT = 5;
export const EMAIL_ATTACHMENT_MAX_TOTAL_BYTES = 8 * 1024 * 1024;
/** Resend recomienda adjuntos moderados; tope duro de seguridad local. */
export const EMAIL_ATTACHMENT_RESEND_SAFE_TOTAL_BYTES = 20 * 1024 * 1024;

export const EMAIL_ATTACHMENT_ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
] as const;

export type AllowedEmailAttachmentMime =
  (typeof EMAIL_ATTACHMENT_ALLOWED_MIME)[number];

export type AttachmentSourceKind =
  | 'upload'
  | 'generated_quote'
  | 'generated_contract'
  | 'generated_invoice'
  | 'generated_other';

const EXT_TO_MIME: Record<string, AllowedEmailAttachmentMime> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
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

export function attachmentExtension(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ext || 'bin';
}

export function formatAttachmentBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function startsWithBytes(buf: Uint8Array, magic: number[]): boolean {
  if (buf.length < magic.length) return false;
  return magic.every((b, i) => buf[i] === b);
}

function bufferHasAscii(buf: Uint8Array, ascii: string, maxScan = 8192): boolean {
  const limit = Math.min(buf.length, maxScan);
  const slice = buf.subarray(0, limit);
  const text = Buffer.from(slice).toString('latin1');
  return text.includes(ascii);
}

/**
 * Valida tipo real por magic bytes (no confiar solo en Content-Type del browser).
 */
export function sniffAttachmentMime(
  bytes: Uint8Array,
  expected: AllowedEmailAttachmentMime
): { ok: true } | { ok: false; error: string } {
  if (expected === 'application/pdf') {
    if (startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46])) return { ok: true }; // %PDF
    return { ok: false, error: 'El archivo no es un PDF válido.' };
  }
  if (expected === 'image/png') {
    if (
      startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ) {
      return { ok: true };
    }
    return { ok: false, error: 'El archivo no es un PNG válido.' };
  }
  if (expected === 'image/jpeg') {
    if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return { ok: true };
    return { ok: false, error: 'El archivo no es un JPG válido.' };
  }
  // OOXML (docx/xlsx) = ZIP
  if (
    expected ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    expected ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    if (!startsWithBytes(bytes, [0x50, 0x4b])) {
      return { ok: false, error: 'El archivo Office no es un ZIP OOXML válido.' };
    }
    if (
      expected.endsWith('wordprocessingml.document') &&
      !bufferHasAscii(bytes, 'word/')
    ) {
      return { ok: false, error: 'El contenido no parece un documento Word (.docx).' };
    }
    if (
      expected.endsWith('spreadsheetml.sheet') &&
      !bufferHasAscii(bytes, 'xl/')
    ) {
      return { ok: false, error: 'El contenido no parece una hoja Excel (.xlsx).' };
    }
    return { ok: true };
  }
  // OLE Compound (doc/xls legacy)
  if (
    expected === 'application/msword' ||
    expected === 'application/vnd.ms-excel'
  ) {
    if (
      startsWithBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    ) {
      return { ok: true };
    }
    return { ok: false, error: 'El archivo Office legado no es válido.' };
  }
  return { ok: false, error: 'Tipo de archivo no reconocido.' };
}

export function validateAttachmentMeta(
  input: AttachmentMetaInput
):
  | {
      ok: true;
      fileName: string;
      contentType: AllowedEmailAttachmentMime;
      byteSize: number;
      extension: string;
    }
  | { ok: false; error: string } {
  const fileName = sanitizeAttachmentFileName(input.fileName);
  if (!fileName.includes('.')) {
    return { ok: false, error: `Adjunto «${fileName}»: extensión no permitida.` };
  }
  const inferred = inferMimeFromFileName(fileName);
  if (!inferred) {
    return {
      ok: false,
      error: `Tipo no permitido para «${fileName}». Usa PDF, Word, Excel, PNG o JPG.`,
    };
  }
  const declared = (input.contentType || '').toLowerCase().split(';')[0].trim();
  if (
    declared &&
    declared !== 'application/octet-stream' &&
    declared !== inferred &&
    !(declared === 'image/jpg' && inferred === 'image/jpeg')
  ) {
    // Extensión manda; avisar si el browser contradice de forma dura
    const declaredAllowed = EMAIL_ATTACHMENT_ALLOWED_MIME.includes(
      declared as AllowedEmailAttachmentMime
    );
    if (declaredAllowed && declared !== inferred) {
      return {
        ok: false,
        error: `«${fileName}»: la extensión no coincide con el tipo declarado.`,
      };
    }
  }
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
  return {
    ok: true,
    fileName,
    contentType: inferred,
    byteSize: input.byteSize,
    extension: attachmentExtension(fileName),
  };
}

export function validateAttachmentBytes(input: {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}):
  | {
      ok: true;
      fileName: string;
      contentType: AllowedEmailAttachmentMime;
      byteSize: number;
      extension: string;
    }
  | { ok: false; error: string } {
  const meta = validateAttachmentMeta({
    fileName: input.fileName,
    contentType: input.contentType,
    byteSize: input.bytes.byteLength,
  });
  if (!meta.ok) return meta;
  const sniff = sniffAttachmentMime(input.bytes, meta.contentType);
  if (!sniff.ok) {
    return { ok: false, error: `«${meta.fileName}»: ${sniff.error}` };
  }
  return meta;
}

export function validateAttachmentBatch(
  items: AttachmentMetaInput[]
):
  | {
      ok: true;
      items: Array<{
        fileName: string;
        contentType: AllowedEmailAttachmentMime;
        byteSize: number;
        extension: string;
      }>;
    }
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
    extension: string;
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
    if (total > EMAIL_ATTACHMENT_RESEND_SAFE_TOTAL_BYTES) {
      return {
        ok: false,
        error: 'El tamaño total supera el límite seguro para el proveedor de correo.',
      };
    }
    out.push(v);
  }
  return { ok: true, items: out };
}

export function buildDraftAttachmentStoragePath(input: {
  draftId: string;
  attachmentId: string;
  fileName: string;
}): string {
  const safe = sanitizeAttachmentFileName(input.fileName);
  return `drafts/${input.draftId}/${input.attachmentId}/${safe}`;
}
