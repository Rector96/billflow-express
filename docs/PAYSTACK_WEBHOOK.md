# Paystack webhook (RockPay)

## Endpoint

```
POST https://<your-netlify-domain>/api/public/webhooks/paystack
```

Implemented in `src/routes/api/public/webhooks/paystack.ts` (TanStack Start).

## Paystack Dashboard setup

1. Open Paystack → Settings → API Keys & Webhooks.
2. Set the webhook URL to the HTTPS endpoint above.
3. Use the same secret configured as `PAYSTACK_SECRET_KEY` on Netlify.

## Security and processing

1. The handler reads the raw request body.
2. It validates the 128-character hexadecimal `x-paystack-signature` using HMAC SHA-512 and a timing-safe comparison.
3. Wallet references are settled through `verifyAndSettle`, which independently verifies the reference and payment details with Paystack before any wallet credit.
4. Unknown wallet references are acknowledged as non-wallet events. The webhook does **not** create Hub orders from checkout metadata.

## Hub orders

Hub orders must be recorded by the authenticated server functions after they verify the Paystack reference against the expected server-side amount and the signed-in customer's identity.

The webhook deliberately does not create a Hub order from `metadata.user_id`, customer email, service name, or the amount in the webhook payload. Those fields do not constitute a trusted order-intent record. If the customer closes checkout before the authenticated server function records the order, it requires a separate reconciliation flow; it must not be guessed from metadata.

## Netlify logs

Search for:

- `[paystack-webhook] received`
- `[paystack-webhook] event`
- `[paystack-webhook] wallet settlement checked`
- `[paystack-webhook] invalid signature`
- `[paystack-webhook] no wallet funding row`

## Test

1. Use Paystack test keys on the feature branch.
2. Send a valid test wallet payment and confirm one wallet credit.
3. Replay the same signed webhook and confirm the balance does not change.
4. Send a request with a missing or invalid signature and confirm HTTP 401.
5. Confirm Hub orders are still written by their authenticated server functions after successful payment verification.

Do not treat a green CI run as approval to deploy production.
