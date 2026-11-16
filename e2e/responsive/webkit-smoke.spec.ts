import { test, expect } from '@playwright/test';
import { PHARMACIES } from '../fixtures/test-data';

test('webkit smoke: login + QR entry', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeVisible();
  await page.goto(`/e/${PHARMACIES.fase7.publicId}`);
  await expect(page.locator('body')).toContainText(/farmacia|catálogo|pedir|Farma/i);
});
