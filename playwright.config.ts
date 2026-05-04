import { defineConfig, devices } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile(envPath: string): void {
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"](.*)['"]$/, '$1');
  }
}

loadEnvFile(path.resolve(__dirname, '.env'));

const isCI = !!process.env.CI;
const STORAGE_STATE = path.resolve(__dirname, 'auth-state', 'user.json');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ...(isCI ? [['github'] as ['github']] : []),
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://demoqa.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: undefined,
      },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
      use: {
        baseURL: process.env.API_BASE_URL ?? 'https://demoqa.com',
      },
    },
  ],
  outputDir: 'test-results',
});
