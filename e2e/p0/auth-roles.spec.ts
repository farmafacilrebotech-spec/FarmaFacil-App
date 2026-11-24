import { test, expect } from '@playwright/test';
import { loginAs, loginViaUiForm, logoutStaff } from '../helpers/auth';
import { PHARMACIES } from '../fixtures/test-data';

test.describe('P0 auth roles', () => {
  test('login UI formulario Acceder (SuperAdmin)', async ({ page }) => {
    test.setTimeout(180_000);
    await loginViaUiForm(page, 'superadmin');
    await expect(
      page.getByText(/farmacias|tarifas|dashboard|inventario/i).first()
    ).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('login SuperAdmin llega a shell plataforma', async ({ page }) => {
    await loginAs(page, 'superadmin');
    await expect(page.getByText(/farmacias|tarifas|dashboard|inventario/i).first()).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('login Propietario abre panel farmacia Fase7', async ({ page }) => {
    await loginAs(page, 'owner');
    await page.goto(`/f/${PHARMACIES.fase7.id}/pedidos`);
    await expect(page.getByText(/pedidos|solicitudes/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('login Administrador', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`/f/${PHARMACIES.fase7.id}/dashboard`);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('login Farmacéutico', async ({ page }) => {
    await loginAs(page, 'pharmacist');
    await page.goto(`/f/${PHARMACIES.fase7.id}/pedidos`);
    await expect(page.getByText(/pedidos|solicitudes/i).first()).toBeVisible();
  });

  test('login Empleado', async ({ page }) => {
    await loginAs(page, 'staff');
    await page.goto(`/f/${PHARMACIES.fase7.id}/pedidos`);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('login Cliente y logout (CLI-05)', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto(`/e/${PHARMACIES.fase7.publicId}/cuenta`);
    await expect(page.getByText(/cuenta|perfil|mis pedidos|mis farmacias/i).first()).toBeVisible();
    await page.getByRole('button', { name: /cerrar sesión/i }).click();
    // sign-out redirige a catálogo; esperar esa navegación evita ERR_ABORTED
    await expect(page).toHaveURL(
      new RegExp(`/e/${PHARMACIES.fase7.publicId}/catalogo`),
      { timeout: 20_000 }
    );
    await page.goto(`/e/${PHARMACIES.fase7.publicId}/cuenta`);
    // Tras logout, cuenta pide acceso / login
    await expect(
      page.getByText(/iniciar sesión|accede|crear cuenta|cliente/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test('logout staff vuelve a login', async ({ page }) => {
    await loginAs(page, 'owner');
    // Owner es tenant farmacia, no panel plataforma /farmacias
    await page.goto(`/f/${PHARMACIES.fase7.id}/pedidos`);
    await expect(page.getByText(/pedidos|solicitudes/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await logoutStaff(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test('empleado denegado a gestión de usuarios', async ({ page }) => {
    await loginAs(page, 'staff');
    await page.goto(`/f/${PHARMACIES.fase7.id}/usuarios`);
    await expect(
      page.getByText(
        /Tu usuario no tiene permiso para acceder a este apartado/i
      )
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: /volver al dashboard/i })).toBeVisible();
    await expect(page.getByText(/invitar|miembros|equipo/i)).toHaveCount(0);
  });

  test('empleado denegado a dispositivos/kioskos', async ({ page }) => {
    await loginAs(page, 'staff');
    await page.goto(`/f/${PHARMACIES.fase7.id}/dispositivos`);
    await expect(
      page.getByText(
        /Tu usuario no tiene permiso para acceder a este apartado/i
      )
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: /volver al dashboard/i })).toBeVisible();
  });
});
