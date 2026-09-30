import type { QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { getSession, subscribeSession } from './tokens';

/** Storage events also cover a logout/account change from another tab. */
export function observeAuthSession(queryClient: QueryClient): () => void {
  const synchronize = () => {
    const id = getSession()?.id ?? null;
    const state = useAuthStore.getState();
    if (state.isHydrated && state.sessionId === id) return;
    // Cancels cached query work before making the replacement login visible.
    queryClient.clear();
    state.setSession(id);
  };
  const stop = subscribeSession(synchronize);
  synchronize();
  return stop;
}
