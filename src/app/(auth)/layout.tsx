import Link from 'next/link';
import { AuthRedirect } from '@/components/AuthRedirect';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthRedirect>
      <div className="flex min-h-screen flex-col">
        <header className="container flex h-16 items-center px-4">
          <Link href="/" className="text-xl font-bold">
            TraceVault
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center px-4">
          {children}
        </main>
      </div>
    </AuthRedirect>
  );
}
