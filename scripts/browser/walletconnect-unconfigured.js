/* eslint-disable @typescript-eslint/no-unused-expressions -- Playwright CLI function expression. */
// Run after the portfolio fixture UI login against serve-portfolio-acceptance.py
// --production-web without NEXT_PUBLIC_REOWN_PROJECT_ID.
async (page) => {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const origin = page.url().match(/^https?:\/\/[^/]+/)[0];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(origin + '/connections');
  await page.getByRole('button', { name: '지갑 추가', exact: true }).click();
  await page.getByText('지갑 연결', { exact: true }).waitFor();
  check(await page.getByLabel('체인').locator('option').count() === 7, 'Expected seven canonical wallet networks');
  check(await page.getByRole('button', { name: 'WalletConnect QR', exact: true }).isDisabled(), 'Unconfigured WalletConnect must be disabled');
  await page.getByText('이 배포에는 WalletConnect QR이 구성되지 않았습니다.', { exact: false }).waitFor();
  await page.screenshot({ path: 'output/playwright/walletconnect-unconfigured-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  check((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'Wallet dialog overflows mobile viewport');
  await page.screenshot({ path: 'output/playwright/walletconnect-unconfigured-mobile.png', fullPage: true });
  check(pageErrors.length === 0, `Browser page errors: ${pageErrors.join('; ')}`);
  return {
    result: 'PASS',
    checks: ['production login', 'seven canonical chains', 'unconfigured QR disabled', 'explicit fallback copy', 'desktop layout', '390px mobile layout'],
    scope: 'Production Web + actual Identity/Collector/Gateway; no Reown project ID or external wallet session.',
  };
}
