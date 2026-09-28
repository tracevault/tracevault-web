'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { twoFactorAPI, type FactorStatus, type FactorSetup } from '@/lib/api/two-factor';
import { clearTokens, getSession, subscribeSession } from '@/lib/auth';
import { ApiRequestError, AuthError } from '@/types';

function failureText(error: unknown): string {
  if (error instanceof AuthError) return '로그인이 변경되었거나 만료되었습니다. 다시 로그인해 주세요.';
  if (error instanceof ApiRequestError) {
    if (error.code === 'INVALID_CREDENTIALS') return '현재 비밀번호 또는 인증 코드를 확인해 주세요. 이미 사용한 코드는 사용할 수 없습니다.';
    if (error.code === 'RATE_LIMITED') return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
    if (error.code === 'SERVICE_UNAVAILABLE') return '현재 인증 설정을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.';
    if (error.code === 'VALIDATION_ERROR') return '입력값을 확인해 주세요. 설정 시간이 지났다면 새 설정을 시작해 주세요.';
  }
  return '요청을 완료하지 못했습니다. 로그인과 현재 설정 상태를 확인한 뒤 다시 시도해 주세요.';
}

export function TwoFactorForm() {
  const [owner, setOwner] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<FactorStatus | null>(null);
  const [setup, setSetup] = useState<FactorSetup | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const completed = useRef(false);
  const expectedOwner = useRef<string | null>(null);

  // This dedicated route survives our own revocation, but never an account
  // switch. Secrets are component-local, never query/store/storage state.
  useEffect(() => {
    const observe = () => {
      const current = getSession()?.id ?? null;
      if (current !== expectedOwner.current) {
        controller.current?.abort();
        if (!(current === null && completed.current)) {
          setSetup(null); setPassword(''); setCode(''); setCodes([]);
          setStatus(null); setDone(false); setAcknowledged(false); setBusy(false); setError('');
          completed.current = false;
        }
        expectedOwner.current = current;
        setOwner(current);
      }
      setLoaded(true);
    };
    observe();
    const unsubscribe = subscribeSession(observe);
    return () => { unsubscribe(); controller.current?.abort(); };
  }, []);

  const loadStatus = async (signal: AbortSignal) => {
    try { setStatus(await twoFactorAPI.status(signal)); }
    catch (failure) { if (!signal.aborted) setError(failureText(failure)); }
  };
  useEffect(() => {
    if (!owner) return;
    const attempt = new AbortController(); controller.current = attempt;
    void loadStatus(attempt.signal);
    return () => attempt.abort();
  }, [owner]);

  useEffect(() => {
    if (!setup) return;
    const timer = setTimeout(() => {
      setSetup(null); setCode(''); setPassword('');
      setError('설정 시간이 만료되었습니다. 새 설정을 시작해 주세요.');
    }, Math.max(0, Date.parse(setup.expires_at) - Date.now()));
    return () => clearTimeout(timer);
  }, [setup]);

  const submit = async (operation: 'begin' | 'enable' | 'regenerate' | 'disable') => {
    if (busy || !owner) return;
    if (!password) { setError('현재 비밀번호를 입력해 주세요.'); return; }
    if (operation !== 'begin' && !(operation !== 'enable' && recovery ? /^[a-f0-9]{32}$/ : /^[0-9]{6}$/).test(code)) {
      setError(operation !== 'enable' && recovery ? '32자리 복구 코드를 입력해 주세요.' : '인증 앱의 6자리 코드를 입력해 주세요.'); return;
    }
    const attempt = new AbortController(); controller.current = attempt;
    setBusy(true); setError('');
    try {
      if (operation === 'begin') {
        const result = await twoFactorAPI.begin({ current_password: password }, attempt.signal);
        if (!attempt.signal.aborted) { setSetup(result); setPassword(''); setCode(''); }
      } else {
        const proof = { current_password: password, ...(recovery ? { recovery_code: code } : { totp_code: code }) };
        const result = operation === 'enable'
          ? await twoFactorAPI.enable({ current_password: password, factor_id: setup!.factor_id, totp_code: code }, attempt.signal)
          : operation === 'regenerate' ? await twoFactorAPI.regenerate(proof, attempt.signal) : await twoFactorAPI.disable(proof, attempt.signal);
        if (attempt.signal.aborted) return;
        if (result.sessions_revoked !== true) throw new Error('Unexpected factor result');
        completed.current = true;
        setCodes('recovery_codes' in result ? result.recovery_codes : []);
        setSetup(null); setPassword(''); setCode(''); setStatus(null); setDone(true);
        // Keep the returned codes visible while clearing only this login.
        await clearTokens(owner);
      }
    } catch (failure) { if (!attempt.signal.aborted) setError(failureText(failure)); }
    finally { if (!attempt.signal.aborted || completed.current) setBusy(false); }
  };

  if (!loaded) return <p role="status">로그인을 확인하는 중…</p>;
  if (done) return <div className="space-y-4">
    <p role="status">{codes.length ? '복구 코드를 안전한 곳에 저장해 주세요. 이 화면에서만 확인할 수 있습니다.' : '2단계 인증을 해제했습니다.'} 모든 기존 로그인 세션이 종료되었습니다.</p>
    {codes.length > 0 && <><p className="text-sm text-muted-foreground">각 코드는 한 번만 사용할 수 있습니다. 새 코드를 발급받았다면 이전 복구 코드는 더 이상 사용할 수 없습니다. 페이지를 닫으면 코드는 사라집니다.</p>
      <ol aria-label="일회용 복구 코드" className="space-y-2 rounded border p-3">{codes.map(value => <li key={value}><code className="break-all text-sm select-all">{value}</code></li>)}</ol>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />복구 코드를 안전하게 저장했습니다</label>
      <Button disabled={!acknowledged} onClick={() => { setCodes([]); setDone(false); completed.current = false; }}>확인하고 코드 지우기</Button>
    </>}
    {codes.length === 0 && <Link className="underline" href="/login">다시 로그인</Link>}
  </div>;
  if (!owner) return <div className="space-y-3"><p>인증 설정을 관리하려면 로그인해 주세요.</p><Link className="underline" href="/login">로그인</Link></div>;
  return <div className="space-y-4">
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!status ? <><p role="status">현재 설정을 확인하고 있습니다.</p><Button variant="outline" onClick={() => { const attempt = new AbortController(); controller.current?.abort(); controller.current = attempt; setError(''); void loadStatus(attempt.signal); }}>다시 확인</Button></> : <>
      <p>2단계 인증: <strong>{status.enabled ? '사용 중' : '사용 안 함'}</strong></p>
      {status.enabled && <p className="text-sm">남은 복구 코드: {status.recovery_codes_remaining}개</p>}
      {!status.enabled && !status.setup_available ? <p>현재 새로운 인증 앱 설정을 시작할 수 없습니다.</p> : <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!status.enabled) void submit(setup ? 'enable' : 'begin'); }}>
        {setup && <div className="space-y-3 rounded border p-4"><p>인증 앱에서 시간 기반 코드를 추가하고 아래 설정 키를 입력해 주세요.</p><p aria-label="인증 앱 설정 키" className="break-all font-mono select-all">{setup.secret}</p><p className="text-sm">6자리 코드 · 30초 간격 · SHA-1</p><p className="text-sm">설정 기한: {new Date(setup.expires_at).toLocaleTimeString()}</p></div>}
        {!status.enabled && !setup && <p className="text-sm text-muted-foreground">인증 앱을 연결하면 로그인할 때 비밀번호와 인증 코드가 필요합니다.{status.setup_pending && ' 이전 설정은 완료되지 않았습니다. 새 설정을 시작하면 이전 키가 교체됩니다.'}</p>}
        <label className="block space-y-2 text-sm">현재 비밀번호<Input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} required /></label>
        {(setup || status.enabled) && <><label className="block space-y-2 text-sm">{status.enabled && recovery ? '복구 코드' : '인증 앱 코드'}<Input value={code} onChange={e => setCode(e.target.value)} autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} inputMode={status.enabled && recovery ? 'text' : 'numeric'} maxLength={status.enabled && recovery ? 32 : 6} disabled={busy} required /></label>
          {status.enabled && <Button type="button" variant="outline" disabled={busy} onClick={() => { setRecovery(!recovery); setCode(''); }}>{recovery ? '인증 앱 코드 사용' : '복구 코드 사용'}</Button>}
          <p className="text-sm text-muted-foreground">설정을 변경하면 모든 로그인 세션이 종료됩니다. 이미 사용한 인증 앱 코드는 다시 사용할 수 없습니다.</p>
        </>}
        {status.enabled ? <div className="flex flex-wrap gap-3"><Button type="button" disabled={busy} onClick={() => void submit('regenerate')}>복구 코드 새로 발급</Button><Button type="button" variant="destructive" disabled={busy} onClick={() => void submit('disable')}>2단계 인증 해제</Button></div> : <Button type="submit" disabled={busy}>{busy ? '처리 중…' : setup ? '인증 확인 및 활성화' : '인증 앱 설정 시작'}</Button>}
      </form>}
    </>}
    <p><Link href="/settings" className="text-sm underline">계정 설정으로 돌아가기</Link></p>
  </div>;
}
