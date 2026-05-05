import { type APIResponse } from '@playwright/test';

/**
 * Asserts that an APIResponse has the expected HTTP status, and returns the
 * parsed JSON body. Throws with the request URL, the actual status, and the
 * raw response body when the status does not match — enough context to
 * diagnose the failure without re-running the call.
 *
 * For 204 No Content responses (where the server is contractually required
 * not to send a body), returns `undefined as T`.
 *
 * Use this for endpoints with a single canonical success status. Endpoints
 * that legitimately accept multiple statuses (cleanup helpers tolerating
 * 401/404, etc.) should keep their explicit branching.
 */
export async function assertResponse<T>(
  response: APIResponse,
  expectedStatus: number,
): Promise<T> {
  if (response.status() !== expectedStatus) {
    const body = await response.text().catch(() => '(unreadable)');
    throw new Error(
      `Expected status ${expectedStatus} from ${response.url()}, got ${response.status()}: ${body}`,
    );
  }
  if (expectedStatus === 204) return undefined as T;
  return (await response.json()) as T;
}
