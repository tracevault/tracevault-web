import Link from 'next/link';
import { ArrowRight, Shield, TrendingUp, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Header } from '@/components/layout';

const features = [
  {
    icon: Shield,
    title: '안전한 자산 추적',
    description:
      '암호화된 연결로 거래소 데이터를 안전하게 동기화하고 자산을 추적합니다.',
  },
  {
    icon: TrendingUp,
    title: '포트폴리오 분석',
    description:
      '실시간 자산 가치, 손익 분석, 자산 비중을 한눈에 확인할 수 있습니다.',
  },
  {
    icon: FileText,
    title: '세금 리포트',
    description:
      '한국/일본 세법에 맞는 세금 계산과 신고용 리포트를 자동 생성합니다.',
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container flex flex-col items-center justify-center gap-6 px-4 py-16 text-center md:py-24 lg:py-32">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            암호화폐 자산을
            <br className="hidden sm:inline" />
            <span className="text-primary"> 투명하게</span> 추적하세요
          </h1>
          <p className="max-w-[600px] text-muted-foreground md:text-xl">
            TraceVault는 거래소 연동, 자산 흐름 시각화, 세금 계산을 위한 올인원
            플랫폼입니다.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/register">
                무료로 시작하기
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/login">로그인</Link>
            </Button>
          </div>
        </section>

        {/* Features Section */}
        <section className="container px-4 py-16 md:py-24">
          <h2 className="mb-12 text-center text-2xl font-bold md:text-3xl">
            주요 기능
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <feature.icon className="mb-2 h-10 w-10 text-primary" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} TraceVault. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
