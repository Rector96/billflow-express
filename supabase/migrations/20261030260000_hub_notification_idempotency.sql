-- Stable idempotency key for retry-safe Hub payment notifications.
-- Existing notifications remain unchanged; only newly keyed events participate.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS notification_key text;

-- PostgreSQL permits multiple NULL values in a normal unique index, so legacy
-- notifications remain unaffected while keyed events can use ON CONFLICT.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_notification_key_uidx
  ON public.notifications (notification_key);

COMMENT ON COLUMN public.notifications.notification_key IS
  'Optional idempotency key used to prevent duplicate lifecycle notifications on webhook retries.';
