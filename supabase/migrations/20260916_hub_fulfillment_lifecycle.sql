-- RockPay hub order fulfillment lifecycle (A: status model)
-- Safe to run multiple times. Does not require courier APIs.
--
-- Payment-ish column: hub_orders.status
--   pending | in_progress | successful | failed
-- Operational path (preferred in metadata, optional columns below):
--   looked_up → paid → digital_ready → queued_print → sealed → dispatched → delivered

-- Optional first-class columns (metadata remains source of truth if columns missing)
ALTER TABLE public.hub_orders
  ADD COLUMN IF NOT EXISTS fulfillment_status text;

ALTER TABLE public.hub_orders
  ADD COLUMN IF NOT EXISTS tracking_note text;

ALTER TABLE public.hub_orders
  ADD COLUMN IF NOT EXISTS document_url text;

ALTER TABLE public.hub_orders
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE public.hub_orders
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz;

ALTER TABLE public.hub_orders
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

COMMENT ON COLUMN public.hub_orders.fulfillment_status IS
  'looked_up|paid|digital_ready|queued_print|sealed|dispatched|delivered|cancelled';

-- Helpful indexes for admin queue
CREATE INDEX IF NOT EXISTS hub_orders_created_at_idx
  ON public.hub_orders (created_at DESC);

CREATE INDEX IF NOT EXISTS hub_orders_status_idx
  ON public.hub_orders (status);

CREATE INDEX IF NOT EXISTS hub_orders_fulfillment_status_idx
  ON public.hub_orders (fulfillment_status)
  WHERE fulfillment_status IS NOT NULL;

-- Backfill: paid-ish rows without fulfillment_status
UPDATE public.hub_orders
SET fulfillment_status = COALESCE(
  fulfillment_status,
  CASE
    WHEN lower(coalesce(status, '')) = 'successful' THEN 'digital_ready'
    WHEN lower(coalesce(status, '')) = 'failed' THEN 'cancelled'
    ELSE 'paid'
  END
)
WHERE fulfillment_status IS NULL;
