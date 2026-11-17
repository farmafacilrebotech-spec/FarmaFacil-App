import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { asRole } from '../helpers/supabase-user';
import { HISTORIC_ORDERS, PHARMACIES } from '../fixtures/test-data';

test.describe('P0 seguridad y aislamiento', () => {
  test('cliente B no ve pedidos del cliente principal (aislamiento)', async ({
    page,
  }) => {
    await loginAs(page, 'customer');
    await page.goto(`/e/${PHARMACIES.fase7.publicId}/cuenta/pedidos`);
    await expect(page.getByText(/mis pedidos/i).first()).toBeVisible();
    const refsA = await page.locator('body').innerText();
    const numsA = Array.from(refsA.matchAll(/#\s*0*(\d{2,})/g)).map((m) => m[1]);

    await loginAs(page, 'customerB');
    await page.goto(`/e/${PHARMACIES.fase7.publicId}/cuenta/pedidos`);
    await expect(page.locator('body')).toBeVisible();
    const refsB = await page.locator('body').innerText();
    expect(refsB).not.toMatch(/cliente\.test3070/i);
    for (const n of numsA.slice(0, 5)) {
      // Pedidos de A no deben listarse en B
      expect(refsB).not.toMatch(new RegExp(`#\\s*0*${n}\\b`));
    }
  });

  test('outsider no abre panel de farmacia Fase7', async ({ page }) => {
    await loginAs(page, 'outsider');
    await page.goto(`/f/${PHARMACIES.fase7.id}/pedidos`);
    const denied = page.getByText(
      /no tienes|sin permiso|acceso denegado|no autorizado|forbidden|selecciona/i
    );
    const ok = await denied.first().isVisible().catch(() => false);
    if (!ok) {
      await expect(page).not.toHaveURL(
        new RegExp(`/f/${PHARMACIES.fase7.id}/pedidos`)
      );
    } else {
      await expect(denied.first()).toBeVisible();
    }
  });

  test('farmacéutico no accede a tarifas plataforma', async ({ page }) => {
    await loginAs(page, 'pharmacist');
    await page.goto('/tarifas');
    const denied = page.getByText(
      /no tienes|sin permiso|acceso denegado|no autorizado/i
    );
    if (await denied.first().isVisible().catch(() => false)) {
      await expect(denied.first()).toBeVisible();
    } else {
      await expect(page).not.toHaveURL(/\/tarifas$/);
    }
  });

  test('histórico #0029–#0035 visible para owner autorizado (solo lectura)', async ({
    page,
  }) => {
    await loginAs(page, 'owner');
    // El listado UI pagina pedidos recientes; la autorización de lectura
    // del histórico se valida vía RLS (owner) sin mutar estado.
    const owner = await asRole('owner');
    const { data: orders, error: ordErr } = await owner
      .from('pharmacy_orders')
      .select('id, display_number')
      .eq('pharmacy_id', PHARMACIES.fase7.id)
      .in('display_number', [...HISTORIC_ORDERS]);
    expect(ordErr).toBeNull();
    expect((orders ?? []).length).toBeGreaterThan(0);
    const historicId = orders![0].id;
    const { data: items, error: itemsErr } = await owner
      .from('pharmacy_order_items')
      .select('id, order_id')
      .eq('order_id', historicId);
    expect(itemsErr).toBeNull();
    expect((items ?? []).length).toBeGreaterThan(0);

    await page.goto(`/f/${PHARMACIES.fase7.id}/pedidos`);
    await expect(page.getByText(/pedidos|solicitudes/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('RLS: cliente no lee líneas de pedido invitado ajeno (CLI-16)', async () => {
    // Pedido invitado conocido (no mutar). staff_hide: no SELECT pharmacy_orders por owner vía PostgREST.
    const guestOrderId = '31453131-5494-4f7f-b11d-8b137ca5b23b'; // #0081 guest

    const customer = await asRole('customer');
    const { data: items, error } = await customer
      .from('pharmacy_order_items')
      .select('id, order_id')
      .eq('order_id', guestOrderId);
    if (error) {
      expect(error.message).toMatch(/permission|policy|rls|denied|403/i);
    } else {
      expect(items ?? []).toEqual([]);
    }

    const { data: linked, error: lErr } = await customer.rpc(
      'ff_order_linked_to_auth_uid',
      { p_order_id: guestOrderId }
    );
    expect(lErr, lErr?.message).toBeFalsy();
    expect(linked).toBe(false);
  });

  test('RLS: cliente sí lee líneas de su propio pedido vinculado', async () => {
    const customer = await asRole('customer');
    const { data: rpc, error } = await customer.rpc(
      'ff_list_my_customer_orders_v1',
      { p_limit: 5 }
    );
    expect(error, error?.message).toBeFalsy();
    expect(rpc?.status).toBe('ok');
    const orders = (rpc?.orders as Array<{ id: string }>) || [];
    if (orders.length === 0) {
      test.info().annotations.push({
        type: 'note',
        description:
          'Cliente sin pedidos vinculados aún — cobertura parcial; el circuito P0 crea uno.',
      });
      return;
    }
    const orderId = orders[0].id;
    const { data: linked } = await customer.rpc('ff_order_linked_to_auth_uid', {
      p_order_id: orderId,
    });
    expect(linked).toBe(true);
    const { data: items, error: iErr } = await customer
      .from('pharmacy_order_items')
      .select('id')
      .eq('order_id', orderId);
    expect(iErr, iErr?.message).toBeFalsy();
    expect((items ?? []).length).toBeGreaterThan(0);
  });
});
