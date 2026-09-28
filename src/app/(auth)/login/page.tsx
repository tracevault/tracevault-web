import Link from 'next/link';
import { Metadata } from 'next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LoginForm } from '@/components/forms';

export const metadata: Metadata = {
  title: '로그인 - TraceVault',
  description: 'TraceVault에 로그인하세요',
};

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">로그인</CardTitle>
        <CardDescription>
          TraceVault 계정으로 로그인하세요
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
        <p className="mt-4 text-center text-sm"><Link href="/forgot-password" className="underline">비밀번호를 잊으셨나요?</Link></p>
      </CardContent>
    </Card>
  );
}
