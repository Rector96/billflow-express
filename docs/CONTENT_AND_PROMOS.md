# Where to change brand, onboarding & promos

## 1. App name, logo, tagline
**File:** `src/lib/brand.ts`  
**Logo files:** `public/brand/rockpay-logo.png`, `public/brand/rockpay-mark.png`

## 2. Welcome / onboarding slides (first-time users)
**File:** `src/lib/marketing.ts` → `ONBOARDING_SLIDES`  
**Images:** set `image` to `/marketing/your-file.jpg` or any `https://…` URL  
**UI:** `src/routes/onboarding.tsx` (layout only)

## 3. Home promotion cards
**File:** `src/lib/marketing.ts` → `HOME_PROMOS`  
- `enabled: false` hides a card  
- `ctaTo` + `ctaLabel` for the button  
**UI:** `src/components/app/home-promos.tsx`

## 4. Splash “Loading your experience”
**File:** `src/routes/index.tsx`

## 5. Transaction PIN
- **UI:** `src/routes/setup-pin.tsx`  
- **SQL:** `docs/SQL_TRANSACTION_PIN.sql` in Supabase SQL Editor  
- **Gate:** `node scripts/wire-pin-gate.mjs` then commit AppShell

## 6. Netlify
Production branch: **`feature/rockpay-pricing`** only.
