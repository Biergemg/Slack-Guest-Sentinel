# Slack Guest Sentinel

Slack charges for every **Multi-Channel Guest** seat — whether they're active or not. Single-channel guests are free, but Multi-channel guests cost the same as a regular employee. Slack Guest Sentinel automatically detects inactive guests in your workspace and alerts admins via DM so you can act before the next billing cycle.

## How it works

1. Admin installs the app via Slack OAuth
2. Onboarding scan shows estimated monthly waste from inactive guests
3. Admin starts a 7-day free trial via Stripe
4. A daily audit runs at midnight UTC, scoring each guest for inactivity
5. Inactive guests trigger a DM alert with **Deactivate** / **Ignore** buttons
6. Dashboard shows flagged guests and audit history

### Inactivity scoring

Each guest receives a score from three signals evaluated cheapest-first:

| Signal | Points | Cost |
|---|---|---|
| Profile updated within 30 days | +1.0 | Free — from `users.list` |
| Currently presence-active | +0.5 | Cheap — 1 API call |
| Sent a message within 30 days | +3.0 | Expensive — 1–3 API calls |

Score < 1.0 → flagged as inactive. Evaluation short-circuits as soon as the threshold is reached to minimize API calls. Presence alone (0.5) is not enough to mark a guest active — they need a profile update or a real message.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 (strict) |
| Database | Supabase (PostgreSQL + RLS) |
| Billing | Stripe (Checkout + Webhooks) |
| Styling | Tailwind CSS 4 |
| Deployment | Vercel |

---

## Project structure

```
slack-guest-sentinel/
├── app/
│   ├── api/
│   │   ├── slack/
│   │   │   ├── install/route.ts          # OAuth initiation + CSRF state cookie
│   │   │   ├── callback/route.ts         # OAuth callback, workspace setup, session cookie
│   │   │   ├── events/route.ts           # Slack Event API receiver
│   │   │   ├── action/route.ts           # Block Kit button handler
│   │   │   └── onboarding-scan/route.ts  # Fast guest scan for onboarding page
│   │   ├── stripe/
│   │   │   ├── checkout/route.ts         # Creates Stripe Checkout session
│   │   │   ├── portal/route.ts           # Creates Stripe Customer Portal session
│   │   │   └── webhook/route.ts          # Processes Stripe webhooks (idempotent)
│   │   └── internal/
│   │       └── audit/route.ts            # Daily cron endpoint (Vercel Cron)
│   ├── dashboard/page.tsx                # Authenticated dashboard
│   ├── onboarding/page.tsx               # Post-OAuth onboarding flow
│   ├── page.tsx                          # Landing page
│   ├── error.tsx                         # Global error boundary
│   ├── not-found.tsx                     # 404 page
│   └── loading.tsx                       # Global loading state
│
├── services/                             # Business logic (pure TS, no HTTP)
│   ├── audit.service.ts                  # Guest scoring, flagging, DM alerts
│   ├── subscription.service.ts           # Stripe subscription state machine
│   ├── slack-event.service.ts            # Slack event dispatching
│   └── slack-action.service.ts           # Block Kit button handlers
│
├── components/
│   ├── dashboard/
│   │   ├── stats-row.tsx                 # Metrics grid
│   │   ├── flagged-guests-table.tsx      # Inactive guests table
│   │   └── empty-state.tsx              # No-data placeholder
│   └── ui/
│       ├── spinner.tsx
│       ├── stat-card.tsx
│       └── badge.tsx
│
├── lib/
│   ├── env.ts                            # Validated env vars (lazy getters)
│   ├── db.ts                             # Supabase client (Service Role)
│   ├── encryption.ts                     # AES-256-GCM token encryption
│   ├── logger.ts                         # Structured JSON logging
│   ├── slack.ts                          # Slack API client + signature verification
│   └── stripe.ts                         # Stripe client
│
├── config/constants.ts                   # All magic numbers and string enums
├── types/
│   ├── database.types.ts                 # Supabase table interfaces
│   ├── slack.types.ts                    # Slack API response types
│   └── api.types.ts                      # Route request/response types
│
├── supabase/migrations/                  # Database schema
├── middleware.ts                          # Protects /dashboard with encrypted session cookie
├── slack_manifest.json                   # Slack app manifest
└── vercel.json                           # Cron job schedule
```

---

## Getting started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- A [Slack app](https://api.slack.com/apps) (see manifest below)
- A [Stripe](https://stripe.com) account with a recurring price

### 1. Clone and install

```bash
git clone https://github.com/Biergemg/Slack-Guest-Sentinel.git
cd slack-guest-sentinel
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in every value in `.env.local`. See [Environment variables](#environment-variables) for details.

### 3. Set up the database

Run the migration against your Supabase project:

```bash
# Via Supabase CLI
supabase db push

# Or paste supabase/migrations/*.sql directly in the Supabase SQL editor
```

### 4. Configure the Slack app

Import `slack_manifest.json` in your Slack app settings and update the URLs to match your deployment URL or local tunnel.

Required OAuth scopes (user token):
- `users:read` — fetch guest list
- `chat:write` — send DM alerts
- `im:write` — open DM channels
- `channels:read` — inspect guest channel memberships for activity checks
- `channels:history` — verify recent guest message activity

Enable **Interactivity** and set the request URL to `/api/slack/action`.
Enable **Event Subscriptions** and set the request URL to `/api/slack/events`.
If your app was installed before adding new scopes, reinstall it so Slack issues a token with the updated permissions.

### 5. Run locally

```bash
npm run dev
```

For Slack webhooks you'll need a public tunnel (e.g. [localtunnel](https://theboroer.github.io/localtunnel-www/) or [ngrok](https://ngrok.com)).

---

## Environment variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role key (server-only, never expose to browser) |
| `SLACK_CLIENT_ID` | From Slack app Basic Information |
| `SLACK_CLIENT_SECRET` | From Slack app Basic Information |
| `SLACK_SIGNING_SECRET` | From Slack app Basic Information — used to verify webhook signatures |
| `STRIPE_SECRET_KEY` | `sk_test_...` or `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | From Stripe Dashboard → Webhooks → Signing secret |
| `STRIPE_PRICE_STARTER` | Recurring price ID for the Starter plan (`price_...`) |
| `STRIPE_PRICE_GROWTH` | Recurring price ID for the Growth plan (`price_...`) |
| `STRIPE_PRICE_SCALE` | Recurring price ID for the Scale plan (`price_...`) |
| `NEXT_PUBLIC_APP_URL` | Public URL of this app (`https://your-domain.com`) |
| `ENCRYPTION_KEY` | Exactly 32 bytes for AES-256-GCM — generate: `openssl rand -hex 32` |
| `CRON_SECRET` | Bearer token for the internal audit endpoint — generate: `openssl rand -hex 32` |

---

## Database schema

Seven tables, all with RLS enabled (service role access only):

| Table | Purpose |
|---|---|
| `workspaces` | Installed Slack workspaces (encrypted tokens) |
| `subscriptions` | Stripe subscription per workspace |
| `guest_audits` | Flagged inactive guests + action taken |
| `guest_sponsors` | Who invited each guest (captured from Slack events) |
| `audit_runs` | Snapshot per audit run (guest count, waste estimate) |
| `events` | Audit trail of all workspace events |
| `stripe_events_history` | Idempotency log for Stripe webhooks |

---

## API reference

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/api/slack/install` | — | Start OAuth flow |
| `GET` | `/api/slack/callback` | CSRF state cookie | Complete OAuth, set session |
| `GET` | `/api/slack/onboarding-scan` | Session cookie | Quick inactive guest estimate |
| `POST` | `/api/slack/events` | Slack signature | Receive Slack event webhooks |
| `POST` | `/api/slack/action` | Slack signature | Receive Block Kit button clicks |
| `POST` | `/api/stripe/checkout` | Session cookie | Create Stripe Checkout session |
| `POST` | `/api/stripe/portal` | Session cookie | Create Stripe Customer Portal session |
| `POST` | `/api/stripe/webhook` | Stripe signature | Process Stripe billing events |
| `GET` / `POST` | `/api/internal/audit` | Bearer `CRON_SECRET` | Run full workspace audit |

---

## Security

- **Slack signature verification** — every inbound Slack request is verified with HMAC-SHA256 and a constant-time comparison to prevent timing attacks.
- **CSRF protection** — OAuth install generates a random `state` stored in an HttpOnly cookie; callback rejects mismatches.
- **AES-256-GCM encryption** — Slack OAuth tokens are encrypted before storage. GCM provides both confidentiality and integrity (prevents padding oracle attacks).
- **Idempotent webhooks** — Stripe events use explicit processing states (`processing` / `processed` / `failed`) with `409 Conflict` for in-flight events, avoiding duplicate execution and safely recovering from retries.
- **Encrypted session cookies** — the workspace ID is encrypted with AES-256-GCM before being stored in the session cookie. Middleware decrypts and validates on every `/dashboard` request, rejecting tampered cookies.
- **Fail-fast env validation** — missing or malformed environment variables throw at first access with a clear error message, not deep in a handler.
- **Service Role isolation** — the Supabase client uses the Service Role key server-side only; RLS blocks all anonymous access.

---

## Architecture decisions

**Services layer** — route handlers are thin controllers (~20-40 lines). All business logic lives in `services/`, making it testable without the Next.js runtime.

**Lazy env getters** — `lib/env.ts` uses JavaScript getters so validation fires at request time, not during `next build`. The build works even when development env vars are incomplete.

**Batch operations** — the audit service batches DB upserts per workspace (not per guest) and processes workspaces in parallel groups of 5, keeping the daily cron fast even at scale.

**Structured logging** — all operations emit JSON logs in production (compatible with Datadog, Logtail, etc.) and human-readable output in development.

---

## Scripts

```bash
npm run dev          # Development server (Turbopack)
npm run build        # Production build
npm run start        # Production server
npm run type-check   # TypeScript check (no emit)
npm run lint         # ESLint (flat config)
npm run validate     # type-check + lint
```

---

## Deployment (Vercel)

1. Import the repository in Vercel.
2. Add all environment variables from `.env.example`.
3. The daily audit cron is configured in `vercel.json` and runs at `0 0 * * *` (midnight UTC).
4. Set the Stripe webhook endpoint to `https://your-domain.com/api/stripe/webhook`.

---

## License

ISC
