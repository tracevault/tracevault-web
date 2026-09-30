/* eslint-disable @typescript-eslint/no-unused-expressions -- Playwright CLI evaluates this function expression. */
// Run via playwright-cli run-code --filename after an actual UI login.
async (page) => {
  const origin = await page.evaluate(() => location.origin);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const context = page.context();
  const second = await context.newPage();
  await second.goto(origin + '/dashboard');
  await second.getByRole('heading', { name: '안녕하세요, Portfolio Alice님' }).waitFor();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('tracevault_session_v1')));
  let rotations = 0;
  const observe = request => { if (request.url().endsWith('/api/v1/auth/refresh')) rotations++; };
  context.on('request', observe);
  await page.evaluate(async () => navigator.locks.request('tracevault-auth-session-v1', () => {
    const session = JSON.parse(localStorage.getItem('tracevault_session_v1'));
    localStorage.setItem('tracevault_session_v1', JSON.stringify({ ...session, accessToken: 'expired-browser-fixture' }));
  }));
  // Hold actual outgoing requests until BOTH independent tabs read the expired
  // credential. All responses still come from the actual Gateway/Identity.
  const seen = new Set();
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const gate = async route => {
    if (route.request().headers().authorization === 'Bearer expired-browser-fixture') {
      seen.add(route.request().frame().page());
      if (seen.size === 2) release();
      await Promise.race([barrier, page.waitForTimeout(10000)]);
    }
    await route.continue();
  };
  await context.route('**/api/v1/**', gate);
  try {
    await Promise.all([page.reload(), second.reload()]);
    await Promise.all([page, second].map(tab => tab.getByRole('heading', { name: '안녕하세요, Portfolio Alice님' }).waitFor()));
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('tracevault_session_v1')));
    if (seen.size !== 2 || rotations !== 1 || after.id !== before.id || after.refreshToken === before.refreshToken) {
      throw new Error(`Invalid refresh coordination: tabs=${seen.size} rotations=${rotations}`);
    }
    await page.screenshot({ path: 'output/playwright/auth-session-race-desktop.png', fullPage: true });
    return { result: 'PASS', scenario: 'two actual browser tabs / single refresh / stable login identity', tabs: seen.size, rotations };
  } finally {
    release();
    await context.unroute('**/api/v1/**', gate);
    context.off('request', observe);
  }
}
