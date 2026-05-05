import { type APIRequestContext } from '@playwright/test';
import { type BookItem } from './books';

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

/**
 * Registers a new user account against the DemoQA Account API.
 * @throws if the API responds with a non-2xx status.
 */
export async function registerUser(
  api: APIRequestContext,
  userData: NewUser,
): Promise<RegisteredUser> {
  const response = await api.post(`${API_BASE_URL}/Account/v1/User`, { data: userData });
  if (!response.ok()) {
    throw new Error(`[registerUser] unexpected status ${response.status()}: ${await response.text()}`);
  }
  const body = (await response.json()) as RawRegisteredUser;
  return { userID: body.userID, username: body.username, books: body.books ?? [] };
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
  if (!response.ok()) {
    throw new Error(`[generateToken] unexpected status ${response.status()}: ${await response.text()}`);
  }
  const body = (await response.json()) as RawTokenResponse;
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
  if (!response.ok()) {
    throw new Error(`[getUserProfile] unexpected status ${response.status()}: ${await response.text()}`);
  }
  const body = (await response.json()) as RawUserProfile;
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
