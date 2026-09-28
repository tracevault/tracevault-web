/* eslint-disable @typescript-eslint/no-unused-expressions -- Playwright CLI function expression. */
// Requires exchange-capabilities-setup.js in the same CLI browser session.
async (page) => {
  const state = page.capabilityFixture;
  if (!state) throw new Error('Run capability setup first');
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const upbit = page.locator('[data-connection-id="000000000000000000000001"]');
  const binance = page.locator('[data-connection-id="000000000000000000000002"]');
  const kraken = page.locator('[data-slot="card"]').filter({ hasText: 'Kraken' });
  const add = page.getByRole('button', { name: 'Binance 계정 추가', exact: true });
  const key = page.getByPlaceholder('Binance API Key를 입력하세요');
  const secret = page.getByPlaceholder('Binance Secret Key를 입력하세요');
  if (await page.getByRole('button', { name: 'Close', exact: true }).count()) await page.getByRole('button', { name: 'Close', exact: true }).click();
  check(await upbit.getByRole('button', { name: '동기화', exact: true }).isDisabled(), 'Unverified Upbit allowed sync');
  check(await page.getByRole('button', { name: '연결하기', exact: true }).isDisabled(), 'Unverified Bithumb allowed connection');
  check(await binance.getByRole('button', { name: '동기화', exact: true }).isEnabled(), 'Actual Binance capability lost');
  check(await kraken.getByRole('button', { name: '연결하기', exact: true }).isEnabled(), 'Actual Kraken capability lost');
  check(await page.getByText('거래소 2개 · 지갑 0개 · 자동 연결 가능 거래소 2곳', { exact: true }).count() === 1, 'Wrong available exchange count');
  check(await page.getByText('잔액', { exact: true }).count() === 0, 'Unimplemented balance collection advertised');
  await page.screenshot({ path: 'output/playwright/exchange-capabilities-desktop.png', fullPage: true });
  await page.clock.install();
  const backgroundRefetch = async mode => {
    state.mode = mode;
    await page.clock.fastForward(31_000);
    // React Query refetches stale capabilities when the page becomes visible.
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  };
  const blocked = async () => {
    for (const button of await page.getByRole('button', { name: /^(동기화|연결하기|다시 연결)$/ }).all()) check(await button.isDisabled(), 'Unknown support left an action enabled');
    check(await add.count() === 0, 'Unknown support allowed account addition');
    for (const button of await page.getByRole('button', { name: '해제', exact: true }).all()) check(await button.isEnabled(), 'Capability loss disabled retained disconnection');
    check(await upbit.count() === 1 && await binance.count() === 1, 'Retained accounts disappeared');
  };
  const recover = async () => {
    state.mode = 'actual';
    const retry = page.getByRole('button', { name: '다시 확인', exact: true });
    await (await retry.count() ? retry : page.getByRole('button', { name: '새로고침', exact: true })).click();
    await add.waitFor();
    check(await key.count() === 0, 'Recovery automatically reopened the credential form');
  };
  for (const mode of ['unavailable', 'malformed', 'revoked', 'empty']) {
    await add.click();
    await key.fill('fixture-key-never-submit');
    await secret.fill('fixture-secret-never-submit');
    await backgroundRefetch(mode);
    await key.waitFor({ state: 'detached' });
    await blocked();
    if (mode === 'unavailable') await page.screenshot({ path: 'output/playwright/exchange-capabilities-unavailable.png', fullPage: true });
    await recover();
    await add.click();
    check(await key.inputValue() === '' && await secret.inputValue() === '', 'Credential text survived capability loss');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
  }
  // A failed first request must not borrow an earlier successful query cache.
  state.mode = 'unavailable';
  await page.reload();
  await page.getByRole('button', { name: '다시 확인', exact: true }).waitFor();
  await blocked();
  await recover();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'output/playwright/exchange-capabilities-mobile.png', fullPage: true });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Mobile page overflows horizontally');
  check(state.actual >= 6, 'Actual metadata service was not exercised during recovery');
  check(state.mutations.length === 0 && state.unexpected.length === 0 && state.errors.length === 0, JSON.stringify(state));
  return { result: 'PASS', scenarios: ['actual capabilities', 'unverified admission disabled', 'retained accounts accessible', '503 recovery', 'malformed payload rejection', 'adapter revocation', 'missing exchange evidence', 'credential cleanup/no automatic reopen', 'cold request failure', 'mobile layout'], evidence: state, scope: 'Actual native Collector + Gateway metadata route + production Web; test Identity peer and UI account/status/public-key fixtures, injected capability faults; no vendor credentials or account mutation' };
}
