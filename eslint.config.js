const js = require('@eslint/js');
const playwright = require('eslint-plugin-playwright');

module.exports = [
  js.configs.recommended,
  {
    ignores: [
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'auth-state/**',
      'dist/**',
    ],
  },
  {
    files: ['**/*.ts'],
    plugins: {
      playwright,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      ...playwright.configs.recommended.rules,
      'playwright/expect-expect': 'error',
      'playwright/no-conditional-in-test': 'warn',
      'playwright/no-focused-test': 'error',
      'playwright/no-skipped-test': 'warn',
      'playwright/no-wait-for-timeout': 'warn',
      'playwright/no-force-option': 'warn',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/valid-expect': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
];
