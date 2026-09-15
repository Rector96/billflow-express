# Merging `feature/rockpay-pricing` → `main`

Use this when promoting work so **one uniform RockPay** ships (no parallel UIs or half-demo paths).

## Principles

1. **One design system** — same AppShell, PayStepper, cards, primary buttons, Plus Jakarta / existing tokens. New flows (`/cac`, `/nin`) already follow bill-pay patterns.
2. **Demos stay gated** — `CAC_DEMO_MODE` and `NIN_DEMO_MODE` must remain `true` until backend is live. Never present demo as paid production on `main` without the flag.
3. **No second pricing engine** — keep `pricing.server.ts` + admin rules; don’t reintroduce mock package prices as the live data path.
4. **Route tree** — after merge, run `npm run build` (or TanStack generate) so `/cac` and `/nin` exist in `routeTree.gen.ts`.
5. **Netlify** — point production at the branch you merged; env: `VTPASS_MODE=live`, real keys only on production context.

## Safe merge checklist

- [ ] `npm run build` passes on feature branch
- [ ] `npx tsc --noEmit` clean (or known accepted debt listed in PR)
- [ ] No `PLACEHOLDER` files in bill/education flows
- [ ] Special tiles: Services/Home route `cac` → `/cac`, `nin` → `/nin` (not `/pay/cac`)
- [ ] Docs: `docs/PLATFORM.md` still accurate
- [ ] PR description lists: VTU changes vs L1 demos (CAC/NIN)
- [ ] Prefer **merge commit or squash** into `main`; avoid force-push to `main`

## After merge

1. Deploy `main` (or production branch) on Netlify  
2. Smoke: airtime face-value, one data buy, wallet fund, `/cac` demo banner, `/nin` demo banner  
3. Continue feature work on `feature/rockpay-pricing` (or a new branch from updated `main`)

## Do not merge if

- Bill success UI shows success while DB stays `pending`  
- Accidental submodule / nested `.git` under `billflow-express`  
- Broad unrelated rewrites mixed with pricing/payment without review  

---

**Owner branch for ongoing work:** `feature/rockpay-pricing`  
**Source of product truth:** `docs/PLATFORM.md`
