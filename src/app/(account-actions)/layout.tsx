import Link from 'next/link';
import type { Metadata } from 'next';
export const metadata: Metadata = { referrer: 'no-referrer', robots: { index: false, follow: false } };
export default function AccountActionLayout({ children }: { children: React.ReactNode }) {
 return <div className="flex min-h-screen flex-col"><header className="container flex h-16 items-center px-4"><Link href="/" className="text-xl font-bold">TraceVault</Link></header><main className="flex flex-1 items-center justify-center px-4 py-8">{children}</main></div>;
}
