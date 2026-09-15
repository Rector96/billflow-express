# JTB TIN Retrieval & Document Generator

**Branch:** `feature/rockpay-pricing`  
**Status:** L1 demo UI only (`TIN_DEMO_MODE` / `DOC_DEMO_MODE` = true)

## Routes

| Path | Component |
|------|-----------|
| `/tin` | `src/components/app/tin-jtb-flow.tsx` |
| `/documents` | `src/components/app/documents-flow.tsx` |

## Flow A — TIN (₦1,500 demo fee)

1. **Input** — NIN or CAC number + full name  
2. **Preview & pay** — blurred TIN + payment summary  
3. **Success** — full demo TIN, copy, download receipt  

No JTB/FIRS API yet.

## Flow B — Documents (₦3,000 demo fee)

1. **Type** — Business Constitution | Residential Tenancy  
2. **Form** — parties, address, rent/duration (tenancy)  
3. **Preview & pay** — scrollable draft + fee  
4. **Success** — download (demo `.txt` until PDF engine) + copy link  

## UI system

Same as CAC/NIN: `AppShell`, `PageHeader`, `PayStepper`, `PayActionBar`, `rounded-2xl` cards, demo amber banner.

## Merge note

After adding routes, run `npm run build` so `routeTree.gen.ts` includes `/tin` and `/documents`. Keep demos gated until payment + APIs are real.
