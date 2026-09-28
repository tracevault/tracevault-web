/* eslint-disable @typescript-eslint/no-unused-expressions -- Playwright CLI function expression. */
// Run after actual Alice UI login against serve-portfolio-acceptance.py with
// --production-web --exchange-fixture. Only exchange/pricing HTTP are fixtures.
async (page) => {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const requestBodies = [];
  const origin = page.url().match(/^https?:\/\/[^/]+/)[0];
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/connections');
  await page.getByText('자동 연결 가능 1곳').waitFor();

  const connect = page.locator('button:not([disabled])').filter({ hasText: /^연결하기$/ });
  check(await connect.count() === 1, 'Exactly one reviewed exchange must be connectable');
  await connect.click();
  await page.getByPlaceholder('예: 장기 보관 계정').fill('Browser Binance');
  await page.getByPlaceholder('Binance API Key를 입력하세요').fill('browser-fixture-key');
  await page.getByPlaceholder('Binance Secret Key를 입력하세요').fill('browser-fixture-secret');

  const testResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/connections/test'));
  await page.getByRole('button', { name: '연결 테스트', exact: true }).click();
  const tested = await testResponse;
  const testedBody = tested.request().postDataJSON();
  requestBodies.push({ operation: 'test', status: tested.status() });
  check(tested.status() === 200, 'Read-only credential test failed');
  check(testedBody.api_key_encrypted !== 'browser-fixture-key' && testedBody.api_secret_encrypted !== 'browser-fixture-secret', 'Plain credentials crossed test HTTP');
  await page.getByText('연결 테스트 성공! API Key가 유효합니다.').waitFor();

  const createResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/connections'));
  await page.locator('form').getByRole('button', { name: '연결하기', exact: true }).click();
  const created = await createResponse;
  const createdBody = created.request().postDataJSON();
  requestBodies.push({ operation: 'connect', status: created.status() });
  check(created.status() === 201, 'Connection creation failed');
  check(createdBody.api_key_encrypted !== 'browser-fixture-key' && createdBody.api_secret_encrypted !== 'browser-fixture-secret', 'Plain credentials crossed create HTTP');

  const card = page.locator('[data-connection-id]').filter({ hasText: 'Binance · Browser Binance' });
  await card.getByRole('button', { name: '동기화', exact: true }).waitFor();
  const connectionID = await card.getAttribute('data-connection-id');
  const syncResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/connections/${connectionID}/sync`));
  await card.getByRole('button', { name: '동기화', exact: true }).click();
  check((await syncResponse).status() === 202, 'Sync was not accepted');

  let completed = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    await page.waitForTimeout(500);
    await page.reload();
    const current = page.locator('[data-connection-id]').filter({ hasText: 'Binance · Browser Binance' });
    const currentText = await current.textContent();
    if (currentText?.includes('동기화 완료') && currentText.includes('원장 반영: 1건 · 처리 대기: 0건')) {
      completed = true;
      break;
    }
  }
  check(completed, 'Collector completion did not reach Ledger');
  await page.screenshot({ path: 'output/playwright/connection-sync-completed.png', fullPage: true });

  await page.goto(origin + '/portfolio');
  await page.getByText('$123.35369135690246913478', { exact: true }).waitFor();
  const account = page.locator('article').filter({ hasText: 'binance' });
  check(await account.getByText('BTC 0.01', { exact: true }).count() === 1, 'Synced BTC was not allocated to its Ledger account');
  check(await account.getByText('USD -1.001', { exact: true }).count() === 1, 'Synced consideration/fee was lost');
  check(await account.getByText('₩299.3333622776318533626272797', { exact: true }).count() === 1, 'Synced account value changed');

  await page.getByRole('textbox', { name: '시작일' }).fill('2026-09-18');
  await page.getByRole('textbox', { name: '종료일' }).fill('2026-09-20');
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.getByRole('cell', { name: '2026-09-20', exact: true }).waitFor();
  check(await page.getByText('현재 페이지 평가액 변동: ₩299.33336227763185336262728', { exact: true }).count() === 1, 'Historical sync delta changed');
  for (const date of ['2026-09-18', '2026-09-19', '2026-09-20']) check(await page.getByRole('cell', { name: date, exact: true }).count() === 1, `Missing history date ${date}`);
  await page.screenshot({ path: 'output/playwright/connection-sync-portfolio.png', fullPage: true });

  return {
    result: 'PASS',
    connection_id: connectionID,
    requests: requestBodies,
    checks: ['browser encryption', 'read-only principal/permission validation', 'connection persistence', 'native sync', 'Kafka/Ledger completion', 'account allocation', 'exact current/history valuation'],
    scope: 'Production Web + actual Identity/Gateway/Collector/Kafka/Ledger/Valuation/PostgreSQL/Redis/Mongo; signed Binance and price/FX HTTP fixtures.',
  };
}
