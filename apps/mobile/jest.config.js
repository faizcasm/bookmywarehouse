module.exports = {
  preset: 'jest-expo',
  // pnpm nests real packages under node_modules/.pnpm/<pkg>@ver/node_modules/<pkg>,
  // so the allowlist must account for the extra `.pnpm/` segment (otherwise the
  // preset's own ESM setup files fail to transform).
  transformIgnorePatterns: [
    'node_modules/(?!((\\.pnpm/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-worklets|react-native-reanimated|lucide-react-native|@bmw/.*)))',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
  },
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/test/**'],
  clearMocks: true,
};
