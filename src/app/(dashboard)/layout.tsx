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
        <Header />
        <main className="container flex-1 px-4 py-8">{children}</main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
