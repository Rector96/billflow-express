-- Stable idempotency key for retry-safe Hub payment notifications.
-- Existing notifications remain unchanged; only newly keyed events participate.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS notification_key text;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_notification_key_uidx
  ON public.notifications (notification_key)
  WHERE notification_key IS NOT NULL;

COMMENT ON COLUMN public.notifications.notification_key IS
  'Optional idempotency key used to prevent duplicate lifecycle notifications on webhook retries.';
