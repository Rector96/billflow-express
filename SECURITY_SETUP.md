# Security setup (PIN + secure payments)

The app no longer uses client-only demo PIN or unrestricted demo money RPCs.

**Prefer the full external guide:** [EXTERNAL_SUPABASE_SETUP.md](./EXTERNAL_SUPABASE_SETUP.md)

## 1. Apply the database migration (required)

On **your** Supabase project (SQL Editor or `supabase db push`), run **all** migrations in order, especially:

`supabase/migrations/20260814020000_security_pin_and_revoke_demo.sql`

This creates:

- `transaction_pins` (bcrypt hash, failed_attempts, locked_until)
- `set_transaction_pin` / `change_transaction_pin` / `verify_transaction_pin` / `has_transaction_pin`
- `secure_bill_payment` (PIN verified server-side before ledger moves)
- Disables `demo_fund_wallet` / `demo_bill_payment` for authenticated users

If payments or Security PIN fail with “Could not find the function …”, the migration has not been applied yet.

After applying, users must **set a 4-digit transaction PIN** under **Profile → Security** before paying bills.

## 2. Host environment variables

### Client (build-time / Vite)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID` (optional)

### Server (Netlify / Node SSR)

- `SUPABASE_URL` (same project URL)
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose to the client)
- `PAYSTACK_SECRET_KEY` (server only, `sk_test_...`)

Server functions (PIN set/change, Paystack) read `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` from the process environment. If only `VITE_*` are set, Security page PIN actions will fail on the server.

On Netlify: **Site settings → Environment variables** — set both the `VITE_*` and the non-prefixed server keys.

## 3. Netlify SSR

`vite.config.ts` switches Nitro to the `netlify` preset when `NETLIFY=true`.
`netlify.toml` rewrites all routes to `/.netlify/functions/server` so deep links and refreshes work.

## 4. Smoke test

1. Sign up / log in
2. Open **Security** → set a 4-digit PIN
3. Fund wallet via **Paystack** (demo fund is disabled)
4. Pay a bill and enter the PIN — should succeed only with the correct PIN
5. Wrong PIN five times → 15-minute lockout
