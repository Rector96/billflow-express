# Direct bill pay (Paystack → VTpass)

**Flags:** `src/lib/product-mode.ts` — `DIRECT_PAY` + `BILLS_FOCUS`

## Flow
1. User confirms electricity/cable amount
2. `initializeDirectBillPay` creates bill order (no wallet debit) + Paystack session
3. User pays on Paystack
4. Return to `/pay/complete?reference=DIR-...`
5. `verifyAndFulfillDirectBill` verifies Paystack then calls VTpass

## Migration
Apply `supabase/migrations/20260905050000_direct_bill_paystack.sql` on Supabase.

## Reverse
`DIRECT_PAY = false` → wallet + PIN path again for bills.
