'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';
import { usePortfolio, useConnections, useLedgerEvents } from '@/hooks';
import { formatAmount } from '@/lib/amount';
import { QueryError, Loading } from '@/components/ui/query-state';
import { useAuthStore } from '@/stores';
import { Wallet, ArrowLeftRight, PieChart, Calculator } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const connections = useConnections();
  const events = useLedgerEvents({ limit: 5 });
  const portfolio = usePortfolio('KRW');
  const stats = [
    { title: '연결된 거래소', icon: Wallet, query: connections, value: connections.data?.length.toString(), description: '연결 및 동기화 상태 확인', href: '/connections' },
    { title: '원장 기록 수', icon: ArrowLeftRight, query: events, value: events.data?.pagination.total.toLocaleString('ko-KR'), description: '수정 기록을 포함한 전체 원장', href: '/ledger' },
    { title: '총 자산 평가액', icon: PieChart, query: portfolio, value: portfolio.data ? formatAmount(portfolio.data.total_value_local, portfolio.data.local_currency) : undefined, description: portfolio.data ? `보유 자산 ${portfolio.data.assets.length}종` : '보유 수량과 시세 기준', href: '/portfolio' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          안녕하세요, {user?.name || '사용자'}님
        </h1>
        <p className="text-muted-foreground">
          TraceVault 대시보드에 오신 것을 환영합니다
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stat.query.isPending ? <Loading /> : stat.query.isError ? <QueryError error={stat.query.error} retry={() => void stat.query.refetch()} /> : <>
                <p className="break-all text-xl font-bold">{stat.value ?? '—'}</p>
                <p className="mt-2 text-xs text-muted-foreground">{stat.description}</p>
              </>}
              <Link href={stat.href} className="mt-3 inline-block text-sm underline">자세히 보기</Link>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">세금 분석</CardTitle><Calculator className="h-4 w-4" /></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">과세 연도와 계산 방법을 선택해 분석하세요.</p><Link href="/tax" className="mt-3 inline-block text-sm underline">세금 분석 열기</Link></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>시작하기</CardTitle>
            <CardDescription>
              TraceVault 사용을 위한 첫 단계를 완료하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  1
                </span>
                <Link href="/connections" className="underline">거래소 연결하기</Link>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                  2
                </span>
                <Link href="/connections" className="underline">거래 내역 동기화하기</Link>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                  3
                </span>
                <Link href="/portfolio" className="underline">포트폴리오 확인하기</Link>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 원장 기록</CardTitle>
            <CardDescription>실제 기록된 거래 · 최대 5건</CardDescription>
          </CardHeader>
          <CardContent>
            {events.isPending ? <Loading /> : events.isError ? <QueryError error={events.error} retry={() => void events.refetch()} /> : !events.data?.events.length ? <p className="text-sm text-muted-foreground">기록된 거래가 없습니다.</p> : <ul className="space-y-3">{events.data.events.map(event => <li key={event.id} className="border-b pb-3 text-sm">
              <p className="break-all">{event.asset_id.symbol} · {event.event_type} · {formatAmount(event.amount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(event.event_time).toLocaleString('ko-KR', { timeZone: 'UTC' })} UTC</p>
            </li>)}</ul>}
            <Link href="/ledger" className="mt-4 inline-block text-sm underline">전체 원장 보기</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
