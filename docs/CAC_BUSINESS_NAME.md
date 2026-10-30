# CAC Business Name (RockPay) — product & engineering reference

**Status:** Manual-assisted CAC Business Name processing with verified Paystack checkout  
**Package price:** ₦27,500 — "Start Business" (Business Name)  
**Route:** `/cac`  
**Primary component:** `src/components/app/cac-registration-flow.tsx`  
**Route file:** `src/routes/cac.tsx`

## Why this product exists

RockPay is expanding beyond VTU into high-ticket assisted services.

| Decision      | Choice                                                                             |
| ------------- | ---------------------------------------------------------------------------------- |
| First product | **CAC Business Name** (not Ltd first)                                              |
| User price    | **₦27,500**                                                                        |
| TIN           | Later — after CAC exists                                                           |
| Fulfillment   | RockPay operations team manually submits applications and delivers the certificate |

## User flow

```
intro → names → business → proprietor → documents → review → pay → success
```

## Fields (Business Name MVP)

- Names: 1–3 preferred names
- Business: nature, street, city, LGA, state, phone, email, start date
- Proprietor: full name, gender, DOB, nationality, occupation, NIN, ID type/number, phone, email, residential address
- Documents: private ID image/PDF, passport photo, uploaded PNG signature

## Code map

| Path                                           | Role                        |
| ---------------------------------------------- | --------------------------- |
| `src/components/app/cac-registration-flow.tsx` | Customer application wizard |
| `src/routes/cac.tsx`                           | Route `/cac`                |
| `src/lib/mock-data.ts`                         | Service slug `cac`          |
| `src/lib/product-mode.ts`                      | Visibility / home           |
| `docs/CAC_BUSINESS_NAME.md`                    | This reference              |

## Manual fulfillment

- Customer completes the full application and uploads ID, passport photo and signature.
- Files are stored in the private `cac-applications` Supabase Storage bucket under the authenticated user ID.
- The server validates the upload paths, MIME types and size before creating a payment intent.
- Paystack is verified server-side; the webhook and checkout confirmation use the same idempotent finalization RPC.
- Staff review the complete application in `/admin/hub-orders`. Staff-only signed file links expire after five minutes.
- Staff manually submit the application through the authorized CAC process, then attach the resulting certificate or arrange print-and-delivery.
- No CAC API integration is claimed. Live checkout is only appropriate while RockPay has staff capacity and a real manual fulfillment process.

Apply `supabase/migrations/20261030240000_cac_private_application_documents.sql` before enabling the new upload workflow.
