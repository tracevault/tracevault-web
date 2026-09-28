'use client';

import { EmailVerification } from '@/components/settings/EmailVerification';
import { Settings } from 'lucide-react';
import Link from 'next/link';
import { ProfileForm, PasswordChangeForm, DeleteAccountModal } from '@/components/settings';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8" />
        <div>
          <h1 className="text-2xl font-bold">설정</h1>
          <p className="text-muted-foreground">
            계정 및 프로필 설정을 관리합니다
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <ProfileForm />
        <EmailVerification />
        <section className="space-y-3 rounded-lg border p-6"><h2 className="text-lg font-semibold">2단계 인증</h2><p className="text-sm text-muted-foreground">인증 앱과 복구 코드로 계정을 보호합니다.</p><Link className="text-sm underline" href="/two-factor">인증 앱 및 복구 코드 관리</Link></section>
        <PasswordChangeForm />
        <DeleteAccountModal />
      </div>
    </div>
  );
}
