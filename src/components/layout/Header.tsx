'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu, X, LogOut, User, LayoutDashboard, Settings,
  BookOpen, PieChart, FileText, Link2
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores';
import { useLogout } from '@/hooks';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/connections', label: 'Connections', icon: Link2 },
  { href: '/ledger', label: 'Ledger', icon: BookOpen },
  { href: '/portfolio', label: 'Portfolio', icon: PieChart },
  { href: '/tax', label: 'Tax', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate();
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">TraceVault</span>
          </Link>

          {isAuthenticated && (
            <nav className="hidden md:flex md:gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary',
                    pathname === item.href
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <div className="hidden items-center gap-4 md:flex">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{user?.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  disabled={logout.isPending}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  로그아웃
                </Button>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">로그인</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">회원가입</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {isAuthenticated && mobileMenuOpen && (
        <div className="border-t md:hidden">
          <nav className="container flex flex-col gap-2 py-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
                  pathname === item.href
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-2 border-t px-3 py-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{user?.name}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={logout.isPending}
              className="justify-start"
            >
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
