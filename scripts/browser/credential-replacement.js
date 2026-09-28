/* eslint-disable @typescript-eslint/no-unused-expressions -- Playwright CLI function expression. */
// Run after an actual UI login against test-account-selectors.py browser mode.
// Every account operation goes to real services; only vendor HTTP is a fixture.
async (page) => {
  const check = (value, message) => { if (!value) throw new Error(message); };
  await page.setViewportSize({ width: 1440, height: 1000 });
  const card = tab => tab.locator('[data-connection-id]').filter({ hasText: '보관 계정' });
  const key = tab => tab.getByPlaceholder('Binance API Key를 입력하세요');
  const secret = tab => tab.getByPlaceholder('Binance Secret Key를 입력하세요');
  const fill = async (tab, api, value) => { await key(tab).fill(api); await secret(tab).fill(value); };
  const results = [];
  const submit = async tab => {
    const responsePromise = tab.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith('/credentials'));
    await tab.locator('form').getByRole('button', { name: 'API 키 교체', exact: true }).click();
    const response = await responsePromise;
    const sent = response.request().postDataJSON();
    check(typeof sent.expected_revision === 'string', 'Revision crossed HTTP as a number');
    check(sent.api_key_encrypted !== 'test-api-key-12345' && sent.api_key_encrypted !== 'rotated-fixture-key' && sent.api_secret_encrypted !== 'test-secret-key-67890', 'Plain credentials crossed HTTP');
    results.push({ status: response.status(), expected_revision: sent.expected_revision });
    return { status: response.status(), body: await response.json(), revision: sent.expected_revision };
  };
  const connectionID = await card(page).getAttribute('data-connection-id');
  const originalCount = await page.locator('[data-connection-id]').count();
  if (await card(page).getByRole('button', { name: '다시 연결', exact: true }).count()) {
    await card(page).getByRole('button', { name: '다시 연결', exact: true }).click();
    await fill(page, 'rotated-fixture-key', 'rotated-fixture-secret');
    await page.locator('form').getByRole('button', { name: '다시 연결', exact: true }).click();
    await card(page).getByRole('button', { name: '키 교체', exact: true }).waitFor();
  }
  await card(page).getByRole('button', { name: '키 교체', exact: true }).click();
  check(await page.getByPlaceholder('예: 장기 보관 계정').count() === 0, 'Replacement offered renaming');
  await fill(page, 'foreign-fixture-key', 'foreign-fixture-secret');
  const rejected = await submit(page); check(rejected.status === 412, 'Foreign account accepted');
  await page.waitForFunction(() => document.querySelector('input[name="apiKey"]')?.value === '');
  check(await secret(page).inputValue() === '', 'Rejected secret retained');
  await page.screenshot({ path: 'output/playwright/credential-replacement-rejected.png', fullPage: true });
  await fill(page, 'test-api-key-12345', 'test-secret-key-67890');
  const changed = await submit(page); check(changed.status === 200, 'Valid replacement failed');
  check(changed.body.data.connection.id === connectionID, 'New history namespace created');
  check(BigInt(changed.body.data.connection.credential_revision) === BigInt(changed.revision) + BigInt(1), 'Incorrect replacement revision');
  await key(page).waitFor({ state: 'detached' });
  check(await page.locator('[data-connection-id]').count() === originalCount, 'Account count changed');
  // Two actual tabs capture the same revision. The second cannot overwrite the
  // first tab's successful replacement, even with otherwise valid credentials.
  const second = await page.context().newPage();
  try {
    await second.goto(page.url());
    await card(second).getByRole('button', { name: '키 교체', exact: true }).waitFor();
    await card(second).getByRole('button', { name: '키 교체', exact: true }).click();
    await fill(second, 'test-api-key-12345', 'test-secret-key-67890');
    await card(page).getByRole('button', { name: '키 교체', exact: true }).click();
    await fill(page, 'rotated-fixture-key', 'rotated-fixture-secret');
    const first = await submit(page); check(first.status === 200, 'First concurrent tab failed');
    const stale = await submit(second); check(stale.status === 409 && stale.revision === first.revision, 'Stale tab overwrote newer credentials');
    await key(second).waitFor({ state: 'detached' });
    await card(second).getByRole('button', { name: '키 교체', exact: true }).click();
    check(await key(second).inputValue() === '' && await secret(second).inputValue() === '', 'Stale form secrets survived refresh');
    await second.getByRole('button', { name: 'Close', exact: true }).click();
  } finally { await second.close(); }
  await page.screenshot({ path: 'output/playwright/credential-replacement-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'output/playwright/credential-replacement-mobile.png', fullPage: true });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow');
  return { result: 'PASS', checks: ['actual UI login and encrypted reconnect', 'owned native key replacement', 'foreign principal rejection', 'secret cleanup', 'same ID and account count', 'exact string revision increment', 'two actual tabs / stale409', 'mobile layout'], requests: results, scope: 'Production Web + actual Identity/Gateway/Collector/Postgres/Redis/Mongo; vendor HTTP fixture. Ledger/notification delivery services not started.' };
}
