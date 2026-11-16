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
    const denied = page.getByText(/no tienes|sin permiso|acceso denegado|no autorizado|forbidden/i);
    const usersUi = page.getByText(/invitar|miembros|equipo/i);
    // Debe denegar o no mostrar gestión
    const deniedVisible = await denied.first().isVisible().catch(() => false);
    if (!deniedVisible) {
      // Si la ruta redirige
      await expect(page).not.toHaveURL(new RegExp(`/f/${PHARMACIES.fase7.id}/usuarios$`));
    } else {
      await expect(denied.first()).toBeVisible();
    }
    void usersUi;
  });

  test('empleado denegado a dispositivos/kioskos', async ({ page }) => {
    await loginAs(page, 'staff');
    await page.goto(`/f/${PHARMACIES.fase7.id}/dispositivos`);
    const denied = page.getByText(/no tienes|sin permiso|acceso denegado|no autorizado/i);
    if (await denied.first().isVisible().catch(() => false)) {
      await expect(denied.first()).toBeVisible();
    } else {
      await expect(page).not.toHaveURL(/dispositivos$/);
    }
  });
});
