# Product mode (reversible)

**File:** `src/lib/product-mode.ts`

| Flag | Effect |
|------|--------|
| `BILLS_FOCUS = true` | Home + Services prioritise electricity / cable / education. Airtime & data hidden. Wallet CTA → **Pay a bill**. Fintech look kept. |
| `BILLS_FOCUS = false` | Classic RockPay: airtime, data, Fund Wallet. **Full reverse.** |

Backend wallet debit + VTpass purchase paths are **unchanged**. Flip the flag and redeploy.

Next (optional): Paystack amount = bill total, then VTpass — true no-float checkout — without redesigning screens.
