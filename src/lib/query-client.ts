import { AppState, type AppStateStatus } from 'react-native';
import { focusManager, QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';

function shouldRetry(failureCount: number, error: unknown): boolean {
  // Client errors (auth, validation, permissions, not found) never succeed on retry.
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data fresh for only 2 seconds so screens that don't poll still show
      // recent server values after navigation or tab switches. Screens that poll
      // (refetchInterval) always bypass staleTime anyway.
      staleTime: 2_000,
      gcTime: 5 * 60_000,
      retry: shouldRetry,
      // React Native doesn't emit browser window-focus events. focusManager below
      // maps AppState changes to query focus; always refresh when a screen remounts.
      refetchOnWindowFocus: true,
      refetchOnMount: 'always',
    },
    mutations: {
      // Writes are never retried automatically: a timeout may still have been applied server-side.
      retry: false,
    },
  },
});

// Bridge React Native foreground/background state into TanStack Query.
// Returning to the app invalidates cached data so inventory, dashboard, and other
// active screens fetch the latest server values instead of showing stale cache.
focusManager.setEventListener((setFocused) => {
  const onAppStateChange = (status: AppStateStatus) => {
    const active = status === 'active';
    setFocused(active);
    if (active) {
      void queryClient.invalidateQueries();
    }
  };

  const subscription = AppState.addEventListener('change', onAppStateChange);
  setFocused(AppState.currentState === 'active');
  return () => subscription.remove();
});
