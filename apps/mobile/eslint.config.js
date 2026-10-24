// Expo ESLint flat config for the mobile app.
//
// Note: eslint-config-expo pulls in eslint-plugin-react, whose version auto-
// detection crashes under ESLint 10 (it calls the removed context.getFilename()).
// Pinning the React version in settings skips that auto-detect path.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
    settings: {
      react: { version: '19.3.0' },
    },
    rules: {
      'no-console': 'off',
    },
  },
]);
