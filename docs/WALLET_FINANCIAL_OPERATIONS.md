# Wallet & Financial Operations Controls

## Current controls

- Wallet funding starts as a pending `deposit` ledger row.
- Funding references are unique.
- Paystack completion is service-role only.
- Successful funding verifies currency, amount, and reference before crediting.
- Wallet row locking prevents concurrent double-crediting.
- Replayed successful funding returns the existing result without another credit.
- Paystack webhooks validate the raw-body HMAC SHA-512 signature.
- Webhook events are re-verified with Paystack before settlement.
- Failed/pending settlement never changes the wallet balance.
- Admin funding search is server-side and paginated.
- Wallet reconciliation is read-only and reports ledger/balance anomalies.
- Manual wallet balance editing is intentionally not exposed to staff.

## Reconciliation signals

The admin reconciliation surface checks:

1. Current wallet balance against the latest successful ledger `balance_after`.
2. Successful ledger `balance_before` against the preceding successful `balance_after`.
3. Successful deposit amount against its balance delta.
4. Paystack funding records that remain pending for more than 30 minutes.

## Operational rule

Do not correct an anomaly by directly editing `wallets.balance` or a historical ledger row. Investigate the transaction chain first. Any future financial adjustment must be implemented as a new, auditable ledger operation with explicit authorization.

## Pre-production verification

- Apply migrations in order on the test Supabase project.
- Confirm `admin_wallet_funding_queue` is executable by staff and denied to anonymous users.
- Confirm `admin_wallet_reconciliation` is executable by staff and denied to anonymous users.
- Test one successful Paystack funding and replay the callback/webhook; balance must increase once.
- Test amount/reference/currency mismatch; balance must not increase.
- Test a stale pending funding and confirm it appears in reconciliation.
- Confirm an ordinary admin/support account cannot mutate wallet balances.
- Run the existing application build and admin smoke tests before any merge to `main`.
