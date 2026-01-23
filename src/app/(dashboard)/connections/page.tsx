import { ConnectionsPage } from '@/components/connections';

export const metadata = {
  title: '거래소 연결 - TraceVault',
  description: '거래소 API를 연결하여 거래 내역을 자동으로 동기화하세요.',
};

export default function ConnectionsRoute() {
  return <ConnectionsPage />;
}
