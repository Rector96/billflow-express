# Live VTpass catalogue (data + exam PINs)

## Why you still see fake prices (e.g. ₦500 mock data)

On **`feature/rockpay-pricing`** the bill flow already loads plans from VTpass:

- Data/cable packages → `listVtpassVariations` → `vtpassListVariations`
- Exam PINs → `listExamCatalog` → same VTpass service-variations API

If the **deployed site** still shows old mock figures:

1. **Netlify is building the wrong branch** (often `main`, which lags this branch).
2. **`VTPASS_MODE` is not exactly `live`** (typos / wrong URL host).
3. **Live keys** do not match live URL (`vtpass.com` vs `sandbox.vtpass.com`).
4. **Product not enabled** on the VTpass dashboard (WAEC/NECO/NABTEB etc.).

## Netlify checklist (phone-friendly)

1. Site settings → **Build** → Production branch = `feature/rockpay-pricing` **or** merge this branch into `main` and deploy `main`.
2. Environment variables (Production):
   - `VTPASS_MODE` = `live`
   - `VTPASS_BASE_URL` = `https://vtpass.com/api` (or leave empty so code defaults correctly)
   - `VTPASS_API_KEY` / `VTPASS_SECRET_KEY` / `VTPASS_PUBLIC_KEY` = **live** keys
3. Trigger **Clear cache and deploy site**.
4. Log into the app → Data → MTN → plans should match VTpass portal amounts.
5. Education / Exam Pins → WAEC → product list from VTpass (not hard-coded).

## Quantity + PIN products (exam style)

Same pattern as VTpass agents:

1. Pick product (unit price from VTpass)
2. Choose **quantity** (1–10)
3. See **unit × qty = total** before PIN
4. Confirm → transaction PIN → provider
5. Success: PIN list, **copy each / copy all**, receipt link, email note when profile has email

Implemented in `src/components/app/exam-pins-flow.tsx` + `src/lib/exam.functions.ts`.

## Airtime honesty

Customer amount = face value you type (no +₦15 UI tax). Provider commission stays server-side.

## Merge to main

See `docs/MERGE_WITH_MAIN.md`. Prefer one production branch so catalogue and PIN UX stay uniform.
