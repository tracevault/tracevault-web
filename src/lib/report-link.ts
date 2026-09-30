const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function reportPath(report: string, run: string): string | null {
  if (![report, run].every(id => uuid.test(id) && id !== '00000000-0000-0000-0000-000000000000')) return null;
  return `/tax/reports/${report}?run_id=${run}`;
}
// Only this owned report route may be restored after login; no arbitrary redirect.
export function reportReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith('/tax/reports/')) return null;
  try {
    const url = new URL(value, 'https://report.local');
    const match = /^\/tax\/reports\/([0-9a-f-]+)$/.exec(url.pathname);
    if (url.origin !== 'https://report.local' || url.hash || !match || url.searchParams.getAll('run_id').length !== 1 || [...url.searchParams.keys()].some(k => k !== 'run_id')) return null;
    return reportPath(match[1], url.searchParams.get('run_id')!);
  } catch { return null; }
}
