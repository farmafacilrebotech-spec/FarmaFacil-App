/**
 * Tipografía del nombre en el cartel PDF (Source Sans 3 Bold).
 * Soporta tildes, Ñ y Latin Extended. Solo uso visual en jsPDF.
 */

import type { jsPDF } from 'jspdf';

export const POSTER_NAME_FONT_FAMILY = 'SourceSans3';
export const POSTER_NAME_FONT_FILE = 'SourceSans3-Bold.ttf';
export const POSTER_NAME_FONT_PUBLIC_PATH = `/fonts/${POSTER_NAME_FONT_FILE}`;

let cachedBase64: string | null = null;

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(
      null,
      Array.from(slice) as number[]
    );
  }
  return btoa(binary);
}

async function loadFontBase64(): Promise<string> {
  if (cachedBase64) return cachedBase64;

  if (typeof window === 'undefined') {
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const path = resolve(process.cwd(), `public/fonts/${POSTER_NAME_FONT_FILE}`);
    const buf = await readFile(path);
    cachedBase64 = buf.toString('base64');
    return cachedBase64;
  }

  const res = await fetch(POSTER_NAME_FONT_PUBLIC_PATH);
  if (!res.ok) {
    throw new Error('No se ha podido cargar la tipografía del cartel');
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  cachedBase64 = bytesToBase64(buf);
  return cachedBase64;
}

/** Registra Source Sans 3 Bold en el documento jsPDF (idempotente). */
export async function ensurePosterNameFont(doc: jsPDF): Promise<string> {
  const list = doc.getFontList();
  if (list[POSTER_NAME_FONT_FAMILY]) {
    return POSTER_NAME_FONT_FAMILY;
  }
  const base64 = await loadFontBase64();
  doc.addFileToVFS(POSTER_NAME_FONT_FILE, base64);
  doc.addFont(POSTER_NAME_FONT_FILE, POSTER_NAME_FONT_FAMILY, 'bold');
  doc.addFont(POSTER_NAME_FONT_FILE, POSTER_NAME_FONT_FAMILY, 'normal');
  return POSTER_NAME_FONT_FAMILY;
}

/** MAYÚSCULAS solo visuales (es-ES: Ñ, tildes). No altera el dato guardado. */
export function pharmacyNameForPosterDisplay(name: string): string {
  const trimmed = name.trim() || 'Farmacia';
  return trimmed.toLocaleUpperCase('es-ES');
}
