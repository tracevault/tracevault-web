# TraceVault Web

The production Web client for the TraceVault services. It consumes the canonical
HTTP contract from `../tracevault-contracts/http/openapi.json`; generated types are
checked for drift with `npm run contracts:check`.

The release bundle uses local operating-system font stacks. Building and rendering
the application does not download fonts from a third-party host.

## Local setup

Copy `.env.example` to `.env.local`, set `NEXT_PUBLIC_API_URL`, then run:

```bash
npm install
npm run dev
```

The application is served at `http://localhost:3000` by default.

The release image uses the same Web origin for API calls. Build it with
`NEXT_PUBLIC_API_URL=/gateway` and `API_PROXY_TARGET` set to the private Gateway
HTTP(S) origin (for example, `http://gateway:8080`). The Next server rewrites
`/gateway/api/v1/*` to Gateway's `/api/v1/*`; it does not change the canonical
request or response body. `API_PROXY_TARGET` must be an origin without a path,
query or fragment. If it is absent, no proxy route is installed. The Dockerfile
builds the standalone production bundle with `npm run build -- --webpack`.

## WalletConnect QR configuration

WalletConnect QR is optional and fails closed when `NEXT_PUBLIC_REOWN_PROJECT_ID`
is absent. Create a public project ID in the Reown Dashboard, restrict its origin
allowlist to the deployed TraceVault origin and supply it at build time. The QR flow
requests only `personal_sign` for the six declared EVM networks or
`solana_signMessage` for Solana, then submits the signature to the same five-minute
TraceVault ownership challenge used by injected wallets. It disconnects the remote
session after the ownership attempt. Never place a wallet private key in a public
environment value.

## Browser Push configuration

Browser Push is optional and fails closed when its public build configuration is
absent. Supply all five values when building a release that advertises browser Push:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_VAPID_KEY
```

These Firebase Web application values and the VAPID public key are public client
configuration. Never place a Firebase service-account credential or VAPID private
key in a `NEXT_PUBLIC_*` value. Next.js embeds these values during `next build`, so
setting them only when starting an already-built image does not configure the client.

The user must press **이 브라우저에서 푸시 받기** before the application requests
notification permission. The root `/tracevault-push-sw.js` service worker accepts
only TraceVault's notifications page and canonical retained-report route for click
navigation. Registration proves only that a token was obtained and retained by the
owned device API; provider acceptance and browser receipt are separate operations.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run contracts:check
npm run build
npm audit --omit=dev
```
