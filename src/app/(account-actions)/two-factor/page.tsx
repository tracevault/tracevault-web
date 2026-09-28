import { TwoFactorForm } from '@/components/settings/TwoFactorForm';

export default function TwoFactorPage() {
  return <section className="w-full max-w-lg space-y-6 rounded-lg border p-6"><h1 className="text-2xl font-bold">2단계 인증</h1><TwoFactorForm /></section>;
}
