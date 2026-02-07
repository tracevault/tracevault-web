'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { useAuthStore } from '@/stores';
import { hasTokens } from '@/lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  // TEMPORARY: Bypass auth for UI testing
  const BYPASS_AUTH = true;

  const router = useRouter();
  const { isAuthenticated, isHydrated } = useAuthStore();

  useEffect(() => {
    if (!BYPASS_AUTH && isHydrated && !isAuthenticated && !hasTokens()) {
      router.push('/login');
    }
  }, [isHydrated, isAuthenticated, router]);

  if (BYPASS_AUTH) {
    return <>{children}</>;
  }

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated && !hasTokens()) {
    return null;
  }

  return <>{children}</>;
}
