import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Header, Footer } from '@/components/layout';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col">
        {/* Skip Link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-black focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-white"
        >
          메인 콘텐츠로 건너뛰기
        </a>
        <Header />
        <main
          id="main-content"
          className="container flex-1 px-4 py-8"
          role="main"
          aria-label="메인 콘텐츠"
        >
          {children}
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
