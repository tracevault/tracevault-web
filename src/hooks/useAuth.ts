'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient, apiClientNoAuth } from '@/lib/api';
import { setAccessToken, setRefreshToken, clearTokens } from '@/lib/auth';
import { useAuthStore } from '@/stores';
import type {
  LoginRequest,
  LoginResponse,
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
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const response = await apiClientNoAuth<LoginResponse>(
        '/api/v1/auth/login',
        {
          method: 'POST',
          body: JSON.stringify(credentials),
        }
      );

      setAccessToken(response.access_token);
      setRefreshToken(response.refresh_token);

      return response;
    },
    onSuccess: (data) => {
      setUser(data.user);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      router.push('/dashboard');
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (data: RegisterRequest) => {
      const response = await apiClientNoAuth<RegisterResponse>(
        '/api/v1/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );

      setAccessToken(response.access_token);
      setRefreshToken(response.refresh_token);

      return response;
    },
    onSuccess: (data) => {
      setUser(data.user);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      router.push('/dashboard');
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  return useMutation({
    mutationFn: async () => {
      try {
        await apiClient('/api/v1/auth/logout', {
          method: 'POST',
        });
      } catch {
        // Ignore logout errors - we clear local state anyway
      }
    },
    onSettled: () => {
      logout();
      clearTokens();
      queryClient.clear();
      router.push('/login');
    },
  });
}

export function useCurrentUser() {
  const setUser = useAuthStore((state) => state.setUser);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const user = await apiClient<User>('/api/v1/users/me');
      setUser(user);
      return user;
    },
    enabled: isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (data: UpdateProfileRequest) => {
      const response = await apiClient<UpdateProfileResponse>(
        '/api/v1/users/me',
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        }
      );
      return response;
    },
    onSuccess: (data) => {
      setUser({
        id: data.id,
        email: data.email,
        name: data.name,
        created_at: data.created_at,
        updated_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: ChangePasswordRequest) => {
      const response = await apiClient<ChangePasswordResponse>(
        '/api/v1/users/me/password',
        {
          method: 'PUT',
          body: JSON.stringify(data),
        }
      );
      return response;
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient<DeleteAccountResponse>(
        '/api/v1/users/me',
        {
          method: 'DELETE',
        }
      );
      return response;
    },
    onSuccess: () => {
      logout();
      clearTokens();
      queryClient.clear();
      router.push('/');
    },
  });
}
