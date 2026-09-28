'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useAuthStore } from '@/stores';
import { ApiRequestError, AuthError } from '@/types';
import { Button } from '@/components/ui/button';
import { notificationAPI, type Notification, type NotificationPreference, type NotificationPreferenceInput } from '@/lib/api/notifications';
import { BrowserPushError, browserDeviceKey, browserPushState, deleteBrowserPushToken, subscribeBrowserPush, type BrowserPushState } from '@/lib/browser-push';

const typeNames: Record<string, string> = { '*': '전체 기본 설정', WELCOME: '가입 환영', EMAIL_VERIFY: '이메일 인증', PASSWORD_RESET: '비밀번호 재설정', EXCHANGE_CONNECTED: '거래소 연결', EXCHANGE_FAILED: '거래소 연결 실패', SYNC_COMPLETED: '동기화 완료', SYNC_FAILED: '동기화 실패', TAX_REPORT_READY: '보고서 완료', SECURITY_LOGIN: '새 로그인', SECURITY_SETTINGS: '보안 설정 변경', TWO_FA_CODE: '인증 코드' };
const states: Record<Notification['status'], string> = { pending: '발송 대기', sending: '발송 중', sent: '제공자 접수', partial: '일부 기기 접수', skipped: '발송 생략', failed: '발송 실패', unavailable: '발송 연결 대기', legacy_read: '이전 기록' };
export default function NotificationsPage() {
  const owner = useAuthStore(s => s.user?.id);
  return owner ? <Notifications key={owner} owner={owner} /> : <p role="status">계정을 확인하는 중…</p>;
}
function Notifications({ owner }: { owner: string }) {
  const cache = useQueryClient(); const [tab, setTab] = useState<'history' | 'preferences' | 'devices'>('history');
  const [cursors, setCursors] = useState(['']); const before = cursors.at(-1)!;
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [pushState, setPushState] = useState<BrowserPushState>('checking'); const [browserDevice, setBrowserDevice] = useState('');
  const active = useRef<AbortController | null>(null);
  const history = useQuery({ queryKey: ['notifications', owner, 'history', before], queryFn: ({ signal }) => notificationAPI.list(before, signal), retry: false });
  const preferences = useQuery({ queryKey: ['notifications', owner, 'preferences'], queryFn: ({ signal }) => notificationAPI.preferences(signal), retry: false });
  const devices = useQuery({ queryKey: ['notifications', owner, 'devices'], queryFn: ({ signal }) => notificationAPI.devices(signal), retry: false, enabled: tab === 'devices' });
  useEffect(() => { const unsubscribe = useAuthStore.subscribe(s => { if (s.user?.id !== owner) active.current?.abort(); }); return () => { unsubscribe(); active.current?.abort(); }; }, [owner]);
  useEffect(() => {
    let current = true;
    setBrowserDevice(localStorage.getItem(browserDeviceKey(owner)) ?? '');
    browserPushState().then(state => { if (current) setPushState(state); });
    return () => { current = false; };
  }, [owner]);
  async function action(work: (signal: AbortSignal) => Promise<unknown>, message: string) {
    if (active.current || useAuthStore.getState().user?.id !== owner) return;
    const controller = new AbortController(); active.current = controller; setBusy(true); setError(''); setNotice('');
    try { await work(controller.signal); controller.signal.throwIfAborted(); setNotice(message); await cache.invalidateQueries({ queryKey: ['notifications', owner] }); }
    catch (e) { if (!controller.signal.aborted) setError(notificationError(e)); }
    finally { if (!controller.signal.aborted) setBusy(false); if (active.current === controller) active.current = null; }
  }
  function enableBrowserPush() {
    return action(async signal => {
      const token = await subscribeBrowserPush(); signal.throwIfAborted();
      const registered = await notificationAPI.registerDevice(token, '웹 브라우저', signal); signal.throwIfAborted();
      const previous = localStorage.getItem(browserDeviceKey(owner));
      if (previous && previous !== registered.device.id) await notificationAPI.removeDevice(previous, signal);
      localStorage.setItem(browserDeviceKey(owner), registered.device.id);
      setBrowserDevice(registered.device.id); setPushState('ready');
    }, '이 브라우저에서 푸시 알림을 받을 수 있습니다.');
  }
  function removeDevice(id: string) {
    return action(async signal => {
      await notificationAPI.removeDevice(id, signal); signal.throwIfAborted();
      if (id === browserDevice) {
        localStorage.removeItem(browserDeviceKey(owner)); setBrowserDevice('');
        await deleteBrowserPushToken().catch(() => false);
      }
    }, '기기 등록을 해제했습니다.');
  }
  const queryError = tab === 'history' ? history.error : tab === 'preferences' ? preferences.error : devices.error;
  return <div className="mx-auto max-w-4xl space-y-6">
    <header><h1 className="flex items-center gap-2 text-2xl font-bold"><Bell className="h-6 w-6" />알림</h1><p className="mt-2 text-sm text-muted-foreground">계정 활동을 확인하고 알림 수신 방법을 선택하세요.</p></header>
    <nav aria-label="알림 메뉴" className="flex flex-wrap gap-2">{([['history', '알림 내역'], ['preferences', '수신 설정'], ['devices', '등록 기기']] as const).map(([key, label]) => <Button key={key} variant={tab === key ? 'default' : 'outline'} aria-pressed={tab === key} onClick={() => { setTab(key); setError(''); setNotice(''); }}>{label}</Button>)}</nav>
    {(error || queryError) && <p role="alert" className="rounded-md border border-red-300 p-3 text-red-700">{error || notificationError(queryError)}</p>}
    {queryError && <Button variant="outline" onClick={() => { if (tab === 'history') history.refetch(); else if (tab === 'preferences') preferences.refetch(); else devices.refetch(); }}>다시 불러오기</Button>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {tab === 'history' && <section aria-label="알림 내역" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3"><p>읽지 않은 알림 {history.data?.unread_count ?? '…'}개</p><Button variant="outline" disabled={busy || !history.data?.unread_count} onClick={() => action(notificationAPI.readAll, '모든 알림을 읽음으로 표시했습니다.')}>모두 읽음</Button><Button variant="outline" disabled={history.isFetching} onClick={() => { setCursors(['']); history.refetch(); }}>새로고침</Button></div>
      {history.isLoading && <p role="status">알림을 불러오는 중…</p>}
      {history.data?.notifications.length === 0 && <p className="rounded-lg border p-6 text-muted-foreground">아직 알림이 없습니다.</p>}
      <ul className="space-y-3">{history.data?.notifications.map(n => <li key={n.id} className={`rounded-lg border p-4 ${n.read_at ? '' : 'border-primary/40 bg-primary/5'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{n.subject || typeNames[n.type] || n.type}</h2><p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString('ko-KR')} · {states[n.status]} · {n.read_at ? '읽음' : '읽지 않음'}</p></div>{!n.read_at && <Button size="sm" variant="outline" disabled={busy} onClick={() => action(signal => notificationAPI.read(n.id, signal), '읽음으로 표시했습니다.')}>읽음 표시</Button>}</div>
        {n.body_text && <details className="mt-3 text-sm"><summary className="cursor-pointer">내용 보기</summary><p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{n.body_text}</p></details>}
        {n.delivery_progress && <p className="mt-2 text-sm text-muted-foreground">등록 기기 {n.delivery_progress.total}개 · 접수 {n.delivery_progress.accepted} · 대기 {n.delivery_progress.pending} · 실패 {n.delivery_progress.failed} · 생략 {n.delivery_progress.skipped}</p>}
        {n.status === 'unavailable' && <p className="mt-2 text-sm text-muted-foreground">발송 서비스 연결을 기다리고 있습니다.</p>}
      </li>)}</ul>
      {history.data && <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={history.isFetching || cursors.length === 1} onClick={() => setCursors(v => v.slice(0, -1))}>더 최근 알림</Button><Button variant="outline" disabled={history.isFetching || !history.data.next_before_id} onClick={() => { if (history.data?.next_before_id) setCursors(v => [...v, history.data.next_before_id]); }}>더 오래된 알림</Button></div>}
      <p className="text-xs text-muted-foreground">제공자 접수는 발송 서비스가 요청을 받았다는 뜻이며, 메일함 도착이나 기기 수신을 보장하지는 않습니다. 읽음 표시는 발송 여부를 바꾸지 않습니다.</p>
    </section>}
    {tab === 'preferences' && <section aria-label="수신 설정" className="space-y-4"><p className="text-sm text-muted-foreground">전체 기본 설정을 따르거나 알림별로 선택하세요. 준비 중인 알림의 선택도 저장되지만, 서비스 연결 전에는 발송되지 않습니다.</p>
      {preferences.isLoading && <p role="status">수신 설정을 불러오는 중…</p>}
      {preferences.data && <p className="text-sm">{preferences.data.channels.map(c => `${c.channel === 'email' ? '이메일' : c.channel === 'push' ? '푸시' : 'SMS'}: ${!c.supported ? '준비 중' : c.configured ? '연결 설정됨' : '연결 대기'}`).join(' · ')}</p>}
      {preferences.data?.preferences.slice().sort((a, b) => a.type === '*' ? -1 : b.type === '*' ? 1 : Number(b.delivery_supported) - Number(a.delivery_supported)).map(p => <PreferenceCard key={`${p.type}:${p.email_enabled}:${p.push_enabled}:${p.sms_enabled}:${p.is_override}`} preference={p} busy={busy} onSave={value => action(signal => notificationAPI.savePreferences([value], signal), '수신 설정을 저장했습니다.')} onReset={() => action(signal => notificationAPI.resetPreference(p.type, signal), '기본 설정을 적용했습니다.')} />)}
    </section>}
    {tab === 'devices' && <section aria-label="등록 기기" className="space-y-4"><p className="text-sm text-muted-foreground">등록된 알림 기기를 확인하고 해제할 수 있습니다. 브라우저 등록은 버튼을 누른 뒤에만 알림 권한을 요청합니다.</p>
      <div className="rounded-lg border p-4"><h2 className="font-medium">이 브라우저</h2><p className="mt-1 text-sm text-muted-foreground">{pushState === 'checking' ? '브라우저 지원 여부를 확인하는 중입니다.' : pushState === 'unconfigured' ? '서비스의 브라우저 푸시 공개 설정이 아직 구성되지 않았습니다.' : pushState === 'unsupported' ? '이 브라우저 또는 현재 연결에서는 푸시 알림을 지원하지 않습니다.' : pushState === 'denied' ? '브라우저에서 알림 권한이 차단되었습니다. 브라우저 설정에서 허용할 수 있습니다.' : browserDevice ? '이 브라우저가 현재 계정에 등록되어 있습니다.' : '권한을 허용하면 이 브라우저를 현재 계정에 등록합니다.'}</p><Button className="mt-3" disabled={busy || pushState !== 'ready'} onClick={enableBrowserPush}>{browserDevice ? '브라우저 등록 갱신' : '이 브라우저에서 푸시 받기'}</Button></div>
      {devices.isLoading && <p role="status">기기를 불러오는 중…</p>}{devices.data?.devices.length === 0 && <p>등록된 알림 기기가 없습니다.</p>}
      <ul className="space-y-3">{devices.data?.devices.map(d => <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div><p className="font-medium">{d.device_name || '이름 없는 기기'}{d.id === browserDevice ? ' · 현재 브라우저' : ''}</p><p className="text-sm text-muted-foreground">{d.platform} · {new Date(d.created_at).toLocaleDateString('ko-KR')}</p></div><Button variant="outline" disabled={busy} onClick={() => removeDevice(d.id)}>등록 해제</Button></li>)}</ul>
    </section>}
  </div>;
}
function PreferenceCard({ preference: p, busy, onSave, onReset }: { preference: NotificationPreference; busy: boolean; onSave: (v: NotificationPreferenceInput) => void; onReset: () => void }) {
  const [value, setValue] = useState<NotificationPreferenceInput>({ type: p.type, email_enabled: p.email_enabled, push_enabled: p.push_enabled, sms_enabled: p.sms_enabled });
  const changed = value.email_enabled !== p.email_enabled || value.push_enabled !== p.push_enabled || value.sms_enabled !== p.sms_enabled;
  if (p.email_required) return <div className="rounded-lg border p-4"><h2 className="font-medium">{typeNames[p.type]}</h2><p className="mt-2 text-sm text-muted-foreground">직접 요청한 인증·비밀번호 재설정 이메일은 일반 알림 수신 설정과 관계없이 전송됩니다. 인증 링크는 받은 이메일에서만 확인할 수 있습니다.</p></div>;
  return <div className="rounded-lg border p-4"><h2 className="font-medium">{typeNames[p.type]}{p.type !== '*' && !p.delivery_supported && <span className="ml-2 text-xs text-muted-foreground">준비 중</span>}</h2><p className="mt-1 text-xs text-muted-foreground">{p.is_override ? '개별 선택 적용' : p.type === '*' ? '서비스 기본값' : '전체 기본 설정을 따릅니다'}</p>
    <div className="my-3 flex flex-wrap gap-6">{([['email_enabled', '이메일'], ['push_enabled', '푸시'], ['sms_enabled', 'SMS']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value[key]} disabled={busy} onChange={e => setValue(v => ({ ...v, [key]: e.target.checked }))} aria-label={`${typeNames[p.type]} ${label}`} />{label}</label>)}</div>
    <div className="flex gap-2"><Button size="sm" disabled={busy || !changed} onClick={() => onSave(value)} aria-label={`${typeNames[p.type]} 저장`}>저장</Button>{p.is_override && <Button size="sm" variant="outline" disabled={busy} onClick={onReset} aria-label={`${typeNames[p.type]} 기본값 사용`}>기본값 사용</Button>}</div>
  </div>;
}

function notificationError(error: unknown) {
  if (error instanceof BrowserPushError) {
    if (error.code === 'unconfigured') return '브라우저 푸시가 아직 구성되지 않았습니다.';
    if (error.code === 'denied') return '알림 권한이 허용되지 않았습니다. 브라우저 설정을 확인해 주세요.';
    return '이 브라우저에서는 푸시 알림을 사용할 수 없습니다.';
  }
  if (error instanceof AuthError) return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
  if (error instanceof ApiRequestError) {
    if (error.code === 'NOT_FOUND') return '알림 항목을 찾을 수 없습니다. 목록을 새로고침해 주세요.';
    if (error.code === 'VALIDATION_ERROR') return '입력한 알림 설정을 확인해 주세요.';
    if (error.code === 'CONFLICT') return '기존 기기 등록과 충돌했습니다. 등록 상태를 확인해 주세요.';
  }
  return '알림 서비스에 연결하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.';
}
