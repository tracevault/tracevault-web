'use client';

import { Settings } from 'lucide-react';
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
        <PasswordChangeForm />
        <DeleteAccountModal />
      </div>
    </div>
  );
}
