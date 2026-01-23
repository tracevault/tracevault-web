'use client';

import { Metadata } from 'next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuthStore } from '@/stores';
import { Wallet, ArrowLeftRight, PieChart, Calculator } from 'lucide-react';

const stats = [
  {
    title: '연결된 거래소',
    value: '0',
    description: '거래소 연결 대기 중',
    icon: Wallet,
  },
  {
    title: '총 거래 수',
    value: '0',
    description: '동기화 필요',
    icon: ArrowLeftRight,
  },
  {
    title: '보유 자산',
    value: '0',
    description: 'KRW 0',
    icon: PieChart,
  },
  {
    title: '예상 세금',
    value: '-',
    description: '계산 필요',
    icon: Calculator,
  },
];

export default function DashboardPage() {
  const { user } = useAuthStore();

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
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
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
                <span>거래소 연결하기 (Upbit, Bithumb, Binance)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                  2
                </span>
                <span className="text-muted-foreground">
                  거래 내역 동기화하기
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                  3
                </span>
                <span className="text-muted-foreground">
                  포트폴리오 및 세금 확인하기
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 활동</CardTitle>
            <CardDescription>최근 거래 및 동기화 내역</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              거래소 연결 후 활동 내역이 표시됩니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
