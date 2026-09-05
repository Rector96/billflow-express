# Notes: Gemini / main integrate (2026-09-05)

## What landed on `main` (`5d286f6`)

- Docs: VTUAFRICA, ADMIN_OWNER_GUIDE, SUPABASE_SETUP
- Legal routes + setup-pin + receipt share (already on feature, often stronger)
- Migrations (already present on feature lineage)
- **VTpass live mode enabled in code** on main

## What we did on `feature/rockpay-pricing`

**Taken (safe):**
- `docs/VTUAFRICA.md`
- `docs/ADMIN_OWNER_GUIDE.md`
- `docs/SUPABASE_SETUP.sql`

**Not taken (would break or weaken platform):**
- VTpass live unlock (feature keeps sandbox lock until intentional go-live)
- Overwriting `setup-pin.tsx` / `pay-flow.tsx` (main removes auto-scroll PIN UX)
- Blind merge of `main` into feature

## Single product branch

`feature/rockpay-pricing` only. Netlify must track this branch.
