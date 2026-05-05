import { type APIRequestContext } from '@playwright/test';

const API_BASE_URL = process.env.API_BASE_URL ?? 'https://demoqa.com';

export interface BookItem {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
}

interface RawBooksResponse {
  books: BookItem[];
}

/**
 * Returns the catalog of books exposed by the BookStore API.
 * @throws if the API responds with a non-2xx status.
 */
export async function listBooks(api: APIRequestContext): Promise<BookItem[]> {
  const response = await api.get(`${API_BASE_URL}/BookStore/v1/Books`);
  if (!response.ok()) {
    throw new Error(`[listBooks] unexpected status ${response.status()}: ${await response.text()}`);
  }
  const body = (await response.json()) as RawBooksResponse;
  return body.books;
}

/**
 * Fetches a single book by its ISBN.
 * @throws if the API responds with a non-2xx status (e.g. unknown ISBN → 400).
 */
export async function getBook(api: APIRequestContext, isbn: string): Promise<BookItem> {
  const response = await api.get(`${API_BASE_URL}/BookStore/v1/Book`, {
    params: { ISBN: isbn },
  });
  if (!response.ok()) {
    throw new Error(`[getBook] unexpected status ${response.status()}: ${await response.text()}`);
  }
  return (await response.json()) as BookItem;
}

/**
 * Adds a single book (by ISBN) to the user's collection.
 * @throws if the API responds with a non-2xx status.
 */
export async function addToCollection(
  api: APIRequestContext,
  userId: string,
  isbn: string,
  token: string,
): Promise<void> {
  const response = await api.post(`${API_BASE_URL}/BookStore/v1/Books`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { userId, collectionOfIsbns: [{ isbn }] },
  });
  if (!response.ok()) {
    throw new Error(
      `[addToCollection] unexpected status ${response.status()}: ${await response.text()}`,
    );
  }
}

/**
 * Removes a single book (by ISBN) from the user's collection.
 * @throws if the API responds with a non-2xx status.
 */
export async function removeFromCollection(
  api: APIRequestContext,
  userId: string,
  isbn: string,
  token: string,
): Promise<void> {
  const response = await api.delete(`${API_BASE_URL}/BookStore/v1/Book`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { userId, isbn },
  });
  if (!response.ok()) {
    throw new Error(
      `[removeFromCollection] unexpected status ${response.status()}: ${await response.text()}`,
    );
  }
}

/**
 * Empties the user's book collection. Tolerant for cleanup use: also accepts
 * 401 (token expired) and 404 (no collection) without throwing, so it is safe
 * to call from `finally` blocks even when the collection is already empty.
 */
export async function clearCollection(
  api: APIRequestContext,
  userId: string,
  token: string,
): Promise<void> {
  const response = await api.delete(`${API_BASE_URL}/BookStore/v1/Books`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { UserId: userId },
  });
  const status = response.status();
  if (status === 200 || status === 204 || status === 401 || status === 404) return;
  throw new Error(`[clearCollection] unexpected status ${status}: ${await response.text()}`);
}
