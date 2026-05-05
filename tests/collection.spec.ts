import test, { expect } from '@/fixtures';
import {
  deleteUser,
  generateToken,
  getUserProfile,
  registerUser,
} from '@/functions/auth';
import {
  addToCollection,
  clearCollection,
  listBooks,
  removeFromCollection,
} from '@/functions/books';
import { generateUserData } from '@/functions/testData';

test('Books > Collection > Add book and verify in profile', {
  annotation: { type: 'ID', description: 'COLL-001' },
}, async ({ customPage: page, apiContext }) => {
  const credentials = generateUserData();
  const apiRaw = apiContext.request;
  let userId = '';
  let token = '';
  try {
    // Arrange
    await registerUser(page, credentials);
    const api = await page.getAPI();
    userId = await page.getUserId();
    token = await page.evaluate(
      () => (JSON.parse(window.localStorage.getItem('userInfo') ?? '{}') as { token: string }).token,
    );

    const books = await listBooks(apiRaw);
    const target = books[0];

    // Act
    await addToCollection(api, userId, target.isbn, token);

    // Assert
    const profile = await getUserProfile(apiRaw, userId, token);
    expect(profile.books).toHaveLength(1);
    expect(profile.books[0].isbn).toBe(target.isbn);

    await page.goto('/profile');
    await expect(page.getByText(target.title).first()).toBeVisible();
  } finally {
    // Cleanup
    if (userId && token) {
      await clearCollection(apiRaw, userId, token);
      await deleteUser(apiRaw, userId, token);
    }
  }
});

test('Books > Collection > Remove book from collection', {
  annotation: { type: 'ID', description: 'COLL-002' },
}, async ({ customPage: page, apiContext }) => {
  const apiRaw = apiContext.request;
  const credentials = generateUserData();
  let userId = '';
  let token = '';
  try {
    await registerUser(page, credentials);
    const api = await page.getAPI();
    userId = await page.getUserId();
    token = await page.evaluate(
      () => (JSON.parse(window.localStorage.getItem('userInfo') ?? '{}') as { token: string }).token,
    );

    const books = await listBooks(api);
    const firstBook = books[0];
    await addToCollection(api, userId, firstBook.isbn, token);
    await removeFromCollection(api, userId, firstBook.isbn, token);

    const profile = await getUserProfile(api, userId, token);
    expect(Array.isArray(profile.books)).toBe(true);
    expect(profile.books).toHaveLength(0);
    expect(profile.books).toEqual([]);
  } finally {
    if (token && userId) {
      await clearCollection(apiRaw, userId, token);
      await deleteUser(apiRaw, userId, token);
    }
  }
});

test('Books > Collection > Full E2E — register, add, verify, remove, verify gone', {
  annotation: { type: 'ID', description: 'COLL-003' },
}, async ({ customPage: page, apiContext }) => {
  const apiRaw = apiContext.request;
  const credentials = generateUserData();
  let userId = '';
  let token = '';
  try {
    await registerUser(page, credentials);
    const api = await page.getAPI();
    userId = await page.getUserId();
    token = await page.evaluate(
      () => (JSON.parse(window.localStorage.getItem('userInfo') ?? '{}') as { token: string }).token,
    );

    const books = await listBooks(api);
    expect(books.length).toBeGreaterThan(0);
    const firstBook = books[0];

    await addToCollection(api, userId, firstBook.isbn, token);

    const afterAdd = await getUserProfile(api, userId, token);
    expect(afterAdd.books).toHaveLength(1);
    expect(afterAdd.books[0].isbn).toBe(firstBook.isbn);

    await removeFromCollection(api, userId, firstBook.isbn, token);

    const afterRemove = await getUserProfile(api, userId, token);
    expect(afterRemove.books).toHaveLength(0);
    expect(afterRemove.books).toEqual([]);
    expect(Array.isArray(afterRemove.books)).toBe(true);
  } finally {
    if (token && userId) {
      await clearCollection(apiRaw, userId, token);
      await deleteUser(apiRaw, userId, token);
    }
  }
});

test('Books > Collection > Adding duplicate book is rejected', {
  annotation: { type: 'ID', description: 'COLL-004' },
}, async ({ apiContext }) => {
  const api = apiContext.request;
  const credentials = generateUserData();
  let userId = '';
  let token = '';
  try {
    const registered = await registerUser(api, credentials);
    userId = registered.userID;
    token = await generateToken(api, credentials);

    const books = await listBooks(api);
    const firstBook = books[0];
    await addToCollection(api, userId, firstBook.isbn, token);

    await expect(addToCollection(api, userId, firstBook.isbn, token)).rejects.toThrow(
      /Expected status 201/,
    );

    const profile = await getUserProfile(api, userId, token);
    expect(profile.books).toHaveLength(1);
    expect(profile.books[0].isbn).toBe(firstBook.isbn);
  } finally {
    if (token && userId) {
      await clearCollection(api, userId, token);
      await deleteUser(api, userId, token);
    }
  }
});
