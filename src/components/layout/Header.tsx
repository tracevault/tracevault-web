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
    <header
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      role="banner"
    >
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center space-x-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            aria-label="TraceVault 홈으로 이동"
          >
            <span className="text-xl font-bold">TraceVault</span>
          </Link>

          {isAuthenticated && (
            <nav className="hidden md:flex md:gap-6" aria-label="메인 네비게이션">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2',
                    pathname === item.href
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  )}
                  aria-current={pathname === item.href ? 'page' : undefined}
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
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
                aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Menu className="h-5 w-5" aria-hidden="true" />
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
        <div id="mobile-menu" className="border-t md:hidden" role="dialog" aria-label="모바일 메뉴">
          <nav className="container flex flex-col gap-2 py-4" aria-label="모바일 네비게이션">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-black focus:ring-inset',
                  pathname === item.href
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground'
                )}
                aria-current={pathname === item.href ? 'page' : undefined}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-2 border-t px-3 py-2 text-sm text-muted-foreground" aria-label="사용자 정보">
              <User className="h-4 w-4" aria-hidden="true" />
              <span>{user?.name}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={logout.isPending}
              className="justify-start"
              aria-label="로그아웃"
            >
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              로그아웃
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
