# RockPay — production go-live checklist

Branch: `feature/rockpay-pricing`  
Goal: real money only on **live bill** rails; hub services stay gated until ops + APIs are ready.

## What is live today (money path)

| Service | Status |
|---------|--------|
| Airtime, Data, Electricity, Cable | **Live** (`LIVE_BILL_SLUGS`) via VTpass + wallet/Paystack |
| CAC, NIN, TIN, Documents, Vehicle | **Not live fulfillment** — UI demo only when hub preview is on |
| Education / Exam pins | Preview / catalogue — confirm VTpass before promoting |

## Netlify environment (production site)

### Required
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- `PAYSTACK_SECRET_KEY` (live `sk_live_…` only when taking real funds)
- `VITE_PAYSTACK_PUBLIC_KEY` (`pk_live_…`)
- `VTPASS_API_KEY` / `VTPASS_SECRET_KEY` / `VTPASS_PUBLIC_KEY`
- `VTPASS_MODE=live` only after sandbox matrix passes

### Recommended for production customers
```
VITE_HUB_PREVIEW_FLOWS=false
HUB_PREVIEW_FLOWS=false
HUB_ALLOW_UNVERIFIED_PAY=false
VTPASS_MODE=live   # only when ready
```

With preview **false**, hub tiles show **Soon** and server rejects demo hub fulfillment.  
Live bills (airtime/data/power/cable) keep working.

### Staging / internal QA
```
VITE_HUB_PREVIEW_FLOWS=true
HUB_PREVIEW_FLOWS=true
# optional for pure UX without Paystack:
# HUB_ALLOW_UNVERIFIED_PAY=true
```

## Ops (staff)

1. Staff roles in `user_roles`: `admin`, `super_admin`, or `support`
2. **Hub orders** `/admin/hub-orders` — process CAC/NIN/vehicle rows
3. **Dispatch** `/admin/dispatch` — physical stickers / NIN cards
4. Attach `https://` document URL → customer **Profile → My documents**
5. Status changes notify the customer in **Notifications**

## Pre-launch tests (bills)

- [ ] Airtime face value (₦100 → ₦100 on phone)
- [ ] Data plan amount matches checkout total
- [ ] Electricity token on success + history status matches
- [ ] Pending stays pending until VTpass requery succeeds (no false success)
- [ ] Wallet debit only after successful provider path / policy
- [ ] Paystack fund wallet + webhook

## Pre-launch tests (hub, staging only)

- [ ] CAC pay creates `hub_orders` row + staff notification
- [ ] Admin attach link → My documents download
- [ ] Vehicle sticker pending → Dispatch queue

## Do not on production

- Do not set `HUB_ALLOW_UNVERIFIED_PAY=true`
- Do not put CAC/NIN into `LIVE_BILL_SLUGS` until a real provider + ops SLA exist
- Do not treat demo TIN/CAC results as official government output

## Promote a hub service to live (later)

1. Real provider credentials + contract
2. Server fulfillment without demo branches
3. Add slug to `LIVE_BILL_SLUGS` in `product-mode.ts`
4. Keep `VITE_HUB_PREVIEW_FLOWS=false` for other unfinished services
5. Ops runbook for SLA and refunds
