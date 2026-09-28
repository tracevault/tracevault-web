'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useEffect, useState, Fragment } from 'react';
import { observeAuthSession } from '@/lib/auth/lifecycle';
import { useAuthStore } from '@/stores';
import { AuthError } from '@/types';
import { useCurrentUser } from '@/hooks/useAuth';

function SessionBoundary({ children, queryClient }: { children: React.ReactNode; queryClient: QueryClient }) {
  const sessionId = useAuthStore(s => s.sessionId);
  const pathname = usePathname();
  const publicAction = ['/verify-email', '/reset-password', '/forgot-password', '/two-factor'].includes(pathname);
  // Factor enrollment deliberately revokes the current session. Do not race
  // its one-time response with background profile revalidation on this route.
  useCurrentUser(pathname !== '/two-factor');
  useEffect(() => observeAuthSession(queryClient), [queryClient]);
  // Reset local account-specific component state, including outstanding mutations.
  // One-time links are independent of the signed-in account. Preserve their
  // in-memory state across hydration or successful reset revoking the session.
  return <Fragment key={publicAction ? 'public-account-action' : sessionId ?? 'anonymous'}>{children}</Fragment>;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: (failures, error) => failures < 1 && !(error instanceof AuthError),
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}><SessionBoundary queryClient={queryClient}>{children}</SessionBoundary></QueryClientProvider>
  );
}
