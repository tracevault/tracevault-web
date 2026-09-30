# Authentication browser acceptance

Run against the real isolated stack, using the production bundle so development
hot reload cannot replace the client while an adversarial request is pending:

```sh
python3 tracevault-infra/scripts/serve-portfolio-acceptance.py \
  --production-web \
  --ready-file /tmp/tracevault-auth-ready.json \
  --stop-file /tmp/tracevault-auth-stop
```

Use fresh ready/stop paths for each run. The ready file contains the Web/API URLs.
The harness creates disposable `portfolio-alice@example.com` and
`portfolio-bob@example.com` accounts, both with `Password123!`. These are local
fixtures only. Do not use these scenarios against a deployment or real account.

1. Open a dedicated headed Playwright CLI session at the ready Web `/login` URL.
2. Use the actual login form to sign in as Alice; wait for her dashboard heading.
3. From `tracevault-web`, run `playwright-cli -s=<session> run-code --filename
   scripts/browser/auth-session-race.js`. It opens the second tab and waits for
   both to send an expired token before releasing their requests to the real API.
4. Check the returned `result: PASS`, **not only CLI exit status**. Some CLI
   versions print `### Error` while exiting zero. Expected rotations: exactly1.
5. Run `scripts/browser/auth-session-transitions.js` the same way. It requires
   those two Alice tabs, delays a genuine Alice profile response, uses the UI to
   logout/login Bob, then revokes Bob through the real API and verifies expiry.
6. Require `result: PASS` for every scenario; inspect screenshots under
   `output/playwright/auth-session-*.png`. The scripts never log token contents.
7. Close only the dedicated browser session, create the matching stop file, and
   wait for the harness to exit and remove its scoped processes/containers.

These scripts execute function expressions through the CLI; they are not a
separate test runner or fake application. Gateway/Identity/PostgreSQL/Redis and
browser storage/Web Locks are real. Pricing is an external-provider fixture from
the existing portfolio harness. This workflow does not certify external vendors,
all release browsers, or the whole-product deployment/CI gate.

## Connection → sync → portfolio

Start a fresh stack with `--production-web --exchange-fixture`, log in as the
fixture Alice through the actual form, then run `connection-sync-portfolio.js` as
a Playwright CLI function file. It connects the single available Binance adapter,
checks that plaintext keys never cross either HTTP request, starts sync, waits for
one Kafka/Ledger record, and verifies exact current and historical account values.
Require the returned `result: PASS`, save the two named screenshots, then close the
dedicated browser and stop the scoped stack. The signed Binance and price/FX HTTP
servers are fixtures; all application services and storage are actual mains.

## Accounting policy → income and transfer fee

Start a fresh production stack with `--tax-fixture --tax-http-check`, log in as
`tax-alice@example.com` with the local fixture password `Password123!`, and run
`tax-policy-income.js`. Require `result: PASS`. It selects the newest immutable
2024 run created by the HTTP acceptance, checks the v1 accounting-policy notice,
the reward income total and detail, the internal-transfer fee disposition, and
desktop/mobile rendering. Pricing and FX HTTP remain fixtures; application
services, profile revision, Ledger history, Tax run storage and the Web bundle
are actual.

## Durable cryptographic Proof batch

Start a fresh production stack with `--tax-fixture --tax-http-check` and an absolute
`--proof-worker` path, then log in as the fixture Tax Alice. Run `proof-batch.js` as
a Playwright CLI function file. It requests retained Ledger and AccountingRun proofs
through their product screens, selects both ordered inputs, waits for the real RISC
Zero batch, and verifies two result proof IDs, reload recovery, canonical Merkle
root/order and mobile layout. Require `result: PASS`. The batch is two individually
verified cryptographic receipts with Merkle membership, not a recursive aggregate
proof. Application services and storage are actual; pricing/FX remain fixtures.

## Retained Korea legal-tax reports

Start a fresh production stack with `--tax-fixture --tax-http-check
--keep-legal-current --production-web`, then log in as
`legal-tax-run@example.com` with the local fixture password `Password123!`. Run
`legal-tax-reports.js` as a Playwright CLI function file and require its returned
`result: PASS`. It selects the retained 2027 legal run, reuses the current PDF
artifact through the actual create route, lists all three formats, downloads each
through the Web checksum verifier, checks policy/file digest disclosure and the
non-filing disclaimer, then checks desktop and 390px mobile layouts. The Tax HTTP
fixture already verifies complete file semantics, owner isolation and restart; this
browser step proves the product UI and browser download boundary. It does not claim
tax-authority filing or payment acceptance.

## WalletConnect configuration fallback

Start a fresh production stack without `NEXT_PUBLIC_REOWN_PROJECT_ID`, log in as the
portfolio fixture owner and run `walletconnect-unconfigured.js`. Require its returned
`result: PASS`. It verifies that all seven canonical chains remain selectable while
the QR action is disabled with explicit browser-wallet/read-only alternatives, and
checks desktop plus 390px mobile layouts. This is the production fail-closed path;
live QR pairing and wallet signature acceptance require a release Reown project ID
with an origin allowlist and remain external-provider acceptance.
