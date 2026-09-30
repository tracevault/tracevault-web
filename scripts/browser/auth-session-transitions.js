/* eslint-disable @typescript-eslint/no-unused-expressions -- Playwright CLI evaluates this function expression. */
// Requires two Alice dashboard tabs from auth-session-race.js. Only delay a
// genuine profile response; login, logout, expiry and all data use real services.
async (page) => {
  const context = page.context();
  const second = context.pages().find(tab => tab !== page);
  if (!second) throw new Error('Second logged-in tab required');
  await second.setViewportSize({ width: 1440, height: 1000 });
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('tracevault_session_v1')));
  let release, arrived;
  const held = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { arrived = resolve; });
  let api;
  const gate = async route => {
    const request = route.request();
    if (request.frame().page() === page && request.headers().authorization === 'Bearer ' + original.accessToken) {
      const response = await route.fetch();
      if (response.status() !== 200) throw new Error('Expected genuine successful Alice profile');
      api = request.url().split('/api/v1/')[0];
      arrived();
      await Promise.race([held, page.waitForTimeout(20000)]);
      await route.fulfill({ response });
    } else await route.continue();
  };
  await context.route('**/api/v1/users/me', gate);
  try {
    await page.reload();
    await Promise.race([entered, page.waitForTimeout(10000).then(() => { throw new Error('Alice response not captured'); })]);
    await second.getByRole('button', { name: '로그아웃', exact: true }).click();
    await Promise.all([page, second].map(tab => tab.waitForURL('**/login')));
    for (const tab of [page, second]) {
      if (await tab.getByText('Portfolio Alice', { exact: true }).count()) throw new Error('Alice visible after logout');
    }
    await second.getByRole('textbox', { name: '이메일', exact: true }).fill('portfolio-bob@example.com');
    await second.getByRole('textbox', { name: '비밀번호', exact: true }).fill('Password123!');
    await second.getByRole('button', { name: '로그인', exact: true }).click();
    await Promise.all([page, second].map(tab => tab.getByRole('heading', { name: '안녕하세요, Portfolio Bob님' }).waitFor()));
    const replacement = await page.evaluate(() => JSON.parse(localStorage.getItem('tracevault_session_v1')));
    if (replacement.id === original.id) throw new Error('Account change retained previous login identity');
    release();
    await page.waitForTimeout(500);
    for (const tab of [page, second]) {
      if (await tab.getByText('Portfolio Alice', { exact: true }).count()) throw new Error('Late Alice response restored previous profile');
      await tab.getByRole('heading', { name: '안녕하세요, Portfolio Bob님' }).waitFor();
    }
    await page.screenshot({ path: 'output/playwright/auth-session-bob-desktop.png', fullPage: true });
    // Revoke Bob at the actual backend without notifying local browser state,
    // then force refresh to exercise definitive expiry and route/cache cleanup.
    const status = await page.evaluate(async api => {
      const current = JSON.parse(localStorage.getItem('tracevault_session_v1'));
      const response = await fetch(api + '/api/v1/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + current.accessToken }, body: JSON.stringify({ refresh_token: current.refreshToken }) });
      await navigator.locks.request('tracevault-auth-session-v1', () => localStorage.setItem('tracevault_session_v1', JSON.stringify({ ...current, accessToken: null })));
      return response.status;
    }, api);
    if (status !== 200) throw new Error('Backend revocation failed');
    await Promise.all([page.reload(), second.reload()]);
    await Promise.all([page, second].map(tab => tab.waitForURL('**/login')));
    for (const tab of [page, second]) {
      if (await tab.evaluate(() => localStorage.getItem('tracevault_session_v1'))) throw new Error('Expired credentials retained');
      await tab.getByRole('button', { name: '로그인', exact: true }).waitFor();
    }
    await page.screenshot({ path: 'output/playwright/auth-session-expired-desktop.png', fullPage: true });
    return { result: 'PASS', scenarios: ['cross-tab logout routes', 'cross-tab replacement login', 'late real Alice profile rejected', 'backend revocation and cross-tab expiry routes'] };
  } finally {
    release(); await context.unroute('**/api/v1/users/me', gate);
  }
}
