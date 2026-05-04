import {
  type APIRequestContext,
  type Page,
  request as playwrightRequest,
} from '@playwright/test';

export interface UserData {
  userId: string;
  username: string;
  password: string;
  books: unknown[];
}

interface StoredUserInfo {
  userId: string;
  userName?: string;
  username?: string;
  password: string;
  token: string;
  expires?: string;
  books?: unknown[];
}

export class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;

    return new Proxy(this, {
      /**
       * Property lookup order:
       *   1. Own/inherited members of BasePage (custom domain methods)
       *   2. Members of the underlying Playwright Page (native API)
       *
       * Function values are bound to their original owner so `this` is
       * preserved: BasePage methods stay bound to the BasePage instance,
       * while Page methods stay bound to the underlying Page. Without this
       * binding, accessing `proxy.click` would invoke `click` with the
       * Proxy as `this`, breaking Playwright's internal state.
       */
      get(target: BasePage, prop: string | symbol, receiver: unknown): unknown {
        if (prop in target) {
          const value = Reflect.get(target, prop, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        }
        const pageValue = Reflect.get(target.page, prop, target.page);
        return typeof pageValue === 'function' ? pageValue.bind(target.page) : pageValue;
      },
    });
  }

  private async readUserInfo(): Promise<StoredUserInfo> {
    const raw = await this.page.evaluate(() => window.localStorage.getItem('userInfo'));
    if (!raw) {
      throw new Error('userInfo not found in localStorage — user is not logged in');
    }
    return JSON.parse(raw) as StoredUserInfo;
  }

  async getAPI(): Promise<APIRequestContext> {
    const info = await this.readUserInfo();
    return playwrightRequest.newContext({
      extraHTTPHeaders: {
        Authorization: `Bearer ${info.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  async getUserId(): Promise<string> {
    const info = await this.readUserInfo();
    return info.userId;
  }

  async getUserData(): Promise<UserData> {
    const info = await this.readUserInfo();
    return {
      userId: info.userId,
      username: info.userName ?? info.username ?? '',
      password: info.password,
      books: info.books ?? [],
    };
  }
}

export type BasePageType = BasePage & Page;
