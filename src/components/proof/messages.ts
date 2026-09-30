import { ApiRequestError } from '@/types';
export function proofErrorText(error: unknown): string {
  if (error instanceof ApiRequestError) {
    const messages: Record<string, string> = {
      INVALID_PROOF_FILE: '증명 파일의 내용이나 검증 정보가 일치하지 않습니다. 다시 내려받아 주세요.',
      NOT_FOUND: '이 계정에서 해당 증명 작업이나 입력을 찾을 수 없습니다.',
      SERVICE_UNAVAILABLE: '증명 서비스에 연결하지 못했습니다. 잠시 후 다시 확인해 주세요.',
      DEADLINE_EXCEEDED: '응답 대기 시간이 초과되었습니다. 같은 요청으로 접수 여부를 다시 확인해 주세요.',
      CONFLICT: '같은 요청 번호에 다른 입력이 지정되었습니다. 기존 작업을 확인해 주세요.',
      FAILED_PRECONDITION: '현재 상태에서는 처리할 수 없습니다. 작업 상태와 보존된 입력을 다시 확인해 주세요.',
      RATE_LIMITED: '진행 중인 요청이 많습니다. 기존 작업이 끝난 뒤 다시 요청해 주세요.',
      INVALID_UPSTREAM_RESPONSE: '증명 서비스 응답을 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.',
    };
    return messages[error.code] ?? '증명 요청을 처리하지 못했습니다. 잠시 후 상태를 다시 확인해 주세요.';
  }
  if (error instanceof Error && error.name === 'QuotaExceededError') return '요청 번호를 기기에 보존하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.';
  return error instanceof Error && /[가-힣]/.test(error.message) ? error.message : '증명 요청을 처리하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.';
}
