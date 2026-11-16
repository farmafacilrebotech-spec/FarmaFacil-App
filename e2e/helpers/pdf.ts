import type { Download } from '@playwright/test';
import { expect } from '@playwright/test';
import { PDFParse } from 'pdf-parse';

/** Lee un download Playwright a Buffer. */
export async function downloadToBuffer(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream();
  if (!stream) {
    const path = await download.path();
    if (!path) throw new Error('Download sin stream ni path');
    const fs = await import('node:fs/promises');
    return Buffer.from(await fs.readFile(path));
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function extractPdfText(buf: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText();
  return result.text || '';
}

/** Valida cabecera PDF + texto extraído. */
export async function assertPdfContent(
  buf: Buffer,
  mustMatch: RegExp[],
  label: string
) {
  expect(buf.byteLength, `${label} vacío`).toBeGreaterThan(500);
  expect(buf.subarray(0, 5).toString('latin1'), `${label} magic`).toBe('%PDF-');
  const text = await extractPdfText(buf);
  expect(text.trim().length, `${label} sin texto extraíble`).toBeGreaterThan(5);
  for (const re of mustMatch) {
    expect(text, `${label} debe coincidir ${re}`).toMatch(re);
  }
}
