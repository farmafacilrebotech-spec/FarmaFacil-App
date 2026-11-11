'use server';

import { hasSuppliersWrite } from '@/lib/kiosk-inventory/authz';
import {
  parseExtractJson,
  type QuotePdfExtract,
} from '@/lib/suppliers/quote-pdf-extract';
import { isSupplierQuotePdfAiEnabled } from '@/lib/suppliers/supplier-quote-pdf-ai';

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB (bucket 25 MB; margen de seguridad)
const MAX_TEXT_CHARS = 40_000;

export type QuotePdfExtractActionResult =
  | {
      ok: true;
      extract: QuotePdfExtract;
      meta: {
        fileName: string;
        textChars: number;
        model: string | null;
        estimatedCostCents: number | null;
        aiConfigured: boolean;
      };
    }
  | { ok: false; error: string; code?: 'ai_unavailable' | 'parse_failed' | 'invalid_file' };

function getOpenAiConfig() {
  // OPENAI_API_KEY puede existir por el asistente kiosk; este módulo exige flag aparte.
  if (!isSupplierQuotePdfAiEnabled()) return null;
  const apiKey = (process.env.OPENAI_API_KEY ?? '').trim();
  if (!apiKey) return null;
  const model = (process.env.OPENAI_MODEL ?? 'gpt-4o-mini').trim() || 'gpt-4o-mini';
  const timeoutRaw = Number(process.env.OPENAI_TIMEOUT_MS ?? 45_000);
  const timeoutMs =
    Number.isFinite(timeoutRaw) && timeoutRaw >= 5_000 && timeoutRaw <= 90_000
      ? Math.floor(timeoutRaw)
      : 45_000;
  const baseUrl = (
    process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
  )
    .trim()
    .replace(/\/$/, '');
  return { apiKey, model, timeoutMs, baseUrl };
}

async function extractPdfText(bytes: Buffer): Promise<string> {
  // pdf-parse v2: clase PDFParse + getText(); import dinámico (CJS/ESM).
  const mod = (await import('pdf-parse')) as {
    PDFParse?: new (opts: { data: Buffer | Uint8Array }) => {
      getText: () => Promise<{ text?: string }>;
      destroy?: () => Promise<void> | void;
    };
  };
  if (!mod.PDFParse) throw new Error('pdf-parse unavailable');
  const parser = new mod.PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    return String(result.text ?? '').replace(/\u0000/g, ' ').trim();
  } finally {
    try {
      await parser.destroy?.();
    } catch {
      /* ignore */
    }
  }
}

function estimateCostCents(promptTokens: number, completionTokens: number) {
  const promptPer1M = Number(
    process.env.ASSISTANT_COST_PROMPT_PER_1M_CENTS ?? 15
  );
  const completionPer1M = Number(
    process.env.ASSISTANT_COST_COMPLETION_PER_1M_CENTS ?? 60
  );
  const p = Number.isFinite(promptPer1M) ? promptPer1M : 15;
  const c = Number.isFinite(completionPer1M) ? completionPer1M : 60;
  return Math.max(
    1,
    Math.ceil(
      (promptTokens / 1_000_000) * p + (completionTokens / 1_000_000) * c
    )
  );
}

/**
 * Extrae datos de un PDF de presupuesto. No guarda ni muta filas.
 * No registra el contenido del PDF en logs.
 */
export async function extractSupplierQuotePdfAction(
  formData: FormData
): Promise<QuotePdfExtractActionResult> {
  if (!(await hasSuppliersWrite())) {
    return { ok: false, error: 'Sin permiso.' };
  }
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { ok: false, error: 'Falta el archivo PDF.', code: 'invalid_file' };
  }
  const name = file.name || 'documento.pdf';
  const mime = (file.type || '').toLowerCase();
  if (
    mime &&
    mime !== 'application/pdf' &&
    !name.toLowerCase().endsWith('.pdf')
  ) {
    return {
      ok: false,
      error: 'Solo se admite PDF para la lectura inteligente.',
      code: 'invalid_file',
    };
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return {
      ok: false,
      error: 'El PDF supera el tamaño máximo permitido (12 MB).',
      code: 'invalid_file',
    };
  }

  let text = '';
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    text = await extractPdfText(bytes);
  } catch {
    console.error('[quote-pdf] text extract failed');
    return {
      ok: false,
      error:
        'No se ha podido leer el texto del PDF. Puedes cumplimentar el presupuesto a mano.',
      code: 'parse_failed',
    };
  }

  if (!text || text.length < 20) {
    return {
      ok: false,
      error:
        'El PDF no contiene texto legible (puede ser escaneado). Cumplimenta a mano o usa un PDF con texto.',
      code: 'parse_failed',
    };
  }

  const clipped = text.slice(0, MAX_TEXT_CHARS);
  const config = getOpenAiConfig();
  if (!config) {
    const disabledByFlag = !isSupplierQuotePdfAiEnabled();
    return {
      ok: false,
      error: disabledByFlag
        ? 'La lectura inteligente de PDF de proveedores está desactivada en esta publicación. Adjunta el PDF y cumplimenta el presupuesto a mano.'
        : 'La lectura con IA no está configurada (falta OPENAI_API_KEY). El archivo se puede adjuntar y el presupuesto cumplimentarse manualmente.',
      code: 'ai_unavailable',
    };
  }

  const systemPrompt = [
    'Eres un extractor de presupuestos de proveedores para FarmaFácil.',
    'Devuelve ÚNICAMENTE un JSON válido con las claves:',
    'supplierName, supplierTaxId, quoteNumber, quoteDate (YYYY-MM-DD), title,',
    'shippingCents (céntimos enteros) o shipping (euros), shippingIncludesVat (boolean|null),',
    'notes, leadDays, subtotalCents, vatCents, totalCents,',
    'lines: [{ materialKey, description, quantity, unit, unitPrice o unitPriceCents, discountBps, vatBps, leadDays, sourceHint }],',
    'warnings: string[].',
    'No inventes valores ausentes: usa null.',
    'Si hay duda, null + warning.',
    'sourceHint puede citar página/fragmento breve sin datos personales.',
  ].join(' ');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        max_tokens: 2500,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Extrae el presupuesto del siguiente texto de PDF:\n\n${clipped}`,
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error('[quote-pdf] openai status', res.status);
      return {
        ok: false,
        error:
          'El servicio de IA no ha podido procesar el documento. Puedes cumplimentar a mano.',
        code: 'ai_unavailable',
      };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = String(data.choices?.[0]?.message?.content ?? '').trim();
    if (!content) {
      return {
        ok: false,
        error: 'La IA no ha devuelto datos útiles.',
        code: 'parse_failed',
      };
    }
    const extract = parseExtractJson(content);
    const promptTokens = Math.max(0, Number(data.usage?.prompt_tokens) || 0);
    const completionTokens = Math.max(
      0,
      Number(data.usage?.completion_tokens) || 0
    );
    return {
      ok: true,
      extract,
      meta: {
        fileName: name,
        textChars: clipped.length,
        model: config.model,
        estimatedCostCents: estimateCostCents(promptTokens, completionTokens),
        aiConfigured: true,
      },
    };
  } catch (err) {
    const aborted =
      err instanceof Error &&
      (err.name === 'AbortError' || /abort/i.test(err.message));
    console.error('[quote-pdf] openai call failed', aborted ? 'timeout' : 'error');
    return {
      ok: false,
      error: aborted
        ? 'Tiempo de espera agotado al leer el PDF. Inténtalo de nuevo o cumplimenta a mano.'
        : 'No se ha podido completar la lectura inteligente.',
      code: 'ai_unavailable',
    };
  } finally {
    clearTimeout(timer);
  }
}
