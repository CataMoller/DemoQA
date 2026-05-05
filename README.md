# DemoQA Playwright Testing Framework

Production-ready Playwright + TypeScript testing framework for the DemoQA Book Store application. Covers UI, API, and end-to-end flows across Chromium, Firefox, and WebKit.

## Overview

- **Application under test:** [DemoQA Book Store](https://demoqa.com/books) — public demo app exposing a UI at `https://demoqa.com` and a REST API at `https://demoqa.com/Account/v1` and `https://demoqa.com/BookStore/v1`.
- **Three-layer architecture:**
  1. **Fixtures layer** — [`fixtures/BasePage.ts`](fixtures/BasePage.ts) and [`fixtures/BaseAPI.ts`](fixtures/BaseAPI.ts), wired into Playwright via [`fixtures/index.ts`](fixtures/index.ts).
  2. **Helper functions layer** — [`functions/auth.ts`](functions/auth.ts), [`functions/books.ts`](functions/books.ts), [`functions/testData.ts`](functions/testData.ts), [`functions/utils.ts`](functions/utils.ts).
  3. **Test layer** — specs in [`tests/`](tests/) following the AAA pattern with `try/finally` cleanup.

### Key design decisions

1. **Proxy pattern in `BasePage`.** A `Proxy` wraps the Playwright `Page` so domain-specific helpers (`getAPI`, `getUserId`, `getUserData`) sit on the same object as the native Playwright API. Tests call `page.goto(...)` and `page.getUserId()` interchangeably without juggling two references.
2. **`try/finally` cleanup.** Every test that mutates state wraps its work in `try/finally`, calling `deleteUser` and `clearCollection` in `finally`. Cleanup runs even when an assertion throws, so a failing test never leaks orphan accounts or polluted collections.
3. **Parallel-safe tests.** Each test calls `generateUserData()` (Faker-backed `uniqueUsername` + `uniquePassword`) and registers its own user. There is no shared mutable state between tests, so `fullyParallel: true` is safe across workers.
4. **Auth state strategy.** A `setup` project ([`tests/auth.setup.ts`](tests/auth.setup.ts)) logs in the shared `TEST_USERNAME` once and writes cookies + localStorage to [`auth-state/user.json`](auth-state/) (path defined in [`paths.ts`](paths.ts)). Browser projects depend on `setup` and start authenticated. Per-test users are an independent layer: created and destroyed via the API inside each test.

## Prerequisites

- **Node.js** ≥ 18 (see [`package.json#engines`](package.json))
- **OS:** Windows, macOS, or Linux
- **DemoQA account** for the shared setup user — register at <https://demoqa.com/register>, then put the credentials in `TEST_USERNAME` and `TEST_PASSWORD`

## Installation

```bash
git clone <repo-url>
cd <repo-name>
npm ci
npx playwright install --with-deps chromium firefox webkit
```

## Environment setup

1. Copy the template:
   ```bash
   cp .env.example .env
   ```
2. Fill in all four variables. The contents of [`.env.example`](.env.example):
   ```dotenv
   # Base URL of the DemoQA web application under test
   BASE_URL=https://demoqa.com

   # Base URL for the DemoQA REST API (BookStore, Account endpoints)
   API_BASE_URL=https://demoqa.com

   # Username of the test account used for authenticated flows
   TEST_USERNAME=your_test_username

   # Password of the test account used for authenticated flows
   TEST_PASSWORD=your_test_password
   ```
   - `BASE_URL` — UI origin used by Playwright's `baseURL` (drives `page.goto('/login')`, etc.).
   - `API_BASE_URL` — API origin used by helpers in `functions/auth.ts` and `functions/books.ts`.
   - `TEST_USERNAME` / `TEST_PASSWORD` — shared user logged in once by `auth.setup.ts`.
3. **Important:** `BASE_URL` must be `https://demoqa.com`, not `https://demoqa.com/books`. The framework appends paths (`/login`, `/profile`, `/books`) on its own.
4. **Never commit `.env`.** It is listed in [`.gitignore`](.gitignore); only `.env.example` is tracked.

## Running tests

| Command | What it does |
|---|---|
| `npx playwright test` | Run the full suite across all browsers (chromium, firefox, webkit) plus the `setup` project. |
| `npx playwright test --project=chromium` | Run only the chromium project (still depends on `setup`). |
| `npx playwright test tests/auth.spec.ts` | Run a single spec file. |
| `npx playwright test --grep "COLL-001"` | Run a single test by its annotation ID. |
| `npx playwright test --ui` | Open Playwright's interactive UI runner. |
| `npx playwright show-report` | Open the HTML report from the last run. |

The repo also exposes npm aliases (`npm test`, `npm run test:ui`, `npm run test:chromium`, `npm run report`) — see [`package.json`](package.json).

## Project structure

```
├── fixtures/
│   ├── BasePage.ts      ← Proxy wrapper: merges native Page + domain methods
│   ├── BaseAPI.ts       ← Unauthenticated API wrapper with checkResponse
│   └── index.ts         ← Extended test with customPage and apiContext fixtures
├── functions/
│   ├── auth.ts          ← registerUser, generateToken, getUserProfile, deleteUser, loginUser
│   ├── books.ts         ← listBooks, getBook, addToCollection, removeFromCollection, clearCollection
│   ├── testData.ts      ← Faker-based generators: uniqueUsername, uniquePassword, generateUserData, buildAddBookPayload
│   └── utils.ts         ← assertResponse: centralized HTTP status assertion
├── tests/
│   ├── auth.setup.ts    ← Runs once before suite: saves shared auth state
│   ├── auth.spec.ts     ← AUTH-001 to AUTH-004
│   ├── books.spec.ts    ← BOOK-001 to BOOK-003
│   └── collection.spec.ts ← COLL-001 to COLL-004
├── auth-state/
│   └── .gitkeep         ← Directory tracked; user.json is gitignored
├── paths.ts             ← Single source of truth for STORAGE_STATE path
├── playwright.config.ts ← Full config: parallel, retries, trace, projects
├── tsconfig.json        ← Strict mode, @/* path alias
├── .env.example         ← Required environment variables with descriptions
└── .gitignore
```

## Architecture decisions

### Custom fixtures

Both fixtures are wired in [`fixtures/index.ts`](fixtures/index.ts) and imported as a single `test`:

```ts
import test, { expect } from '@/fixtures';
```

#### `customPage` (Proxy pattern in `BasePage`)

`BasePage` is constructed as a JavaScript `Proxy` whose `get` trap looks up properties first on the `BasePage` instance (custom domain methods) and falls back to the underlying Playwright `Page` (native API). Function values are bound to their original owner so `this` is preserved on both sides — Playwright's internal state stays intact while custom methods keep access to the BasePage instance.

The result: one fixture exposes both APIs without an extra `page.raw` accessor or wrapper indirection. The `BasePageType` alias (`BasePage & Page`) gives the call site full IntelliSense for both surfaces.

```ts
test('profile renders the logged-in user', async ({ customPage: page }) => {
  // Native Playwright Page methods
  await page.goto('/profile');
  await expect(page.getByText('username')).toBeVisible();

  // BasePage custom domain methods
  const api = await page.getAPI();         // pre-authed APIRequestContext
  const userId = await page.getUserId();   // from localStorage.userInfo
  const data = await page.getUserData();   // { userId, username, password, books }
});
```

#### `apiContext` (`BaseAPI` wrapper)

`apiContext` wraps Playwright's `APIRequestContext` and adds `checkResponse<T>(response, expectedStatus)` for one-line status assertions that return the parsed JSON body.

```ts
test('catalog returns books', async ({ apiContext }) => {
  const response = await apiContext.request.get('/BookStore/v1/Books');
  const body = await apiContext.checkResponse<{ books: BookItem[] }>(response, 200);
  expect(body.books.length).toBeGreaterThan(0);
});
```

Use both together when a test mixes UI + API checks: `async ({ customPage: page, apiContext }) => { ... }`.

### Helper function library

| Module | Functions | Purpose |
|---|---|---|
| [`auth.ts`](functions/auth.ts) | `registerUser`, `generateToken`, `getUserProfile`, `deleteUser`, `loginUser` | Account lifecycle against the DemoQA `/Account/v1` API. `registerUser` is overloaded: API-only or full UI login that syncs cookie auth into `localStorage.userInfo`. |
| [`books.ts`](functions/books.ts) | `listBooks`, `getBook`, `addToCollection`, `removeFromCollection`, `clearCollection` | Book catalog reads and per-user collection mutations against `/BookStore/v1`. `clearCollection` tolerates 401/404 for safe cleanup. |
| [`testData.ts`](functions/testData.ts) | `uniqueUsername`, `uniquePassword`, `generateUserData`, `buildAddBookPayload` | Faker-driven generators that satisfy DemoQA's username (≤30 chars, no whitespace) and password (≥8 chars with upper/lower/digit/special) policies. |
| [`utils.ts`](functions/utils.ts) | `assertResponse` | Single-status HTTP assertion that throws with URL, status, and body context, returns parsed JSON, and treats 204 as `undefined`. |

### Test design principles

- **Unique credentials.** Every test calls `generateUserData()` and registers its own user — no shared user accounts across tests.
- **Guaranteed cleanup.** `try/finally` ensures `deleteUser` and (where relevant) `clearCollection` run even when an assertion throws.
- **Idempotent cleanup.** `deleteUser` accepts 200/204/404/401 and `clearCollection` accepts 200/204/401/404, so it's safe to call them in `finally` even if the resource was never created or the token has already expired.
- **Parallel execution.** `fullyParallel: true` in [`playwright.config.ts`](playwright.config.ts) — tests never share state, so workers run them concurrently without coordination.

## Test inventory

| ID | Test name | Fixture | Coverage area |
|---|---|---|---|
| AUTH-001 | Auth > Register > New user can register successfully | `apiContext` | Account API: `POST /Account/v1/User` returns 201 with userID, username, empty books. |
| AUTH-002 | Auth > Login > Registered user receives a valid JWT | `apiContext` | Token generation: `POST /Account/v1/GenerateToken` returns a 3-segment JWT; profile reachable. |
| AUTH-003 | Auth > Login > Invalid credentials return 401 | `apiContext` | Negative auth: `generateToken` rejects with the expected error message on wrong password. |
| AUTH-004 | Auth > Profile > Correct user data is displayed after login | both | UI login + cookie→localStorage sync, profile page renders username. |
| BOOK-001 | Books > Catalog > Book list returns at least one book | `apiContext` | `GET /BookStore/v1/Books` shape + non-empty catalog. |
| BOOK-002 | Books > Catalog > Single book can be fetched by ISBN | `apiContext` | `GET /BookStore/v1/Book?ISBN=...` round-trip; invalid ISBN throws. |
| BOOK-003 | Books > Catalog > Search filters books by title | both | UI search box on `/books` filters rows; junk query yields 0 rows. |
| COLL-001 | Books > Collection > Add book and verify in profile | both | `addToCollection` reflected in profile API and `/profile` UI. |
| COLL-002 | Books > Collection > Remove book from collection | both | `addToCollection` then `removeFromCollection` leaves collection empty. |
| COLL-003 | Books > Collection > Full E2E — register, add, verify, remove, verify gone | both | Full lifecycle in one test: register → add → assert → remove → assert. |
| COLL-004 | Books > Collection > Adding duplicate book is rejected | `apiContext` | Second `addToCollection` for the same ISBN throws; profile still shows one book. |

Fixture key: `apiContext` = pure API test using the `BaseAPI` fixture; `customPage` = browser-only test using the `BasePage` proxy; `both` = uses both fixtures.

## CI/CD

See [`.github/workflows/playwright.yml`](.github/workflows/playwright.yml) — runs on push to `main`, on pull requests, and nightly at 00:00 UTC. *(File to be added next.)*

## Coding standards

- **TypeScript strict mode.** All strict flags enabled explicitly in [`tsconfig.json`](tsconfig.json) (`strict`, `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`).
- **No bare `any` in public signatures.** `unknown[]` is used for variable-shape payloads (e.g. `BasePage.UserData.books`).
- **ESLint** with `@eslint/js` recommended + `eslint-plugin-playwright` recommended rules (`expect-expect`, `no-focused-test`, `prefer-web-first-assertions`, `valid-expect`, …) plus `eqeqeq`, `prefer-const`, and a `no-console` allow-list. See [`eslint.config.js`](eslint.config.js).
- **Prettier** — single quotes, semicolons, trailing commas, 100-column width, LF line endings. See [`.prettierrc.json`](.prettierrc.json).
- **Conventional commits** — `chore:` / `feat:` / `refactor:` / `docs:` / `fix:` prefixes (visible in `git log`).
- **AAA pattern** — every spec body is structured `Arrange / Act / Assert / Cleanup`, with cleanup in a `finally` block.
