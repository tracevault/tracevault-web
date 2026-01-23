import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearTokens,
} from '@/lib/auth';
import { AuthError, ApiRequestError } from '@/types';
import type { RefreshTokenResponse } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      return null;
    }

    const data: RefreshTokenResponse = await response.json();
    setAccessToken(data.access_token);
    setRefreshToken(data.refresh_token);
    return data.access_token;
  } catch {
    clearTokens();
    return null;
  }
}

async function getValidAccessToken(): Promise<string | null> {
  const token = getAccessToken();
  if (token) {
    return token;
  }

  if (isRefreshing) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = refreshAccessToken().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getValidAccessToken();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    if (isRefreshing) {
      const newToken = await refreshPromise;
      if (newToken) {
        return apiClient(endpoint, options);
      }
    } else {
      const newToken = await refreshAccessToken();
      if (newToken) {
        return apiClient(endpoint, options);
      }
    }

    clearTokens();
    throw new AuthError('Session expired');
  }

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      throw new ApiRequestError(
        'UNKNOWN_ERROR',
        `HTTP error ${response.status}`
      );
    }
    throw new ApiRequestError(
      errorData.code || 'UNKNOWN_ERROR',
      errorData.message || 'An error occurred',
      errorData.details
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function apiClientNoAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      throw new ApiRequestError(
        'UNKNOWN_ERROR',
        `HTTP error ${response.status}`
      );
    }
    throw new ApiRequestError(
      errorData.code || 'UNKNOWN_ERROR',
      errorData.message || 'An error occurred',
      errorData.details
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}
