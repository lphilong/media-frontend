import { expect, test } from '@playwright/test';

test('admin shell foundation boots', async ({ page }) => {
  await page.goto('/dashboard');

  await expect(page.getByTestId('primary-navigation')).toBeVisible();
  await expect(page.getByTestId('page-action-region')).toBeAttached();
  await expect(page.getByTestId('admin-shell-main')).toBeVisible();
  await expect(page.getByTestId('nav-link-dashboard')).toBeVisible();
});
