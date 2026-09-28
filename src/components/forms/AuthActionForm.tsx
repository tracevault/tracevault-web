'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authActionsAPI } from '@/lib/api/auth-actions';
import { readActionFragment, type AuthActionLink } from '@/lib/auth/action-link';
import { ApiRequestError } from '@/types';
import { newPasswordSchema } from '@/lib/validations/auth';

export function actionError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.code === 'RATE_LIMITED' || error.code === 'RESOURCE_EXHAUSTED') return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
    if (error.code === 'VALIDATION_ERROR' || error.code === 'INVALID_ARGUMENT') return '입력값을 확인해 주세요. 링크가 만료되었거나 이미 사용됐다면 새 이메일을 요청해 주세요.';
  }
  return '요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

export function AuthActionForm({ purpose }: { purpose: 'verify' | 'reset' }) {
  const captured = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [link, setLink] = useState<AuthActionLink | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const queries = useQueryClient();
  useEffect(() => {
    if (!captured.current) {
      captured.current = true;
      const current = new URL(window.location.href);
      // Do not store the link in local/session storage, query caches or history.
      window.history.replaceState(window.history.state, '', current.pathname);
      setLink(readActionFragment(current));
      setLoaded(true);
    }
    return () => controller.current?.abort();
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!link || busy) return;
    if (purpose === 'reset') {
      const checked = newPasswordSchema.safeParse(password);
      if (!checked.success || password !== confirmation) {
        setError(!checked.success ? checked.error.issues[0].message : '두 비밀번호가 일치하지 않습니다.');
        return;
      }
    }
    const attempt = new AbortController();
    controller.current = attempt;
    setBusy(true); setError('');
    try {
      const result = purpose === 'verify' ? await authActionsAPI.verify(link, attempt.signal) : await authActionsAPI.reset(link, password, attempt.signal);
      if (!result.success) throw new Error('Unexpected action result');
      setLink(null); setPassword(''); setConfirmation(''); setDone(true);
      // This rechecks the current session. It clears revoked sessions through the
      // shared auth transport and preserves an unrelated account's valid session.
      await queries.invalidateQueries({ queryKey: ['user'] });
    } catch (failure) {
      if (!attempt.signal.aborted) setError(actionError(failure));
    } finally { if (!attempt.signal.aborted) setBusy(false); }
  };
  if (!loaded) return <p role="status">링크를 확인하는 중…</p>;
  if (done) return <div className="space-y-4"><p role="status">{purpose === 'verify' ? '이메일 주소를 확인했습니다.' : '비밀번호를 재설정했습니다. 새 비밀번호로 로그인해 주세요.'}</p><Link href={purpose === 'verify' ? '/settings' : '/login'} className="underline">{purpose === 'verify' ? '계정 설정으로 이동' : '로그인으로 이동'}</Link></div>;
  if (!link) return <div className="space-y-4"><p role="alert">사용할 수 있는 인증 링크가 없습니다. 이메일의 링크를 다시 열거나 새 이메일을 요청해 주세요.</p><Link href={purpose === 'verify' ? '/settings' : '/forgot-password'} className="underline">새 이메일 요청하기</Link></div>;
  return <form onSubmit={submit} className="space-y-4">
    <p className="text-sm text-muted-foreground">{purpose === 'verify' ? '아래 버튼을 누르면 이메일 주소 확인이 완료됩니다.' : '새 비밀번호를 입력한 후 재설정을 확인해 주세요. 이전 로그인 세션은 종료됩니다.'}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {purpose === 'reset' && <><label className="block space-y-2">새 비밀번호<Input type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label><p className="text-xs text-muted-foreground">8자 이상, 대문자·소문자·숫자·특수문자를 포함해 주세요. UTF-8 기준 최대 72바이트입니다.</p><label className="block space-y-2">새 비밀번호 확인<Input type="password" autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} /></label></>}
    <Button type="submit" disabled={busy}>{busy ? '처리 중…' : purpose === 'verify' ? '이메일 주소 확인' : '비밀번호 재설정'}</Button>
  </form>;
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  return <form className="space-y-4" onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    const attempt = new AbortController(); controller.current = attempt;
    setBusy(true); setError(''); setSent(false);
    try {
      const result = await authActionsAPI.requestReset(email, attempt.signal);
      if (!result.accepted) throw new Error('Unexpected action result');
      setSent(true);
    } catch (failure) { if (!attempt.signal.aborted) setError(actionError(failure)); }
    finally { if (!attempt.signal.aborted) setBusy(false); }
  }}><label className="block space-y-2">가입한 이메일<Input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>
    {sent && <p role="status">사용 가능한 계정이라면 비밀번호 재설정 이메일을 보내드립니다. 이메일이 오지 않으면 스팸함을 확인하고 잠시 후 다시 요청해 주세요.</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Button type="submit" disabled={busy}>{busy ? '요청 중…' : '재설정 이메일 요청'}</Button><p><Link href="/login" className="text-sm underline">로그인으로 돌아가기</Link></p>
  </form>;
}
