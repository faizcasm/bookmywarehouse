/**
 * Jest setup — runs before each test file. Mocks the native modules that have
 * no jest-expo implementation so unit tests can render components and exercise
 * the API client without a device.
 */

// expo-secure-store has no native impl under jest; back it with an in-memory map.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  };
});

// AsyncStorage has a memory mock but keep it isolated per test.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Silence the reanimated/worklets import noise in unit tests.
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// expo-image renders a plain view in tests.
jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Image: (props: unknown) => React.createElement(View, props) };
});
