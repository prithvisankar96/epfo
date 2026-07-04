# PF Pulse

Check your EPF (Employees' Provident Fund) balance and last 12 contributions in
under 60 seconds — UAN + OTP only. No EPFO portal password, no data stored.

Built with Next.js 14 (App Router), TypeScript, and Tailwind CSS. Deploys to
Vercel.

## Quick start

```bash
npm install
cp .env.example .env   # defaults are fine for local dev (mock provider)
npm run dev
```

Open http://localhost:3000. With the default `PF_PROVIDER=mock` you can drive
every flow with these test inputs (any 10-digit mobile starting 6–9 works):

| UAN ends in | Result |
|---|---|
| `00` | Happy path — 2 accounts, 12 contributions each |
| `01` | Exempted-trust screen (after OTP) |
| `02` | UAN-inactive screen |
| `03` | EPFO-unavailable screen |
| `04` | Mobile-mismatch screen |
| `05` | Invalid-UAN screen |
| `06` | Provider-unavailable screen |
| `07` | Unknown-error screen |
| `10` | Single account, 2 contributions (table instead of chart) |
| `11` | Zero-balance account |
| anything else | Happy path, 1 account |

OTP `123456` succeeds; `000000` triggers the expired-OTP screen; anything else
counts as a wrong attempt (3 wrong attempts reset the session).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `PF_PROVIDER` | yes | `mock` or `aggregator` |
| `PF_PROVIDER_API_KEY` | with `aggregator` | Aggregator bearer token (server-side only) |
| `PF_PROVIDER_BASE_URL` | with `aggregator` | Aggregator base URL, e.g. the vendor sandbox |
| `SESSION_SECRET` | production | HMAC key for the session cookie (`openssl rand -hex 32`) |
| `CONSENT_LOG_PATH` | no | Consent log file path (default `./data/consent-log.jsonl`) |
| `MOCK_DELAY_MS` | no | Artificial latency of the mock provider (default 400) |
| `RATE_LIMIT_MAX_INITIATES` | no | Initiates per IP per 10 min (default 5; raised in tests) |

No secret may ever carry a `NEXT_PUBLIC_` prefix — everything above is
server-side only.

## Swapping providers

All EPFO data access goes through the `PFProvider` interface
(`lib/providers/types.ts`) and is resolved by a single factory
(`lib/providers/index.ts`). Product code never imports a concrete provider.

To switch from mock to the real aggregator (Surepass):

1. Get a Surepass account (https://surepass.io → Request Access) and create
   a bearer JWT in the console (https://console.surepass.io). Ask for the
   **EPFO Passbook** product to be enabled — access is gated per product,
   and it's credit-metered per API hit.
2. Set the env vars (locally in `.env`, or Project → Settings → Environment
   Variables on Vercel):

```bash
PF_PROVIDER=aggregator
PF_PROVIDER_BASE_URL=https://sandbox.surepass.io/api/v1   # sandbox
# PF_PROVIDER_BASE_URL=https://kyc-api.surepass.app/api/v1 # production
PF_PROVIDER_API_KEY=<bearer JWT from the console>
```

3. Verify with `GET /api/health` — it reports the active provider, whether
   credentials are present, and API-host reachability.

That's it — zero code changes. The adapter implements Surepass's three-step
EPFO passbook flow (`generate-otp` → `submit-otp` → `get-passbook`) and
wraps every call with a 15s timeout, one retry on 5xx (never for OTP
submission), maps vendor `message_code`s and message text into the shared
`PFErrorCode` taxonomy (mapping table documented in the file), normalizes
amounts to integer INR and months to `YYYY-MM`, and logs only request
metadata — never UAN, mobile, OTP, or response bodies.

Two Surepass behaviours worth knowing:

* **The OTP always goes to the UAN-registered mobile** — the vendor takes
  only the UAN. The adapter compares the vendor's masked registered number
  against the user-entered mobile and fails fast with `MOBILE_MISMATCH`
  when the visible tail differs.
* **The basic passbook payload may omit `pension_share`** on some rows; the
  adapter treats missing pension amounts as 0. If EPS accuracy matters,
  evaluate Surepass's "EPFO Passbook Advanced" endpoints.

### `[OPEN]` decisions made in this build

* **Aggregator vendor: Surepass.** The adapter targets Surepass's documented
  EPFO Passbook API (request/response shapes verified against their public
  API docs; unit tests replay the documented payloads). Only
  `lib/providers/aggregator.ts` should need touching if the vendor changes.
* **Consent log: local JSONL file** (`data/consent-log.jsonl`), append-only.
  Simplest for v1. On Vercel the deployment filesystem is read-only, so the
  default automatically falls back to `/tmp/pf-pulse-consent-log.jsonl` —
  which works but does not survive redeploys or instance recycling. For
  production, point `CONSENT_LOG_PATH` at a mounted volume or replace the
  file append in `lib/consent.ts` with a hosted append-only log (e.g. Axiom,
  S3). The DPDP consent record must be durable.
* **No Redis.** Neither the mock nor the aggregator flow needs server-held
  state across OTP steps beyond the session store, so Redis was not added.
* **"Download summary" skipped** — every client-side PNG/PDF option added a
  heavy dependency.

## Session & data policy

* PF data lives in a server-side in-memory session store keyed by a signed,
  httpOnly cookie. TTL 30 minutes; "Check another UAN" destroys it instantly.
* Zero PF data in `localStorage`/`sessionStorage`, URLs, or logs — enforced by
  E2E tests (`tests/e2e/flow.spec.ts`) and a grep audit.
* Consent is logged (SHA-256 UAN hash, masked mobile, consent text version,
  timestamp, IP) **before** any provider call — verified by
  `tests/e2e/consent.spec.ts`.
* Privacy policy lives at `/privacy` and is linked from the consent screen and
  footer.

## Vercel multi-instance caveats

Two v1 components are in-memory and therefore **per-instance** on Vercel:

* the IP rate limiter (`lib/ratelimit.ts`) — the effective limit is per
  serverless instance, so bursts across instances can exceed 5/10 min;
* the session store (`lib/session.ts`) — a `complete` request served by a
  different instance than `initiate` won't find the session.

Low traffic on a single region generally sticks to one warm instance, but for
real scale move both to Redis (Upstash) — the interfaces are small and
self-contained.

## Known EPFO 3.0 flakiness

EPFO migrated to its new EPFO 3.0 platform in July 2026 and third-party access
has been intermittently degraded since. The app surfaces this as the
`EPFO_UNAVAILABLE` state, which points users at the official missed-call
fallback (9966044425 from the UAN-registered mobile). Expect elevated
`EPFO_UNAVAILABLE`/`PROVIDER_UNAVAILABLE` rates until the platform stabilizes;
the aggregator adapter already retries 5xx once (except OTP submission).

## Future migration path (do not build yet)

The provider interface was designed for what comes after the aggregator:

* **NPCI/UPI rails** — EPFO 3.0 is integrating with NPCI; when
  balance-check-over-UPI guidelines publish, add a `UPIProvider` implementing
  the same `initiate`/`complete` shape (likely no OTP step on our side).
* **Account Aggregator** — once EPFO goes live as a FIP (requires a government
  notification), an `AAProvider` via a TSP (Setu/Finvu) replaces the
  aggregator as the preferred path; `initiate`/`complete` maps onto AA's
  consent-handle flow.

Either way, **only `lib/providers/` should change** — product code, routes,
and UI stay untouched. Add a `FailoverProvider` wrapper only when a second
real provider exists.

## Testing

```bash
npm run test:unit    # vitest: validation, provider error mapping, normalization, rate limit
npm run test:e2e     # Playwright against MockProvider, 360px mobile viewport
```

The E2E suite covers the full happy path (zero console errors), every error
screen, OTP failure/lockout paths, the chart→table fallback, zero-balance
rendering, client-storage/URL hygiene, and consent logging. In environments
with a pre-installed Chromium, point Playwright at it:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e
```

## Project structure

See §8 of the product spec — the tree maps 1:1: `app/` (pages + route
handlers), `lib/providers/` (the swappable data layer), `lib/` (session,
consent, validation, rate limit, formatting, strings), `components/`
(dashboard + flow UI), `tests/` (unit + E2E).
