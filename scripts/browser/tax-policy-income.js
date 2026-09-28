/* eslint-disable @typescript-eslint/no-unused-expressions -- Playwright CLI function expression. */
// Run after Tax Alice UI login against serve-portfolio-acceptance.py with
// --production-web --tax-fixture --tax-http-check.
async (page) => {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const origin = page.url().match(/^https?:\/\/[^/]+/)[0];
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/tax');
  await page.getByLabel('보고 연도').selectOption('2024');
  await page.getByText('회계 정책 v2 적용 중', { exact: false }).waitFor();
  const newest = page.locator('section').filter({ hasText: '저장된 계산 이력' }).locator('li button').first();
  await newest.click();
  await page.getByText('보상·에어드롭 수익', { exact: true }).waitFor();
  const incomeTotal = page.getByText('보상·에어드롭 수익', { exact: true }).locator('..').locator('dd');
  check(!(await incomeTotal.textContent()).includes('0 JPY'), 'Income total was rendered as zero');
  await page.getByLabel('상세 내역').selectOption('INCOME');
  await page.getByText('수령 시점 가치', { exact: true }).waitFor();
  check(await page.getByText('보상', { exact: true }).count() === 1, 'Reward income detail missing');
  const expenseTotal = page.getByText('법정화폐 이전 수수료 비용', { exact: true }).locator('..').locator('dd');
  check(!(await expenseTotal.textContent()).includes('0 JPY'), 'Fiat transfer expense total was rendered as zero');
  await page.getByLabel('상세 내역').selectOption('EXPENSE');
  await page.getByText('환산 비용', { exact: true }).waitFor();
  check(await page.getByText('이전 수수료', { exact: true }).count() === 1, 'Fiat transfer expense detail missing');
  await page.getByLabel('상세 내역').selectOption('DISPOSITION');
  check(await page.getByText('수수료 지급', { exact: true }).count() >= 1, 'Transfer fee disposition missing');
  await page.screenshot({ path: 'output/playwright/tax-policy-income-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  check((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'Tax policy page overflows mobile viewport');
  await page.screenshot({ path: 'output/playwright/tax-policy-income-mobile.png', fullPage: true });
  return {
    result: 'PASS',
    checks: ['policy v2 disclosure', 'income total', 'income detail', 'fiat expense total', 'fiat expense detail', 'transfer-fee disposition', 'mobile layout'],
    scope: 'Production Web + actual Identity/Gateway/Ledger/Valuation/Tax/PostgreSQL/Redis; pricing/FX HTTP fixtures.',
  };
}
