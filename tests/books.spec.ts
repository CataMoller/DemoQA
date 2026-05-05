import { randomUUID } from 'crypto';
import test, { expect } from '@/fixtures';
import { getBook, listBooks } from '@/functions/books';

// Read-only catalog test — no user creation needed
test('Books > Catalog > Book list returns at least one book', {
  annotation: { type: 'ID', description: 'BOOK-001' },
}, async ({ apiContext }) => {
  const api = apiContext.request;

  const books = await listBooks(api);

  expect(books.length).toBeGreaterThan(0);

  const [first] = books;
  expect(typeof first.isbn).toBe('string');
  expect(first.isbn.length).toBeGreaterThan(0);
  expect(typeof first.title).toBe('string');
  expect(first.title.length).toBeGreaterThan(0);
  expect(typeof first.author).toBe('string');
  expect(first.author.length).toBeGreaterThan(0);

  for (const book of books) {
    expect(book).toHaveProperty('isbn');
    expect(typeof book.isbn).toBe('string');
  }
});

// Read-only catalog test — no user creation needed
test('Books > Catalog > Single book can be fetched by ISBN', {
  annotation: { type: 'ID', description: 'BOOK-002' },
}, async ({ apiContext }) => {
  const api = apiContext.request;

  const books = await listBooks(api);
  expect(books.length).toBeGreaterThan(0);
  const [first] = books;

  const fetched = await getBook(api, first.isbn);
  expect(fetched.isbn).toBe(first.isbn);
  expect(typeof fetched.title).toBe('string');
  expect(fetched.title.length).toBeGreaterThan(0);
  expect(typeof fetched.author).toBe('string');
  expect(fetched.author.length).toBeGreaterThan(0);

  await expect(getBook(api, 'INVALID-ISBN')).rejects.toThrow(/Expected status 200/);
});

// Read-only catalog test — no user creation needed
test('Books > Catalog > Search filters books by title', {
  annotation: { type: 'ID', description: 'BOOK-003' },
}, async ({ customPage: page, apiContext }) => {
  const api = apiContext.request;

  const allBooks = await listBooks(api);
  expect(allBooks.length).toBeGreaterThan(0);
  const target = allBooks[0];

  await page.goto('/books');
  await page.waitForSelector('#searchBox', { timeout: 10000 });

  await page.fill('#searchBox', target.title);

  const bookRowLinks = page.locator('a[href*="?search="]');
  await expect(bookRowLinks.first()).toBeVisible();
  expect(await bookRowLinks.count()).toBeGreaterThan(0);
  await expect(page.getByText(target.title).first()).toBeVisible();

  await page.fill('#searchBox', randomUUID());
  await expect(bookRowLinks).toHaveCount(0);
});
