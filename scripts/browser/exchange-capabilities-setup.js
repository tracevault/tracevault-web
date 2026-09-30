/* eslint-disable @typescript-eslint/no-unused-expressions -- Playwright CLI function expression. */
// Open /login?capability_api=<live harness HTTP address>, then run via CLI.
// Only capabilities use actual Collector -> Gateway. Account/auth/status data
// are explicit UI fixtures; this is not a production-main login/DB acceptance.
async (page) => {
  const target = await page.evaluate(() => ({ origin: location.origin, api: new URL(location.href).searchParams.get('capability_api') }));
  const api = target.api;
  if (!api || !/^http:\/\/127\.0\.0\.1:\d+$/.test(api)) throw new Error('Local capability harness address required');
  const state = { mode: 'actual', requests: 0, actual: 0, mutations: [], unexpected: [], errors: [] };
  page.capabilityFixture = state;
  page.on('pageerror', error => state.errors.push(error.message));
  const publicKey = await page.evaluate(async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const bytes = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return { public_key: btoa(String.fromCharCode(...bytes)), key_id: Array.from(hash, x => x.toString(16).padStart(2, '0')).join(''), algorithm: 'ECDH-P256-HKDF-SHA256+A256GCM-v1' };
  });
  const owner = '00000000-0000-4000-8000-000000000001';
  const connections = [
    { id: '000000000000000000000001', exchange: 'upbit', status: 'idle', label: '기존 업비트 계정', created_at: '2026-01-01T00:00:00Z' },
    { id: '000000000000000000000002', exchange: 'binance', status: 'idle', label: '기존 바이낸스 계정', created_at: '2026-01-01T00:00:00Z' },
  ];
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = request.url().replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    const reply = data => route.fulfill({ status: 200, json: { success: true, data, meta: { request_id: 'capability-browser-fixture', timestamp: new Date().toISOString() } } });
    if (path === '/api/v1/connections/capabilities') {
      state.requests++;
      if (state.mode === 'unavailable') return route.fulfill({ status: 503, json: { success: false, error: { code: 'UNAVAILABLE', message: 'Capability failure injected' } } });
      if (state.mode === 'malformed') return reply({ exchanges: [{ exchange: 'binance', availability: 'available', trades: true }] });
      if (state.mode === 'empty') return reply({ exchanges: [] });
      if (state.mode === 'revoked') return reply({ exchanges: [{ exchange: 'binance', availability: 'adapter_unavailable', trades: false, deposits: false, withdrawals: false, history_scope: '' }] });
      const response = await route.fetch({ url: api + path });
      if (response.status() !== 200) throw new Error('Actual capability service failed: ' + response.status());
      state.actual++;
      return route.fulfill({ response });
    }
    if (request.method() !== 'GET') {
      state.mutations.push({ method: request.method(), path });
      return route.fulfill({ status: 500, json: { success: false, error: { code: 'FIXTURE_MUTATION', message: 'UI fixture does not create or modify accounts' } } });
    }
    if (path === '/api/v1/users/me') return reply({ id: owner, email: 'capability-ui@example.test', name: '지원 정보 검증', locale: 'ko-KR', created_at: '2026-01-01T00:00:00Z', email_verified: true });
    if (path === '/api/v1/connections') return reply({ connections, multiple_accounts_enabled: true });
    if (path === '/api/v1/connections/public-key') return reply(publicKey);
    if (/^\/api\/v1\/connections\/[a-f0-9]{24}\/status$/.test(path)) return reply({ status: 'idle', events_synced: 0, events_pending: 0, events_failed: 0 });
    if (path === '/api/v1/ledger/ingestion') return reply({ complete: 0, pending: 0, failed: 0 });
    if (path === '/api/v1/notifications') return reply({ notifications: [], total: 0, has_more: false });
    if (path === '/api/v1/notifications/unread-count') return reply({ count: 0 });
    state.unexpected.push(path);
    return route.fulfill({ status: 503, json: { success: false, error: { code: 'UNEXPECTED_FIXTURE_ROUTE', message: path } } });
  });
  await page.evaluate(() => localStorage.setItem('tracevault_session_v1', JSON.stringify({ version: 1, id: 'capability-ui-session', accessToken: 'access-one', refreshToken: 'unused-ui-refresh' })));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(target.origin + '/connections');
  await page.getByRole('heading', { name: '거래소 연결', exact: true }).waitFor();
  return { scope: 'Actual capability RPC/HTTP, fixture-only auth/accounts/status', actualResponses: state.actual };
}
