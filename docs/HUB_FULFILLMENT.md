# Hub fulfillment (A+B)

## Status model

**Payment status** (`hub_orders.status`):
`pending` | `in_progress` | `successful` | `failed`

**Fulfillment** (`hub_orders.fulfillment_status` and/or `metadata.fulfillment_status`):

1. `looked_up` — identity/plate validated
2. `paid` — payment recorded (email receipt when email is wired)
3. `digital_ready` — soft copy linked; customer notified (My documents)
4. `queued_print` — physical job on print desk
5. `sealed` — packed envelope ready
6. `dispatched` — handed to rider; staff enters tracking note (no courier API)
7. `delivered` — confirmed

Soft-copy-only orders usually stop at **digital_ready**.

## Admin UI

- `/admin/hub-orders` — all hub orders, filters, attach document, status actions
- `/admin/dispatch` — physical queue; courier name/phone/waybill + Mark dispatched

## SQL

Run `supabase/migrations/20260916_hub_fulfillment_lifecycle.sql` in Supabase SQL editor.

## Email (later)

Hooks intended: paid, digital_ready, dispatched. In-app notifications already fire on status changes.
