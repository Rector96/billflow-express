-- Durable, idempotent lifecycle email outbox for RockPay Hub.
CREATE TABLE IF NOT EXISTS public.hub_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('paid', 'digital_ready', 'dispatched', 'delivered')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hub_email_outbox_pending_idx
  ON public.hub_email_outbox (next_attempt_at, created_at)
  WHERE status = 'pending';

ALTER TABLE public.hub_email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hub_email_outbox FROM anon, authenticated;
GRANT ALL ON public.hub_email_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.claim_hub_email_outbox(_batch_size integer DEFAULT 10)
RETURNS TABLE (
  id uuid,
  event_key text,
  user_id uuid,
  event text,
  payload jsonb,
  attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role required';
  END IF;
  IF _batch_size IS NULL OR _batch_size < 1 OR _batch_size > 100 THEN
    RAISE EXCEPTION 'batch size must be between 1 and 100';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT o.id
    FROM public.hub_email_outbox o
    WHERE (
      (o.status = 'pending' AND o.next_attempt_at <= now())
      OR (o.status = 'processing' AND o.locked_at < now() - interval '10 minutes')
    )
    ORDER BY o.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT _batch_size
  ),
  claimed AS (
    UPDATE public.hub_email_outbox o
    SET status = 'processing',
        attempts = o.attempts + 1,
        locked_at = now(),
        updated_at = now()
    FROM candidates c
    WHERE o.id = c.id
    RETURNING o.id, o.event_key, o.user_id, o.event, o.payload, o.attempts
  )
  SELECT claimed.id, claimed.event_key, claimed.user_id, claimed.event, claimed.payload, claimed.attempts
  FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_hub_email_outbox(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_hub_email_outbox(integer) TO service_role;

COMMENT ON TABLE public.hub_email_outbox IS
  'Durable, idempotent queue for RockPay Hub lifecycle emails. Service-role access only.';
