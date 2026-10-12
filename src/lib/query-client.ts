import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';

function shouldRetry(failureCount: number, error: unknown): boolean {
  // Client errors (auth, validation, permissions, not found) never succeed on retry.
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Writes are never retried automatically: a timeout may still have been applied server-side.
      retry: false,
    },
  },
});
