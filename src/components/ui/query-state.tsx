'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiRequestError, AuthError } from '@/types';

export function QueryError({ error, retry }: { error: unknown; retry: () => void }) {
  const messages: Record<string, string> = {
    SERVICE_UNAVAILABLE: '필요한 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
    FAILED_PRECONDITION: '원장 계산에 필요한 정보가 완전하지 않습니다. 원장의 정정 이력과 연결 화면의 처리 상태를 확인해주세요.',
    DEADLINE_EXCEEDED: '조회 시간이 초과되었습니다. 기간을 줄이거나 잠시 후 다시 시도해주세요.',
    NOT_FOUND: '요청한 데이터 또는 해당 자산의 시세를 찾을 수 없습니다.',
  };
  const message = error instanceof AuthError ? '로그인이 만료되었습니다. 다시 로그인해주세요.' : error instanceof ApiRequestError ? messages[error.code] || error.message : '데이터를 불러올 수 없습니다. 연결 상태를 확인해주세요.';
  return <div role="alert" className="space-y-3 p-4 text-sm text-red-700">
    <p>{message}</p>
    <Button variant="outline" onClick={retry}>다시 시도</Button>
  </div>;
}
export function Loading() {
  return <p role="status" className="flex items-center gap-2 p-4 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />불러오는 중…</p>;
}
