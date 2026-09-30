import { RetainedReport } from '@/components/tax/retained-report';
export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ run_id?: string | string[] }> }) {
  const { id } = await params; const query = await searchParams;
  return <RetainedReport reportId={id} runId={typeof query.run_id === 'string' ? query.run_id : ''} />;
}
