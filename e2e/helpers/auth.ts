import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { e2ePassword, roleEmail, type E2ERole } from '../fixtures/test-data';

const PROJECT_REF = 'dazfdcjscnpfvhcyjddt';
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;

function stagingUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!url.includes(PROJECT_REF)) {
    throw new Error(`E2E solo staging. URL inesperada: ${url}`);
  }
  return url;
}

function anonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error('Falta NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return key;
}

/**
 * Autentica vía Auth API y fija la cookie SSR de Supabase.
 * Evita flakiness del formulario bajo carga (compilación Next / race assign).
 * La batería de UI de login se cubre aparte en auth-roles (smoke formulario).
 */
export async function loginAs(page: Page, role: E2ERole) {
  const email = roleEmail(role);
  const password = e2ePassword();
  const client = createClient(stagingUrl(), anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) {
    throw new Error(`Login API ${role}: ${error?.message || 'sin sesión'}`);
  }

  const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3070';
  const host = new URL(baseURL).hostname;

  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: COOKIE_NAME,
      value: JSON.stringify(data.session),
      domain: host,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
    },
  ]);

  await page.goto('/auth/continue', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(
    (url) => {
      const p = url.pathname;
      return p !== '/login' && !p.startsWith('/login') && p !== '/auth/continue';
    },
    { timeout: 60_000, waitUntil: 'commit' }
  );
}

/** Smoke del formulario real Acceder (una vez por suite de auth). */
export async function loginViaUiForm(page: Page, role: E2ERole) {
  const email = roleEmail(role);
  const password = e2ePassword();
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  const tokenPromise = page
    .waitForResponse(
      (r) =>
        r.url().includes('/auth/v1/token') &&
        r.request().method() === 'POST',
      { timeout: 60_000 }
    )
    .catch(() => null);
  await page.getByRole('button', { name: /^(acceder|iniciar sesión)$/i }).click();
  const tokenResp = await tokenPromise;
  if (tokenResp && tokenResp.status() >= 400) {
    const alert = await page.getByRole('alert').textContent().catch(() => '');
    throw new Error(
      `Login UI ${role}: auth HTTP ${tokenResp.status()} ${alert || ''}`
    );
  }
  await page.waitForURL(
    (url) => url.pathname !== '/login' && !url.pathname.startsWith('/login'),
    { timeout: 90_000, waitUntil: 'commit' }
  );
}

export async function loginExpectFail(
  page: Page,
  email: string,
  password: string
) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^(acceder|iniciar sesión)$/i }).click();
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/login/);
}

export async function logoutStaff(page: Page) {
  // Shell tenant (/f/...) o plataforma — ambos exponen «Menú de usuario»
  if (!/\/f\//.test(page.url()) && !/\/(farmacias|tarifas|perfil)/.test(page.url())) {
    await page.goto('/perfil', { waitUntil: 'domcontentloaded' });
  }
  // Página «Acceso no autorizado» también ofrece Cerrar sesión
  const deniedLogout = page.getByRole('button', { name: /cerrar sesión/i });
  if (
    (await page.getByText(/acceso no autorizado/i).isVisible().catch(() => false)) &&
    (await deniedLogout.isVisible().catch(() => false))
  ) {
    await Promise.all([
      page.waitForURL(/\/login/, { timeout: 60_000, waitUntil: 'commit' }),
      deniedLogout.click(),
    ]);
    return;
  }
  const userMenu = page.getByRole('button', { name: /menú de usuario/i });
  await expect(userMenu).toBeVisible({ timeout: 20_000 });
  await userMenu.click();
  // Radix puede exponer el control como menuitem o button; el form envuelve el submit
  const logoutControl = page
    .getByRole('menuitem', { name: /cerrar sesión/i })
    .or(page.getByRole('button', { name: /cerrar sesión/i }))
    .or(page.locator('form button:has-text("Cerrar sesión")'));
  await expect(logoutControl.first()).toBeVisible({ timeout: 15_000 });
  const nav = page.waitForURL(/\/login/, {
    timeout: 60_000,
    waitUntil: 'commit',
  });
  await logoutControl.first().evaluate((el: HTMLElement) => {
    const form = el.closest('form');
    if (form) {
      form.requestSubmit();
      return;
    }
    el.click();
  });
  await nav;
}

export async function logoutCustomer(page: Page, publicId?: string) {
  if (publicId) {
    await page.goto(`/e/${publicId}/cuenta`);
  } else {
    await page.goto('/cuenta');
  }
  const btn = page.getByRole('button', { name: /cerrar sesión/i }).first();
  await expect(btn).toBeVisible({ timeout: 15_000 });
  await btn.click();
  await page.waitForTimeout(500);
}
