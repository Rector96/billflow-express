# Branch policy (RockPay / BillFlow)

## Active branch (use this only)

**`feature/rockpay-pricing`**

- All product work, UI/UX, VTpass bills, optional VTUAfrica, PIN setup
- Netlify production / preview should track **this branch**
- Do not open PRs from Google AI Studio / Gemini into other pricing branches

## Do not use for day-to-day work

| Branch | Status |
|--------|--------|
| `rockPay-pricing` | Legacy name (capital P). Content was force-aligned into `feature/rockpay-pricing`. Do not deploy or develop here. |
| `rockpay-pricing-v2` | Older experiments. Ignore unless recovering a specific commit. |

## Providers

- **VTpass** — primary. Required in Netlify env.
- **VTUAfrica** — optional. Leave `VTUAFRICA_API_KEY` empty until subscribed. Code is ready; no calls without the key.

## Before `main`

1. Ship and test on `feature/rockpay-pricing` only
2. Smoke: signup → PIN → airtime, data, electricity, cable, education/exam
3. Then open a PR **into `main`** from `feature/rockpay-pricing` only
