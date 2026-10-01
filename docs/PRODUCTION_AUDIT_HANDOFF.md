# Production Audit Handoff

This file is a handoff note for Grok, future developers, and future audits of the `feature/rockpay-pricing` branch.

## Current rule

Do not merge this branch into `main` until CI is green and the production audit below has been reviewed.

## Services intentionally enabled

- Electricity
- Cable
- Airtime
- Data

These are the current core services with an established provider/payment path.

## Services intentionally held back

- Education / Exam PINs
- CAC
- NIN
- TIN
- Vehicle
- Documents

A route existing in the application does not mean that service is available for customer payment. `src/lib/product-mode.ts` is the centralized availability gate, and `/pay/$slug` applies defense-in-depth for direct URLs.

## Provider safety rule

VTpass is the primary provider. VTUAfrica may only be used after a definitive VTpass provider failure. A timeout, network error, 5xx, or unknown response is ambiguous and must never trigger a second provider request for the same order. Requery/reconciliation must determine the final state first.

## Regulated/identity services

Do not fabricate TIN, NIN, vehicle, CAC, or other regulated records. Dojah-dependent operations must fail closed when Dojah is not configured. Customer payment must not be accepted for a service unless a verified provider or legitimate internal fulfillment path can actually complete it.

## Payment and pricing safety

- Customer-facing amounts are resolved server-side.
- Provider/base cost is the pricing floor.
- Successful transactions are the only transactions eligible for profit recording.
- Unknown provider cost must remain unknown; never invent a profit number.
- Hub order inserts are server-only; customer sessions must not directly insert `hub_orders`.
- Paystack payment verification is server-side before hub payment recording.

## CI verification

The verification workflow runs:

1. dependency installation with the lockfile,
2. deterministic bill-flow hook normalization,
3. Prettier formatting,
4. mechanical formatting commit back to the feature branch when required,
5. tests,
6. production build,
7. ESLint.

The formatting step is mechanical only. It must not be used as a substitute for reviewing business-logic changes.

## Known non-blocking build warnings

The current TanStack Start build reports `createServerFn().inputValidator()` deprecation warnings. These are framework API modernization work, not build failures. They should be migrated deliberately rather than by a broad automated replacement.

Vite also reports that `vite-tsconfig-paths` can eventually be replaced by native `resolve.tsconfigPaths`. Do not make that change in the same payment-safety patch without testing it separately.

## What the next audit should verify

1. CI is green on the latest feature-branch commit.
2. `product-mode.ts` and database `service_availability` agree for every customer-payable service.
3. Exam PIN purchase cannot charge/fulfil while its availability flag is disabled.
4. Direct hub server functions cannot accept payment for disabled services.
5. VTpass ambiguous outcomes always enter requery/reconciliation and never automatic failover.
6. VTpass `total_amount` and `commission` are captured wherever available so transaction profit data remains auditable.
7. Webhook/order state is authoritative enough to recover when a customer closes the browser after payment.
8. Hub order and bill transaction writes are idempotent and reconcile cleanly.
9. Branding leftovers (`support@rockpay.ng` and old RockPay logo asset names) are reviewed before public launch.
10. No deployment to production is performed merely because CI is green; production launch remains a separate explicit decision.

## September 2026 hardening summary

The branch has added provider/fulfillment gates, removed unsafe demo-regulated-service payment paths, restricted hub order inserts to the server, corrected hub pricing to the shared `pricing_rules` schema, documented the production status model, and added CI verification coverage. The goal is to preserve the working core bill flow while making unfinished services fail closed.
