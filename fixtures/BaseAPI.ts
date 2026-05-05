import { type APIRequestContext, type APIResponse } from '@playwright/test';
import { assertResponse } from '@/functions/utils';

export class BaseAPI {
  private readonly _request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this._request = request;
  }

  get request(): APIRequestContext {
    return this._request;
  }

  /**
   * Thin wrapper around the standalone `assertResponse` utility, exposed on
   * the `apiContext` fixture so tests can write
   * `await apiContext.checkResponse<T>(response, 200)` without importing the
   * helper directly. Behaviour is identical to `assertResponse`: throws with
   * URL + status + body when the status doesn't match, returns the parsed
   * JSON body on success, returns `undefined as T` for 204 No Content.
   */
  async checkResponse<T>(response: APIResponse, expectedStatus: number): Promise<T> {
    return assertResponse<T>(response, expectedStatus);
  }
}
