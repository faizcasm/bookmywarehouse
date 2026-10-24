import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '.vercel/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/*.d.ts',
      // The Expo mobile app ships its own flat config (apps/mobile/eslint.config.js,
      // eslint-config-expo) that understands its React Native / Expo module resolution
      // and path aliases; it is linted separately via `expo lint`. The repo-wide pass
      // below targets the web apps + API and cannot resolve the mobile `@/*` alias.
      'apps/mobile/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts,js,mjs}'],
    plugins: { 'unused-imports': unusedImports },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2023 },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    // Frontend apps + the shared UI package run in the browser.
    files: [
      'apps/customer/**/*.{ts,tsx}',
      'apps/partner/**/*.{ts,tsx}',
      'apps/admin/**/*.{ts,tsx}',
      'packages/ui/**/*.{ts,tsx}',
    ],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      // The async data-fetch effect pattern (useEffect(() => { void load(); }, [load]))
      // sets state after an await — the compiler rule is too strict for this codebase.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    // Seed/dev scripts and CLI entry points legitimately log to stdout.
    files: [
      'apps/api/src/seed/**',
      'apps/api/src/scripts/**',
      'apps/api/src/server.ts',
      'apps/api/src/lib/logger.ts',
      '**/vitest.config.ts',
      '**/vite.config.ts',
      '**/playwright.config.ts',
      'eslint.config.mjs',
    ],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['**/src/tests/**', '**/src/test/**', 'apps/e2e/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
);
