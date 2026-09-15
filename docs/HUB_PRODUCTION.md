# Hub production wiring and launch rules

This document records the production boundary for the Rockwavehub service hub.
It is intentionally explicit so another developer can continue the work without
mistaking a UI/demo implementation for a real customer-fulfillment integration.

## Current launch rule

A service is customer-payable only when all three conditions are true:

1. A real provider or legitimate internal fulfillment path is configured.
2. Payment is verified server-side before fulfillment.
3. The customer receives the promised result/document/order from that fulfillment path.

A price in `pricing_rules` does **not** make a service available by itself.

## Current service status

| Service | Status | Reason |
|---|---|---|
| Airtime | AVAILABLE | VTpass production path |
| Data | AVAILABLE | VTpass production path |
| Electricity | AVAILABLE | VTpass production path + settlement |
| Cable | AVAILABLE | VTpass production path + settlement |
| Exam PINs | CONTROLLED | Depends on the selected VTpass product |
| CAC | COMING_SOON | No production CAC filing/status connection |
| NIN | COMING_SOON | No authorized NIN fulfillment provider connected |
| TIN | COMING_SOON | Dojah/TIN provider access not configured |
| Vehicle | COMING_SOON | Verified registry/issuance provider access not configured |
| Documents | COMING_SOON | Secure payment + real PDF delivery path still being finalized |

`src/lib/product-mode.ts` is the central payment gate. A service that is not in
`LIVE_BILL_SLUGS` must not accept customer payment.

## Environment (Netlify)

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | Build + runtime | Browser Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build + runtime | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Trusted server writes |
| `SUPABASE_URL` | Server | Service client |
| `VITE_PAYSTACK_PUBLIC_KEY` | Build | Paystack checkout |
| `PAYSTACK_SECRET_KEY` | **Server only** | Verify charges |
| `DOJAH_SECRET_KEY` | **Server only** | KYC / TIN / vehicle |
| `DOJAH_APP_ID` | **Server only** | Dojah AppId header |
| `DOJAH_MODE` | Server | `sandbox` or `live` |
| `HUB_ALLOW_UNVERIFIED_PAY` | Server | Local UI tests only; must be false/unset in production |

## Provider rules

### TIN

- CAC/RC company TIN lookup is supported by the existing Dojah integration.
- Individual NIN→TIN is not assumed to be the same provider product.
- **Without verified provider access, TIN retrieval is unavailable.**
- No locally generated TIN is ever valid customer output.

### Vehicle

- Vehicle verification uses the existing Dojah integration when configured.
- **Without verified provider access, vehicle verification is unavailable.**
- No synthetic make/model/chassis/colour/expiry data is returned to customers.
- Renewal, sticker issuance and insurance delivery require their own authorized
  fulfillment path before those products can be marked live.

### NIN

- NIN retrieval/slip/card services require an authorized provider and a real
  fulfillment workflow.
- Until that connection exists, the route is intentionally read-only/coming-soon.
- A successful Paystack popup alone is never treated as NIN fulfillment.

### CAC

- The current Business Name UI is retained for development.
- It is not a real CAC filing connection and therefore remains unavailable for
  customer payment until submission/status handling is connected.

### Documents

- Document generation is a legitimate non-government service.
- The service becomes payable only after server-side Paystack verification and
  actual PDF generation/delivery are complete.
- A demo text file or browser-only preview is not considered fulfillment.

## Server functions

`src/lib/hub.functions.ts` contains the server-side boundary:

- `getHubServiceFee` — reads the shared `pricing_rules` schema and falls back to
  `SERVICE_PRICES` only when no active fixed/selling price is configured.
- `recoverTin` — requires a configured verified TIN provider before payment and
  fulfillment; never fabricates a TIN.
- `verifyVehicle` — requires a configured verified vehicle provider; never
  fabricates registry information.
- `completeVehicleRenewal` — currently records a paid order only and must not be
  advertised as government issuance until the authorized fulfillment provider is
  connected.
- `recordHubPayment` — server-verifies Paystack before recording a hub order.

## Payment safety

- Never put `DOJAH_SECRET_KEY` or `PAYSTACK_SECRET_KEY` in `VITE_*` variables.
- Never trust the amount supplied by the browser as the final financial authority.
- Verify Paystack on the server before recording a paid hub order.
- Do not use a provider fallback when the primary provider returned an ambiguous
  outcome. Requery first; only a definitive failure can permit failover.
- Keep `HUB_ALLOW_UNVERIFIED_PAY` disabled in every deployed environment.

## Change history note

The September 2026 hardening pass removed customer-facing synthetic government
results, added route-level availability gates, restricted hub order inserts to
trusted server code, and enabled CI verification on the feature and main branches.
