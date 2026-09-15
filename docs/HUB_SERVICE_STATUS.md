# Hub Service Status & Provider Gate

## Purpose

This document records the production-readiness rule for Rockwavehub services.
It exists so another developer can continue the work without assuming that a
route, UI screen, or mock response means a service is actually fulfillable.

## Important rule

**Never collect customer money for a service unless the server has a real,
configured fulfillment path.**

A UI may exist before the provider integration exists. That is acceptable. The
service must then remain `COMING_SOON`/unavailable rather than pretending to be
complete.

## Current status on `feature/rockpay-pricing`

| Service               | Status      | Reason                                                               |
| --------------------- | ----------- | -------------------------------------------------------------------- |
| Airtime               | AVAILABLE   | Existing VTpass production flow                                      |
| Data                  | AVAILABLE   | Existing VTpass production flow                                      |
| Electricity           | AVAILABLE   | Existing VTpass verification/payment flow                            |
| Cable TV              | AVAILABLE   | Existing VTpass verification/payment flow                            |
| Education / Exam PINs | AVAILABLE*  | VTpass catalog/provider dependent                                    |
| CAC Business Name     | COMING_SOON | No real CAC filing/submission backend yet                            |
| NIN                   | COMING_SOON | No verified NIN fulfillment provider configured                      |
| TIN                   | COMING_SOON | Dojah/JTB provider access is not configured                          |
| Vehicle               | COMING_SOON | Dojah vehicle verification is not configured                         |
| Documents             | COMING_SOON | Final server-side payment + real PDF delivery still needs completion |

`*` Provider availability must still be checked before enabling any specific
exam product in production.

## Dojah is not available yet

Dojah is **not required to make the core bill-payment platform standard**.
Until a Dojah account/API is available, the correct behavior is to keep TIN and
vehicle verification unavailable.

Do **not** add or restore generated/simulated government results. A generated
TIN, vehicle record, chassis, expiry date, or similar value must never be shown
as an official result.

When Dojah becomes available, the implementation should follow this sequence:

1. Add server-only Dojah credentials to the deployment environment.
2. Keep credentials out of client code and logs.
3. Test provider responses in the provider's sandbox first.
4. Map only verified provider fields into the customer-facing result.
5. Treat provider `404`, disabled-product, timeout, and unknown responses as
   non-fulfillment states.
6. Only mark an order successful after the provider has actually returned the
   required result.
7. Add provider-specific tests before moving the service to `LIVE_BILL_SLUGS`.

## Provider failover rule

VTpass is the primary bill provider and VTUAfrica is a possible secondary.

The secondary provider may be called only when VTpass returns a **definitive
failure**. A timeout, network exception, HTTP 5xx, or missing response is
ambiguous because VTpass may already have processed the transaction.

Safe state machine:

```text
REQUEST
  -> PRIMARY VTpass
      -> SUCCESS       -> SETTLE
      -> PENDING       -> REQUERY / HOLD
      -> DEFINITIVE FAIL -> SECONDARY MAY RUN
      -> TIMEOUT/ERROR -> HOLD / REQUERY / RECONCILE
```

Never implement:

```text
TIMEOUT -> SECONDARY PROVIDER
```

because that can double-fulfil a customer order.

## How to enable a new hub service

Before changing a service from `COMING_SOON` to live, confirm all of these:

- [ ] Real provider/fulfillment integration exists.
- [ ] Server validates all customer input.
- [ ] Server calculates/validates the amount.
- [ ] Payment is verified server-side.
- [ ] Fulfillment happens server-side.
- [ ] Provider response is stored with the transaction.
- [ ] Success is idempotent (refresh/retry cannot double-fulfil).
- [ ] Failed/pending/unknown states are distinct.
- [ ] Customer receives the actual result/document, not a generated placeholder.
- [ ] Admin can see and reconcile the order.
- [ ] Tests cover success, failure, timeout and duplicate/retry behavior.
- [ ] Only then add the slug to `LIVE_BILL_SLUGS` in `src/lib/product-mode.ts`.

## Change history

### 2026-09-15 — Production safety gate

- Removed unfinished CAC/NIN/TIN/Documents/Vehicle services from the live
  payment allow-list.
- Added explicit comments explaining why route/UI existence is not equivalent
  to production availability.
- Tightened VTpass → VTUAfrica failover so transport errors cannot automatically
  trigger a second provider transaction.
- Documented the Dojah dependency and the exact checklist for enabling TIN or
  vehicle verification later.

These changes are intentional safety controls, not removal of the product
features. The UI/routes can remain available for future work, but they must not
accept production payment until their fulfillment path is real.
