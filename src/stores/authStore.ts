'use client';

import { create } from 'zustand';
import type { User } from '@/types';
import { getSession } from '@/lib/auth';

interface AuthState {
  user: User | null;
  sessionId: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setUser: (user: User | null, sessionId: string) => void;
  setSession: (sessionId: string | null) => void;
}

// Credentials are the sole persisted authority. Never restore an independent
// user/isAuthenticated flag that can outlive logout or belong to another login.
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  sessionId: null,
  isAuthenticated: false,
  isHydrated: false,
  setUser: (user, sessionId) => {
    if (getSession()?.id !== sessionId) return;
    set({ user });
  },
  setSession: (sessionId) => set({
    user: null, sessionId, isAuthenticated: sessionId !== null, isHydrated: true,
  }),
}));
