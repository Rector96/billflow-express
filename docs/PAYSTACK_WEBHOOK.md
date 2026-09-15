# Paystack webhook (RockPay)

## Endpoint (this repo)

```
POST https://<your-netlify-domain>/api/public/webhooks/paystack
```

Implemented in:

`src/routes/api/public/webhooks/paystack.ts`

This is **TanStack Start**, not Next.js. There is no `src/app/api/.../route.ts`.

## Paystack Dashboard setup

1. Paystack → Settings → API Keys & Webhooks
2. Webhook URL = the URL above (must be HTTPS)
3. Use the **same** secret as `PAYSTACK_SECRET_KEY` on Netlify (`sk_test_...` for now)

## What it does

1. Reads **raw body** + header `x-paystack-signature`
2. Validates **HMAC SHA-512** with `PAYSTACK_SECRET_KEY` (timing-safe)
3. On supported events:
   - **Wallet funding** → existing `verifyAndSettle` (never double-credits)
   - **`charge.success` hub metadata** → insert into `public.hub_orders` (idempotent on `payment_reference`)

## Hub metadata expected from Inline checkout

Pass when opening Paystack (already done in hub flows via `simulatePaystackInline` / `openPaystackInline`):

```json
{
  "service": "vehicle_license_sticker",
  "plate": "ABC123XY",
  "user_id": "<supabase-auth-uuid>"
}
```

or `service_type`, `plate_number`, `channel: "hub"`.

If `user_id` is missing, webhook tries to resolve the user from `customer.email` → `profiles`.

## Netlify logs

Search for:

- `[paystack-webhook] received`
- `[paystack-webhook] event`
- `[paystack-webhook] hub_orders inserted`
- `[paystack-webhook] invalid signature`

## Test

1. Set `PAYSTACK_SECRET_KEY=sk_test_...` and `VITE_PAYSTACK_PUBLIC_KEY=pk_test_...`
2. Redeploy `feature/rockpay-pricing`
3. Complete a test charge with hub metadata
4. Confirm row in Supabase `hub_orders`
