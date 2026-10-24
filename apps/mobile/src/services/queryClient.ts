/**
 * Shared TanStack Query configuration.
 *
 * Retry policy: never retry 4xx (client errors are deterministic), retry
 * network/5xx errors twice with backoff. Stale time of 30s avoids refetch
 * storms when navigating back and forth. Mutations never auto-retry.
 */

import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/services/api/client';

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof ApiError) {
    // Deterministic client errors should not be retried.
    if (error.status >= 400 && error.status < 500) return false;
  }
  return true;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
