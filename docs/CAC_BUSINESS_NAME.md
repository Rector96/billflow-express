# CAC Business Name (RockPay) — product & engineering reference

**Status:** Demo UI only (`CAC_DEMO_MODE = true`)  
**Package price:** ₦27,500 — "Start Business" (Business Name)  
**Route:** `/cac`  
**Primary component:** `src/components/app/cac-registration-flow.tsx`  
**Route file:** `src/routes/cac.tsx`

## Why this product exists

RockPay is expanding beyond VTU into high-ticket assisted services.

| Decision | Choice |
|----------|--------|
| First product | **CAC Business Name** (not Ltd first) |
| User price | **₦27,500** |
| TIN | Later — after CAC exists |
| Automation | No public CAC register API; assisted demo until connected |

## User flow

```
intro → names → business → proprietor → documents → review → pay → success
```

## Fields (Business Name MVP)

- Names: 1–3 preferred names
- Business: nature, street, city, LGA, state, phone, email, start date
- Proprietor: full name, gender, DOB, nationality, occupation, NIN, ID type/number, phone, email, residential address
- Documents: ID image, passport photo, canvas signature

## Code map

| Path | Role |
|------|------|
| `src/components/app/cac-registration-flow.tsx` | Demo wizard |
| `src/routes/cac.tsx` | Route `/cac` |
| `src/lib/mock-data.ts` | Service slug `cac` |
| `src/lib/product-mode.ts` | Visibility / home |
| `docs/CAC_BUSINESS_NAME.md` | This reference |

## Going live (remaining)

1. Persist applications + file storage
2. Wallet / transfer payment
3. Admin queue + certificate upload
4. Email / notifications
5. User download when ready
6. Optional partner CAC APIs

Keep `CAC_DEMO_MODE = true` until then.
