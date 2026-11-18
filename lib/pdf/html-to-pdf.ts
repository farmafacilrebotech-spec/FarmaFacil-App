/**
 * Generador HTML → PDF reutilizable (Chromium).
 * - Local / integración: Google Chrome o CHROME_EXECUTABLE_PATH.
 * - Vercel / serverless: @sparticuz/chromium + puppeteer-core.
 */

import type { Browser, LaunchOptions } from 'puppeteer-core';

export type HtmlToPdfOptions = {
  /** Formato de página (por defecto A4). */
  format?: 'A4' | 'Letter';
  /** Márgenes CSS print (mm). Por defecto 0: el HTML corporativo ya define padding. */
  marginMm?: { top?: number; right?: number; bottom?: number; left?: number };
  printBackground?: boolean;
  /** Preferir landscape. */
  landscape?: boolean;
};

export type HtmlToPdfResult = {
  bytes: Uint8Array;
  mimeType: 'application/pdf';
};

function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_EXECUTION_ENV
  );
}

function localChromeCandidates(): string[] {
  const fromEnv =
    process.env.CHROME_EXECUTABLE_PATH?.trim() ||
    process.env.PUPPETEER_EXECUTABLE_PATH?.trim() ||
    process.env.CHROME_PATH?.trim();
  const list: string[] = [];
  if (fromEnv) list.push(fromEnv);
  if (process.platform === 'darwin') {
    list.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else if (process.platform === 'linux') {
    list.push(
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser'
    );
  } else if (process.platform === 'win32') {
    list.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    );
  }
  return list;
}

async function resolveExecutablePath(): Promise<{
  executablePath: string;
  args: string[];
  headless: boolean | 'shell';
}> {
  if (isServerlessRuntime()) {
    const chromium = await import('@sparticuz/chromium');
    const executablePath = await chromium.default.executablePath();
    return {
      executablePath,
      args: chromium.default.args,
      headless: chromium.default.headless ?? true,
    };
  }

  const { access } = await import('node:fs/promises');
  for (const candidate of localChromeCandidates()) {
    try {
      await access(candidate);
      return {
        executablePath: candidate,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
        headless: true,
      };
    } catch {
      /* try next */
    }
  }

  throw new Error(
    'No se encontró Chromium/Chrome para generar PDF. Define CHROME_EXECUTABLE_PATH o despliega con @sparticuz/chromium en Vercel.'
  );
}

async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import('puppeteer-core');
  const resolved = await resolveExecutablePath();
  const options: LaunchOptions = {
    executablePath: resolved.executablePath,
    args: resolved.args,
    headless: resolved.headless,
    ignoreHTTPSErrors: true,
  };
  return puppeteer.default.launch(options);
}

/**
 * Renderiza HTML completo (documento) a PDF A4 con Chromium.
 * Pensado para plantillas corporativas autocontenidas (CSS inline + data URI).
 */
export async function renderHtmlToPdf(
  html: string,
  options: HtmlToPdfOptions = {}
): Promise<HtmlToPdfResult> {
  if (!html?.trim()) {
    throw new Error('HTML vacío: no se puede generar el PDF.');
  }

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: 'load',
      timeout: 45_000,
    });
    const margin = options.marginMm ?? {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    };
    const pdf = await page.pdf({
      format: options.format ?? 'A4',
      printBackground: options.printBackground ?? true,
      landscape: options.landscape ?? false,
      preferCSSPageSize: true,
      margin: {
        top: `${margin.top ?? 0}mm`,
        right: `${margin.right ?? 0}mm`,
        bottom: `${margin.bottom ?? 0}mm`,
        left: `${margin.left ?? 0}mm`,
      },
    });
    await page.close().catch(() => undefined);
    return {
      bytes: new Uint8Array(pdf),
      mimeType: 'application/pdf',
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}
