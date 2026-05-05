import { type APIRequestContext } from '@playwright/test';
import { type BasePageType } from '@/fixtures/BasePage';
import { type BookItem } from './books';
import { assertResponse } from './utils';

const API_BASE_URL = process.env.API_BASE_URL ?? 'https://demoqa.com';

export interface NewUser {
  userName: string;
  password: string;
}

export interface RegisteredUser {
  userID: string;
  username: string;
  books: unknown[];
}

export interface UserProfile {
  userId: string;
  username: string;
  books: BookItem[];
}

interface RawRegisteredUser {
  userID: string;
  username: string;
  books?: unknown[];
}

interface RawTokenResponse {
  token: string;
  expires: string;
  status: string;
  result: string;
}

interface RawUserProfile {
  userId: string;
  username: string;
  books?: BookItem[];
}

async function registerViaApi(
  api: APIRequestContext,
  userData: NewUser,
): Promise<RegisteredUser> {
  const response = await api.post(`${API_BASE_URL}/Account/v1/User`, { data: userData });
  const body = await assertResponse<RawRegisteredUser>(response, 201);
  return { userID: body.userID, username: body.username, books: body.books ?? [] };
}

async function registerViaPage(
  page: BasePageType,
  userData: NewUser,
): Promise<RegisteredUser> {
  const apiContext = page.context().request;
  const registered = await registerViaApi(apiContext, userData);

  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.goto('/login');
  await page.fill('#userName', userData.userName);
  await page.fill('#password', userData.password);
  await page.click('#login');
  await page.waitForURL('**/profile', { timeout: 15000 });
  await page.getByRole('button', { name: /log\s*out/i }).waitFor({ timeout: 15000 });

  // The DemoQA UI login persists auth in cookies (token, userID, userName, expires),
  // not localStorage. Calling /Account/v1/GenerateToken here would *invalidate* the
  // cookie token server-side, causing subsequent page reloads of /profile to render
  // "User not authorized!". Instead, copy the token straight from cookies into
  // localStorage so BasePage.readUserInfo() (which reads localStorage.userInfo) works.
  const cookies = await page.context().cookies(['https://demoqa.com']);
  const cookieMap = new Map(cookies.map((c) => [c.name, c.value]));
  const token = cookieMap.get('token');
  const userId = cookieMap.get('userID');
  const userName = cookieMap.get('userName') ?? userData.userName;
  const expires = decodeURIComponent(cookieMap.get('expires') ?? '');
  if (!token || !userId) {
    throw new Error('[registerViaPage] token/userID cookies missing after UI login');
  }
  await page.evaluate(
    (data) => {
      window.localStorage.setItem('userInfo', JSON.stringify(data));
    },
    {
      userId,
      userName,
      token,
      password: userData.password,
      expires,
      books: [],
    },
  );

  return registered;
}

function isBasePageType(value: APIRequestContext | BasePageType): value is BasePageType {
  return typeof (value as BasePageType).goto === 'function';
}

/**
 * Registers a new user account against the DemoQA Account API.
 *
 * Two call shapes:
 *   - `registerUser(api, userData)`: pure API registration. Returns the
 *     RegisteredUser; no browser state is touched.
 *   - `registerUser(page, userData)`: registers via API, clears any
 *     pre-existing browser session (cookies + localStorage from storageState),
 *     performs a UI login at /login, and waits for /profile to render. The
 *     DemoQA frontend persists auth in cookies (token, userID, userName,
 *     expires) and does NOT populate localStorage.userInfo on its own, so
 *     this function copies the token + identity from those cookies into
 *     `localStorage.userInfo` (shape: `{ userId, userName, token, password,
 *     expires, books }`). Subsequent calls to `page.getAPI()` /
 *     `page.getUserId()` / `page.getUserData()` read this localStorage entry.
 *
 *     IMPORTANT: this function deliberately does NOT call /GenerateToken
 *     after the UI login — DemoQA's server invalidates the previously-issued
 *     token whenever a new one is generated, which would cause the cookie
 *     token to be rejected on the next /profile reload ("User not
 *     authorized!"). Reusing the cookie token keeps both auth surfaces in
 *     sync.
 *
 * @throws if the registration request fails, if the profile shell does not
 *   render within 15s, or if the auth cookies are missing after UI login
 *   (BasePageType signature only).
 */
export function registerUser(
  api: APIRequestContext,
  userData: NewUser,
): Promise<RegisteredUser>;
export function registerUser(
  page: BasePageType,
  userData: NewUser,
): Promise<RegisteredUser>;
export function registerUser(
  apiOrPage: APIRequestContext | BasePageType,
  userData: NewUser,
): Promise<RegisteredUser> {
  if (isBasePageType(apiOrPage)) {
    return registerViaPage(apiOrPage, userData);
  }
  return registerViaApi(apiOrPage, userData);
}

/**
 * Generates a JWT for the given credentials and returns the token string only.
 * @throws if the API responds with a non-2xx status or with status !== "Success".
 */
export async function generateToken(
  api: APIRequestContext,
  credentials: NewUser,
): Promise<string> {
  const response = await api.post(`${API_BASE_URL}/Account/v1/GenerateToken`, {
    data: credentials,
  });
  const body = await assertResponse<RawTokenResponse>(response, 200);
  if (body.status !== 'Success' || !body.token) {
    throw new Error(`[generateToken] token generation failed: ${body.result}`);
  }
  return body.token;
}

/**
 * Fetches the authenticated user profile, including the books in their collection.
 * @throws if the API responds with a non-2xx status.
 */
export async function getUserProfile(
  api: APIRequestContext,
  userId: string,
  token: string,
): Promise<UserProfile> {
  const response = await api.get(`${API_BASE_URL}/Account/v1/User/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await assertResponse<RawUserProfile>(response, 200);
  return { userId: body.userId, username: body.username, books: body.books ?? [] };
}

/**
 * Deletes the user account. Idempotent for cleanup use: tolerates 404 (already
 * deleted) and 401 (token expired) so it is safe to call from `finally` blocks
 * after a failed assertion. Other unexpected statuses still throw.
 */
export async function deleteUser(
  api: APIRequestContext,
  userId: string,
  token: string,
): Promise<void> {
  const response = await api.delete(`${API_BASE_URL}/Account/v1/User/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const status = response.status();
  if (status === 200 || status === 204 || status === 404 || status === 401) return;
  throw new Error(`[deleteUser] unexpected status ${status}: ${await response.text()}`);
}

/**
 * Convenience flow that registers a user, generates an auth token and verifies
 * the profile is reachable. Returns the token and userId for downstream calls.
 */
export async function loginUser(
  api: APIRequestContext,
  credentials: NewUser,
): Promise<{ token: string; userId: string }> {
  const registered = await registerUser(api, credentials);
  const token = await generateToken(api, credentials);
  await getUserProfile(api, registered.userID, token);
  return { token, userId: registered.userID };
}
