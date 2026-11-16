import { test, expect, devices } from '@playwright/test';
import { PHARMACIES } from '../fixtures/test-data';

const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

for (const vp of viewports) {
  test(`responsive ${vp.name}: catálogo QR sin overflow horizontal`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(`/e/${PHARMACIES.fase7.publicId}/catalogo`);
    await expect(page.locator('body')).toBeVisible();
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 2;
    });
    expect(overflow).toBeFalsy();
    const critical = errors.filter(
      (e) =>
        !/favicon|Download the React DevTools|hydration|browserslist/i.test(e)
    );
    expect(critical).toEqual([]);
  });
}

test.use({ ...devices['Desktop Chrome'] });
