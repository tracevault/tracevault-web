'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDeleteAccount } from '@/hooks';
import { useAuthStore } from '@/stores';
import { ApiRequestError } from '@/types';

export function DeleteAccountModal() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const deleteAccount = useDeleteAccount();

  const handleDelete = async () => {
    if (confirmText !== '계정 삭제') {
      setError('확인 문구를 정확히 입력해주세요');
      return;
    }

    try {
      setError(null);
      await deleteAccount.mutateAsync();
      toast.success('계정이 삭제되었습니다');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('계정 삭제 중 오류가 발생했습니다');
      }
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setConfirmText('');
      setError(null);
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">계정 삭제</CardTitle>
        <CardDescription>
          계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              계정 삭제
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                계정 삭제 확인
              </DialogTitle>
              <DialogDescription>
                이 작업은 취소할 수 없습니다. 계정과 관련된 모든 데이터가 영구적으로 삭제됩니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  다음 데이터가 삭제됩니다:
                  <ul className="mt-2 list-disc pl-4 text-sm">
                    <li>모든 거래소 연결 정보</li>
                    <li>거래 내역 및 포트폴리오 데이터</li>
                    <li>세금 계산 결과</li>
                    <li>Proof 데이터</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm">
                  계정을 삭제하려면 <strong>&quot;계정 삭제&quot;</strong>를 입력하세요
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="계정 삭제"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={deleteAccount.isPending}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={confirmText !== '계정 삭제' || deleteAccount.isPending}
              >
                {deleteAccount.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    삭제 중...
                  </>
                ) : (
                  '계정 영구 삭제'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
