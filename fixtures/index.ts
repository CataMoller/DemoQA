import { test as base } from '@playwright/test';
import { BaseAPI } from './BaseAPI';
import { BasePage, type BasePageType } from './BasePage';

interface CustomFixtures {
  customPage: BasePageType;
  apiContext: BaseAPI;
}

export const test = base.extend<CustomFixtures>({
  customPage: async ({ page }, use) => {
    const wrapped = new BasePage(page) as BasePageType;
    await use(wrapped);
  },
  apiContext: async ({ request }, use) => {
    await use(new BaseAPI(request));
  },
});

export default test;
export { expect } from '@playwright/test';
