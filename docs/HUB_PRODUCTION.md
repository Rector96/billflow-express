# Hub production wiring (TIN · Documents · Vehicle)

Stack note: this app is **TanStack Start + Vite**, not Next.js. Server endpoints are `createServerFn` modules under `src/lib/hub.functions.ts` (same role as `/api/v1/*`).

## Environment (Netlify)

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | Build + runtime | Browser Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build + runtime | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Admin writes / verify |
| `SUPABASE_URL` | Server | Service client |
| `VITE_PAYSTACK_PUBLIC_KEY` | Build | Inline popup |
| `PAYSTACK_SECRET_KEY` | **Server only** | Verify charges |
| `DOJAH_SECRET_KEY` | **Server only** | KYC / TIN / vehicle |
| `DOJAH_APP_ID` | **Server only** | Dojah AppId header |
| `DOJAH_MODE` | Server | `sandbox` \| `live` |
| `HUB_ALLOW_UNVERIFIED_PAY` | Server | `true` only for local UI tests |

## Server functions

| Function | Role |
|----------|------|
| `getHubServiceFee` | Reads `pricing_rules` by `service` slug; falls back to `SERVICE_PRICES` |
| `recoverTin` | Verifies Paystack → Dojah CAC TIN → logs `bill_transactions` |
| `verifyVehicle` | Dojah vehicle registry (product must be enabled on Dojah) |
| `recordHubPayment` | Verify Paystack + insert transaction row |

## Client helpers

- `openPaystackInline` (`src/lib/paystack-inline.ts`) — real popup when public key set
- `simulatePaystackInline` — uses real popup if key present, else demo reference
- `useHubPricing` — optional provider for live fee display

## Dojah notes

- TIN: **company** lookup via `GET /api/v1/kyc/cac/tin?rc_number=&company_type=`
- Individual NIN→TIN is **not** the same Dojah product; UI should prefer CAC/RC for live TIN
- Vehicle: `GET /api/v1/kyc/vehicle` — enable the product on Dojah or the API returns a clear error

## Security

- Never put `DOJAH_SECRET_KEY` or `PAYSTACK_SECRET_KEY` in `VITE_*` vars
- Always verify Paystack on the server before fulfilling hub services
