import { test as setup, expect } from '@playwright/test';
import { STORAGE_STATE } from '@/paths';

/**
 * Authentication setup project.
 *
 * Runs once before any browser project (chromium/firefox/webkit) thanks to
 * `dependencies: ['setup']` in playwright.config.ts. It logs the shared test
 * user into DemoQA via the UI and persists cookies + localStorage to
 * STORAGE_STATE so the dependent projects can start each test already
 * authenticated. Per-test user lifecycle (the `generateUserData` flows in the
 * spec files) is independent of this; this fixture only provides a baseline
 * authenticated browser context.
 */
setup('authenticate shared test user', async ({ page }) => {
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;

  if (!username || !password) {
    throw new Error(
      '[auth.setup] TEST_USERNAME and TEST_PASSWORD must be set in .env (see .env.example)',
    );
  }

  await page.goto('/login');
  await page.fill('#userName', username);
  await page.fill('#password', password);
  await page.click('#login');

  await page.waitForURL('**/profile');
  await expect(page).toHaveURL(/\/profile$/);

  await page.context().storageState({ path: STORAGE_STATE });
});
