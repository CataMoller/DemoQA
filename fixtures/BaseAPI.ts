import { type APIRequestContext, type APIResponse, expect } from '@playwright/test';

export class BaseAPI {
  private readonly _request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this._request = request;
  }

  get request(): APIRequestContext {
    return this._request;
  }

  async checkResponse<T = unknown>(response: APIResponse, expectedStatus: number): Promise<T> {
    const actual = response.status();
    expect(
      actual,
      `Expected ${expectedStatus} from ${response.url()}, got ${actual}: ${await response.text()}`,
    ).toBe(expectedStatus);

    if (actual === 204) {
      return undefined as T;
    }

    const contentType = response.headers()['content-type'] ?? '';
    if (!contentType.includes('application/json')) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}
