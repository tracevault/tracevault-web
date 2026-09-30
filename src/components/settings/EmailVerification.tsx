'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores';
import { authActionsAPI } from '@/lib/api/auth-actions';
import { actionError } from '@/components/forms/AuthActionForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function EmailVerification() {
  const user = useAuthStore(state => state.user);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  return <Card><CardHeader><CardTitle>이메일 주소 확인</CardTitle></CardHeader><CardContent className="space-y-3">
    <p>{user?.email_verified ? '이메일 주소가 확인되었습니다.' : '가입한 이메일 주소로 확인 링크를 받아 주세요.'}</p>
    {!user?.email_verified && <Button disabled={busy || !user} onClick={async () => {
      const attempt = new AbortController(); controller.current = attempt;
      setBusy(true); setMessage('');
      try { const result = await authActionsAPI.requestVerification(attempt.signal); if (!result.accepted) throw new Error('Unexpected action result'); setMessage('요청을 접수했습니다. 받은 이메일에서 링크를 열고 확인 버튼을 눌러 주세요. 반복 요청은 잠시 제한될 수 있습니다.'); }
      catch (error) { if (!attempt.signal.aborted) setMessage(actionError(error)); }
      finally { if (!attempt.signal.aborted) setBusy(false); }
    }}>{busy ? '요청 중…' : '이메일 확인 링크 요청'}</Button>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </CardContent></Card>;
}
