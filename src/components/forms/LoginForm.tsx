'use client';

import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { loginSchema, type LoginFormData } from '@/lib/validations';
import { useLogin } from '@/hooks';
import { ApiRequestError } from '@/types';

export function LoginForm() {
  const login = useLogin();
  const [factorRequired, setFactorRequired] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState('');

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    form.clearErrors('root');
    if (factorRequired && !(recovery ? /^[a-f0-9]{32}$/ : /^[0-9]{6}$/).test(code)) {
      form.setError('root', { message: recovery ? '32자리 복구 코드를 입력해 주세요.' : '인증 앱의 6자리 코드를 입력해 주세요.' });
      return;
    }
    try {
      await login.mutateAsync({ ...data, ...(factorRequired ? recovery ? { recovery_code: code } : { totp_code: code } : {}) });
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.code === 'SECOND_FACTOR_REQUIRED') {
          setFactorRequired(true);
          return;
        } else if (error.code === 'INVALID_CREDENTIALS' || error.code === 'UNAUTHORIZED') {
          form.setError('root', {
            message: factorRequired ? '비밀번호 또는 인증 코드를 확인해 주세요. 이미 사용한 코드는 다시 사용할 수 없습니다.' : '이메일 또는 비밀번호가 올바르지 않습니다',
          });
        } else {
          form.setError('root', {
            message: error.message,
          });
        }
      } else {
        form.setError('root', {
          message: '로그인 중 오류가 발생했습니다',
        });
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {form.formState.errors.root && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {form.formState.errors.root.message}
          </div>
        )}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>이메일</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  autoComplete="email"
                  {...field}
                  disabled={login.isPending}
                  onChange={event => { field.onChange(event); setFactorRequired(false); setCode(''); }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>비밀번호</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  autoComplete="current-password"
                  {...field}
                  disabled={login.isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {factorRequired && <fieldset className="space-y-3" disabled={login.isPending}>
          <legend className="text-sm font-medium">2단계 인증</legend>
          <label className="block space-y-2 text-sm">{recovery ? '복구 코드' : '인증 앱 코드'}
            <Input value={code} onChange={event => setCode(event.target.value)} autoComplete="one-time-code" inputMode={recovery ? 'text' : 'numeric'} maxLength={recovery ? 32 : 6} spellCheck={false} autoCapitalize="none" autoFocus />
          </label>
          <p className="text-xs text-muted-foreground">{recovery ? '복구 코드는 한 번만 사용할 수 있습니다.' : '설정할 때 사용한 코드는 다시 사용할 수 없습니다. 앱에 다음 코드가 표시되면 입력해 주세요.'}</p>
          <Button type="button" variant="outline" onClick={() => { setRecovery(!recovery); setCode(''); form.clearErrors('root'); }}>{recovery ? '인증 앱 코드 사용' : '복구 코드 사용'}</Button>
        </fieldset>}

        <Button
          type="submit"
          className="w-full"
          disabled={login.isPending}
        >
          {login.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              로그인 중...
            </>
          ) : (
            '로그인'
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          계정이 없으신가요?{' '}
          <Link
            href="/register"
            className="text-primary underline-offset-4 hover:underline"
          >
            회원가입
          </Link>
        </p>
      </form>
    </Form>
  );
}
