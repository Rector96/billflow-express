# RockPay — QA test checklist

**Repo:** `Rector96/billflow-express`  
**Branch:** `rockPay-pricing`

Use after Netlify redeploys this branch.

## Before testing

1. **Netlify** production branch = `rockPay-pricing` (or branch deploy).
2. **Env:** `VITE_SUPABASE_*`, `SUPABASE_*`, `PAYSTACK_SECRET_KEY` (test), `VTPASS_*`.
3. **super_admin** via Supabase SQL on `user_roles`.
4. Redeploy after env/branch change.

## Smoke tests

| Area | Expected |
|------|----------|
| Fund wallet | ₦500–20k chips; Paystack; credit after verify |
| `/support` | FAQ + open ticket |
| `/admin/care/$id` | Quick replies send + status |
| Airtime/data | VTpass when keys set |
| `/admin` | Loads for staff only |
