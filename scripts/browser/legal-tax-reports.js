/* eslint-disable @typescript-eslint/no-unused-expressions -- Playwright CLI function expression. */
// Run after Legal Tax fixture UI login against serve-portfolio-acceptance.py with
// --production-web --tax-fixture --tax-http-check --keep-legal-current.
async (page) => {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const origin = page.url().match(/^https?:\/\/[^/]+/)[0];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/tax');
  await page.getByLabel('보고 연도').selectOption('2027');
  await page.getByText('2027년 · 한국 · KRW', { exact: true }).waitFor();

  const runHistory = page.locator('section').filter({ hasText: '저장된 계산 이력' });
  const retainedRun = runHistory.locator('li button').first();
  await retainedRun.waitFor();
  await retainedRun.click();
  const reports = page.getByRole('region', { name: '법정 세액 보고서' });
  await reports.waitFor();
  await reports.getByText('신고 접수증이나 납부 영수증이 아닙니다.', { exact: false }).waitFor();
  const reportRows = reports.locator('li');
  check(await reportRows.count() === 3, 'Expected one retained report in each format');
  for (const format of ['PDF', 'CSV', 'JSON']) {
    check(await reportRows.filter({ hasText: new RegExp(`^${format} ·`) }).count() === 1, `Missing ${format} retained report`);
  }

  await reports.getByLabel('보고서 형식').selectOption('PDF');
  const createdResponse = page.waitForResponse(response =>
    response.request().method() === 'POST' && response.url().endsWith('/api/v1/tax/legal-tax-reports'));
  await reports.getByRole('button', { name: '법정 세액 보고서 생성', exact: true }).click();
  const created = await createdResponse;
  check(created.status() === 201, `Legal report reuse returned HTTP ${created.status()}`);
  const createdBody = created.request().postDataJSON();
  check(createdBody.format === 'PDF' && typeof createdBody.legal_tax_run_id === 'string', 'Browser report request changed contract');
  await reports.getByText('PDF 보고서가 보존되었습니다.', { exact: false }).waitFor();

  const downloaded = [];
  for (const format of ['PDF', 'CSV', 'JSON']) {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      reports.getByRole('button', { name: `${format} 다운로드`, exact: true }).click(),
    ]);
    const filename = download.suggestedFilename();
    check(new RegExp(`^legal-tax-[a-f0-9-]{36}\\.${format.toLowerCase()}$`).test(filename), `Unexpected ${format} filename: ${filename}`);
    check(await download.failure() === null, `${format} browser download failed`);
    const path = `output/playwright/legal-tax-report-browser.${format.toLowerCase()}`;
    await download.saveAs(path);
    await reports.getByText(`${format} 법정 세액 파일을 검증하여 브라우저에 전달했습니다.`, { exact: true }).waitFor();
    downloaded.push({ format, filename, path });
  }

  await reports.getByText('파일·정책 검증 정보', { exact: true }).first().click();
  check(await reports.getByText(/^파일 [a-f0-9]{64}$/).count() >= 1, 'File checksum is not visible');
  check(await reports.getByText(/^정책 kr-resident-virtual-assets-2027-v1 · [a-f0-9]{64}$/).count() >= 1, 'Policy digest is not visible');
  await page.screenshot({ path: 'output/playwright/legal-tax-report-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  check((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'Legal report page overflows mobile viewport');
  await page.screenshot({ path: 'output/playwright/legal-tax-report-mobile.png', fullPage: true });
  check(pageErrors.length === 0, `Browser page errors: ${pageErrors.join('; ')}`);
  return {
    result: 'PASS',
    checks: ['production login', 'retained legal run', 'report reuse POST', 'three-format list', 'checksum-verified browser downloads', 'policy/file digest visibility', 'non-filing disclaimer', 'mobile layout'],
    downloads: downloaded,
    scope: 'Production Web + actual Identity/Gateway/Ledger/Valuation/Tax/PostgreSQL/Redis; pricing/FX HTTP fixtures.',
  };
}
