'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient, apiClientNoAuth } from '@/lib/api';
import { browserLogin } from '@/lib/api/login';
import { logoutSession } from '@/lib/api/client';
import { startSession, getSession, clearTokens } from '@/lib/auth';
import { useAuthStore } from '@/stores';
import type {
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  User,
  UpdateProfileRequest,
  UpdateProfileResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  DeleteAccountResponse,
} from '@/types';

export function useLogin() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const previousSessionId = getSession()?.id ?? null;
      const response = await browserLogin(credentials);

      const session = await startSession(response.access_token, response.refresh_token, previousSessionId);
      return { ...response, sessionId: session.id };
    },
    onSuccess: (data) => {
      if (getSession()?.id !== data.sessionId) return;
      setUser(data.user, data.sessionId);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      // AuthRedirect owns navigation after the authenticated store changes.
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (data: RegisterRequest) => {
      const previousSessionId = getSession()?.id ?? null;
      const response = await apiClientNoAuth<RegisterResponse>(
        '/api/v1/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );

      const session = await startSession(response.access_token, response.refresh_token, previousSessionId);
      return { ...response, sessionId: session.id };
    },
    onSuccess: (data) => {
      if (getSession()?.id !== data.sessionId) return;
      setUser(data.user, data.sessionId);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      // AuthRedirect owns navigation after the authenticated store changes.
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: logoutSession,
    onSettled: () => {
      if (getSession()) return;
      queryClient.clear();
      router.push('/login');
    },

  });
}

export function useCurrentUser(enabled = true) {
  const setUser = useAuthStore((state) => state.setUser);
  const sessionId = useAuthStore((state) => state.sessionId);

  return useQuery({
    queryKey: ['user', sessionId],
    queryFn: async () => {
      const user = await apiClient<User>('/api/v1/users/me');
      if (sessionId) setUser(user, sessionId);
      return user;
    },
    enabled: enabled && !!sessionId,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (data: UpdateProfileRequest) => {
      const sessionId = getSession()?.id;
      const response = await apiClient<UpdateProfileResponse>(
        '/api/v1/users/me',
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        }
      );
      if (sessionId) setUser(response, sessionId);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: ChangePasswordRequest) => {
      const sessionId = getSession()?.id;
      const response = await apiClient<ChangePasswordResponse>(
        '/api/v1/users/me/password',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );
      if (sessionId) await clearTokens(sessionId);
      return response;
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      const sessionId = getSession()?.id;
      const response = await apiClient<DeleteAccountResponse>(
        '/api/v1/users/me',
        {
          method: 'DELETE',
        }
      );
      if (sessionId) await clearTokens(sessionId);
      return response;
    },
    onSuccess: () => {
      if (getSession()) return;
      queryClient.clear();
      router.push('/');
    },
  });
}
