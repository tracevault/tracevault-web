/* eslint-disable @typescript-eslint/no-unused-expressions -- Playwright CLI function expression. */
// Run after Tax Alice UI login against serve-portfolio-acceptance.py with
// --production-web --tax-fixture --tax-http-check --proof-worker <absolute path>.
async (page) => {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const origin = page.url().match(/^https?:\/\/[^/]+/)[0];
  await page.setViewportSize({ width: 1440, height: 1000 });

  // Replaying these UI actions is safe: each page persists its request UUID and
  // retained input before network submission.
  await page.goto(origin + '/ledger');
  await page.getByRole('button', { name: '원본·정정 이력' }).click();
  await page.getByRole('button', { name: '출처 추적' }).first().click();
  const ledgerProof = page.getByRole('region', { name: '증명 요청' });
  await ledgerProof.getByRole('button', { name: '증명 요청 · 기존 접수 확인' }).click();
  await ledgerProof.getByRole('link', { name: '증명 작업 보기' }).waitFor();

  await page.goto(origin + '/tax');
  await page.getByLabel('보고 연도').selectOption('2024');
  const newestRun = page.locator('section').filter({ hasText: '저장된 계산 이력' }).locator('li button').first();
  await newestRun.click();
  const accountingProof = page.getByRole('region', { name: '증명 요청' });
  await accountingProof.getByRole('button', { name: '증명 요청 · 기존 접수 확인' }).click();
  await accountingProof.getByRole('link', { name: '증명 작업 보기' }).click();

  await page.getByText(/전체 [2-9][0-9]*개 · 배치 입력/).waitFor();
  const batchJobs = page.getByRole('region', { name: '암호학적 배치 증명 작업' });
  if (await batchJobs.locator('li button').count() === 0) {
    const selectors = page.getByRole('checkbox', { name: /배치 입력 선택/ });
    check(await selectors.count() >= 2, 'Two retained inputs were not available');
    await selectors.nth(0).check();
    await selectors.nth(1).check();
    await batchJobs.getByRole('button', { name: '선택한 2개 배치 증명 요청' }).click();
  } else {
    await batchJobs.locator('li button').first().click();
  }

  const detail = batchJobs.getByLabel('선택한 암호학적 배치 작업');
  await detail.getByRole('heading', { name: /완료 · 시도 1\/3/ }).waitFor({ timeout: 1_200_000 });
  await detail.getByText('모든 항목의 개별 증명과 배치 포함 관계를 원자적으로 보존했습니다.').waitFor();
  check(await detail.getByText(/ · 증명 /).count() === 2, 'Completed batch did not expose two proof IDs');
  const batchLabel = await detail.getByText(/배치 번호 /).textContent();
  check(batchLabel.split(' ').at(-1).length === 36, 'Batch ID missing');

  await page.reload();
  const reloadedJobs = page.getByRole('region', { name: '암호학적 배치 증명 작업' });
  await reloadedJobs.locator('li button').first().click();
  await reloadedJobs.getByRole('heading', { name: /완료 · 시도 1\/3/ }).waitFor();
  const history = page.getByRole('region', { name: '증명 배치 기록' });
  await history.getByRole('button', { name: '배치 목록 새로고침' }).click();
  await history.locator('li button').first().click();
  const root = await history.getByText(/Merkle 루트 [0-9a-f]{64}/).textContent();
  check(/Merkle 루트 [0-9a-f]{64}/.test(root), 'Canonical Merkle root missing after reload');
  check(await history.getByText(/잎 0 · 입력 0 · 증명 /).count() === 1, 'First ordered membership missing');
  check(await history.getByText(/잎 1 · 입력 1 · 증명 /).count() === 1, 'Second ordered membership missing');
  await page.screenshot({ path: 'output/playwright/proof-batch-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  check((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'Proof batch page overflows mobile viewport');
  await page.screenshot({ path: 'output/playwright/proof-batch-mobile.png', fullPage: true });
  return {
    result: 'PASS',
    checks: ['two UI-created retained inputs', 'durable batch completion', 'two proof IDs', 'reload', 'Merkle root/order', 'mobile layout'],
    scope: 'Production Web + actual Identity/Gateway/Ledger/Tax/Proof/PostgreSQL/Redis and pinned RISC Zero worker; pricing/FX HTTP fixtures.',
  };
}
