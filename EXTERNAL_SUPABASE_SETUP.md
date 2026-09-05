# External Supabase setup (BillFlow Express)

Use your **own Supabase project** instead of Lovable Cloud. This is the recommended path for full control, higher limits, and production readiness.

---

## 1. Create a Supabase project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. **New project** → pick org, name (e.g. `billflow-express`), strong DB password, region close to your users (e.g. `eu-west-1` or `us-east-1`)
3. Wait until the project is **Ready**

---

## 2. Copy API keys

In Supabase: **Project Settings → API**

| What you need          | Where it is                                        | Env var(s)                                                     |
| ---------------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| Project URL            | Project URL                                        | `SUPABASE_URL` and `VITE_SUPABASE_URL`                         |
| Publishable / anon key | `anon` `public` **or** `sb_publishable_...`        | `SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Service role key       | `service_role` **or** `sb_secret_...` — **secret** | `SUPABASE_SERVICE_ROLE_KEY` only (server)                      |
| Project ref            | From URL: `https://<ref>.supabase.co`              | `VITE_SUPABASE_PROJECT_ID` / `SUPABASE_PROJECT_ID` (optional)  |

**Never** put the service role key in client code, Vite env, or public repos.

Legacy keys look like long JWTs (`eyJ...`). Newer keys start with `sb_publishable_` / `sb_secret_`. This app supports both.

---

## 3. Apply all database migrations

Run **in order** in **SQL Editor** (or use the Supabase CLI).

### Option A — SQL Editor (simplest)

Open **SQL Editor → New query**, paste and run each file **one by one**:

1. `supabase/migrations/20260813215553_9f6ef952-6026-4757-9fbe-145b45a30a8a.sql`  
   → enums, profiles, wallets, ledger, bills, saved payments, notifications, tickets, bootstrap, demo RPCs, admin stats

2. `supabase/migrations/20260813215605_e6328aae-d0e6-46a9-bf0b-a851e4076357.sql`  
   → tighten EXECUTE grants

3. `supabase/migrations/20260813222209_0c801c37-9c38-45e1-a0f5-60c4056f3191.sql`  
   → Paystack funding intent + complete/settle RPCs

4. `supabase/migrations/20260814020000_security_pin_and_revoke_demo.sql`  
   → transaction PIN table, PIN RPCs, `secure_bill_payment`, disable demo fund/pay for users

Each should complete without errors. After #4 you should see schema reload (`NOTIFY pgrst`).

### Option B — Supabase CLI

```bash
# Install CLI if needed: https://supabase.com/docs/guides/cli
npm i -g supabase

# Link to your project (project ref from dashboard URL)
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations in supabase/migrations/
supabase db push
```

Update `supabase/config.toml` `project_id` to your ref if you use the CLI.

### Quick verify in SQL Editor

```sql
-- Should return rows for these function names:
SELECT proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'bootstrap_current_user',
    'secure_bill_payment',
    'set_transaction_pin',
    'has_transaction_pin',
    'create_wallet_funding_intent',
    'complete_paystack_funding'
  )
ORDER BY 1;

-- PIN table exists:
SELECT to_regclass('public.transaction_pins');
```

---

## 4. Auth settings (recommended)

**Authentication → Providers → Email**

- Enable Email provider
- For local/dev: you can disable “Confirm email” temporarily so signup works without inbox
- For production: keep email confirmation on and set **URL Configuration**:
  - Site URL: your production URL (e.g. `https://your-app.netlify.app`)
  - Redirect URLs: same + `http://localhost:5173/**` for local dev

**Authentication → URL Configuration** must list every domain where the app runs, or login redirects will fail.

---

## 5. Environment variables

### Local development

Copy `.env.example` → `.env` (never commit `.env`):

```env
# Client (Vite — baked into browser bundle at build time)
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_or_sb_publishable_key
VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT_REF

# Server (TanStack Start / Nitro — runtime only)
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_anon_or_sb_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_or_sb_secret_key
SUPABASE_PROJECT_ID=YOUR_PROJECT_REF

# Paystack TEST secret only (sk_test_...)
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxx
```

Use the **same** URL and publishable key for both `VITE_*` and non-prefixed server vars.

### Netlify (or similar host)

**Site settings → Environment variables** — set **all** of the above (including both `VITE_*` and server keys).

- `VITE_*` are required at **build** time
- `SUPABASE_*` + `PAYSTACK_SECRET_KEY` are required at **runtime** for SSR / server functions (PIN set/change, Paystack)

Redeploy after changing env vars.

### Lovable editor (optional)

If you still open the project in Lovable, set the same env vars in the project’s cloud/env settings so previews talk to **your** Supabase, not Lovable Cloud.

---

## 6. Paystack (wallet funding)

1. [Paystack Dashboard](https://dashboard.paystack.com) → **Settings → API Keys & Webhooks**
2. Copy **Test Secret Key** (`sk_test_...`) into `PAYSTACK_SECRET_KEY`
3. This app **rejects** live keys (`sk_live_...`) by design until you deliberately enable live mode in code
4. Test cards: see Paystack docs (e.g. `4084084084084081`)

Wallet funding flow:

1. User calls **Fund Wallet** → server creates pending ledger row (`create_wallet_funding_intent`)
2. Server initializes Paystack with secret key → user pays on Paystack
3. Return to app → `verifyWalletFunding` → server verifies with Paystack → `complete_paystack_funding` credits wallet

---

## 7. Run the app locally

```bash
git clone https://github.com/Rector96/billflow-express.git
cd billflow-express
cp .env.example .env
# edit .env with your keys

npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

---

## 8. Smoke test checklist

1. **Sign up** with email + password (and phone/name if the form asks)
2. Confirm you land on **Home** with a wallet balance of ₦0 (or after bootstrap)
3. **Profile → Security → Set Transaction PIN** (4 digits)
4. **Wallet → Fund Wallet** → complete Paystack test payment → balance updates
5. **Pay** electricity (or any service) → confirm → enter PIN → success
6. Wrong PIN five times → lockout message (~15 minutes)
7. **History** shows the bill + funding rows

If PIN or pay fails with “Could not find the function…” → migration #4 was not applied.

If Security PIN fails with missing env → set **server** `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` (not only `VITE_*`).

---

## 9. What the schema provides

| Feature                         | Mechanism                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| Profile + wallet on first login | `bootstrap_current_user`                                                                         |
| Bill payment + PIN              | `secure_bill_payment`                                                                            |
| Set / change / verify PIN       | `set_transaction_pin`, `change_transaction_pin`, `verify_transaction_pin`, `has_transaction_pin` |
| Demo fund/pay                   | Disabled for `authenticated` (raises exception); service_role only                               |
| Paystack top-up                 | `create_wallet_funding_intent` + `complete_paystack_funding` / `settle_paystack_funding`         |
| Admin dashboard stats           | `admin_dashboard_stats` (staff roles only)                                                       |

Tables: `profiles`, `wallets`, `wallet_transactions`, `bill_transactions`, `saved_payments`, `notifications`, `support_tickets`, `transaction_pins`, `user_roles`.

All money-moving RPCs are `SECURITY DEFINER` with tight grants; RLS protects direct table access.

---

## 10. Troubleshooting

| Symptom                                        | Fix                                                           |
| ---------------------------------------------- | ------------------------------------------------------------- |
| `Missing Supabase environment variable(s)`     | Fill `.env` / host env; restart `npm run dev`                 |
| `Could not find the function …` / `PGRST202`   | Re-run migrations; in SQL: `NOTIFY pgrst, 'reload schema';`   |
| Auth redirect wrong host                       | Add URL under Authentication → URL Configuration              |
| PIN works in browser RPC but not Security page | Server missing `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`    |
| Paystack “not configured”                      | Set `PAYSTACK_SECRET_KEY=sk_test_...` on server               |
| CORS / blocked requests                        | Ensure URL is your real project URL; no trailing slash issues |

---

## 11. Security reminders

- Service role key = full DB access. Server only.
- Rotate keys if they ever leak to git or chat.
- Keep demo RPCs revoked for end users (already done in migration #4).
- Production: enable email confirm, strong password policy, and only live Paystack after a deliberate code change.

When this checklist is done, the app is fully on **your** Supabase — no Lovable Cloud dependency for data or auth.
