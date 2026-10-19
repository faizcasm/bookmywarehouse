import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Vitest runs without injected globals, so Testing Library cannot register its
// own auto-cleanup — do it explicitly here.
afterEach(() => {
  cleanup();
});
