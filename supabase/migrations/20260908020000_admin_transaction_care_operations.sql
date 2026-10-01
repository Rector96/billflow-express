-- Production hardening for staff transaction investigation and Care operations.
-- All reads are staff-only, bounded, and server-side. Financial records remain read-only here.

CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created_at
  ON public.support_tickets (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_transaction_created_at
  ON public.support_tickets (transaction_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created_at
  ON public.support_messages (ticket_id, created_at ASC);

CREATE OR REPLACE FUNCTION public.admin_transaction_directory(
  _query text DEFAULT '',
  _status text DEFAULT 'all',
  _service text DEFAULT 'all',
  _channel text DEFAULT 'all',
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _limit integer DEFAULT 30,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  internal_reference text,
  service text,
  provider text,
  product text,
  amount numeric,
  status text,
  customer_identifier text,
  provider_request_id text,
  provider_transaction_id text,
  provider_status text,
  provider_response_code text,
  provider_response_message text,
  provider_channel text,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  user_id uuid,
  wallet_id uuid,
  user_label text,
  user_email text,
  user_phone text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  needle text := trim(COALESCE(_query, ''));
  page_limit integer := LEAST(GREATEST(COALESCE(_limit, 30), 1), 100);
  page_offset integer := GREATEST(COALESCE(_offset, 0), 0);
BEGIN
  IF uid IS NULL OR NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _status IS NOT NULL AND _status NOT IN ('all', 'successful', 'pending', 'failed', 'reversed') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  IF _service IS NOT NULL AND _service NOT IN ('all', 'airtime', 'data', 'electricity', 'cable') THEN
    RAISE EXCEPTION 'invalid_service';
  END IF;
  IF _channel IS NOT NULL AND _channel NOT IN ('all', 'vtpass', 'paystack') THEN
    RAISE EXCEPTION 'invalid_channel';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      b.id,
      b.internal_reference::text,
      b.service::text,
      b.provider::text,
      b.product::text,
      b.amount::numeric,
      b.status::text,
      b.customer_identifier::text,
      b.provider_request_id::text,
      b.provider_transaction_id::text,
      b.provider_status::text,
      b.provider_response_code::text,
      b.provider_response_message::text,
      b.provider_channel::text,
      b.metadata::jsonb,
      b.created_at,
      b.updated_at,
      b.user_id,
      b.wallet_id,
      COALESCE(p.full_name, p.email, b.user_id::text)::text AS user_label,
      COALESCE(p.email, '')::text AS user_email,
      COALESCE(p.phone, '')::text AS user_phone
    FROM public.bill_transactions b
    LEFT JOIN public.profiles p ON p.user_id = b.user_id
    WHERE (_status IS NULL OR _status = 'all' OR b.status::text = _status)
      AND (
        _service IS NULL OR _service = 'all'
        OR (_service = 'airtime' AND lower(b.service::text) = 'airtime')
        OR (_service = 'data' AND lower(b.service::text) LIKE '%data%')
        OR (_service = 'electricity' AND lower(b.service::text) LIKE '%electric%')
        OR (_service = 'cable' AND (lower(b.service::text) LIKE '%cable%' OR lower(b.service::text) LIKE '%dstv%' OR lower(b.service::text) LIKE '%gotv%'))
      )
      AND (
        _channel IS NULL OR _channel = 'all'
        OR (_channel = 'vtpass' AND (lower(COALESCE(b.provider_channel, '')) = 'vtpass' OR b.metadata->>'channel' = 'vtpass' OR b.product = 'VTU'))
        OR (_channel = 'paystack' AND lower(COALESCE(b.provider_channel, '')) = 'paystack')
      )
      AND (_from IS NULL OR b.created_at >= _from)
      AND (_to IS NULL OR b.created_at < _to)
      AND (
        needle = ''
        OR b.internal_reference ILIKE '%' || needle || '%'
        OR b.provider_request_id ILIKE '%' || needle || '%'
        OR b.provider_transaction_id ILIKE '%' || needle || '%'
        OR b.customer_identifier ILIKE '%' || needle || '%'
        OR b.provider ILIKE '%' || needle || '%'
        OR p.full_name ILIKE '%' || needle || '%'
        OR p.email ILIKE '%' || needle || '%'
        OR p.phone ILIKE '%' || needle || '%'
        OR b.user_id::text ILIKE '%' || needle || '%'
      )
  )
  SELECT f.*, count(*) OVER ()::bigint
  FROM filtered f
  ORDER BY f.created_at DESC, f.id DESC
  LIMIT page_limit OFFSET page_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_transaction_directory(text, text, text, text, timestamptz, timestamptz, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_transaction_directory(text, text, text, text, timestamptz, timestamptz, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_care_queue(
  _query text DEFAULT '',
  _status text DEFAULT 'all',
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  ticket_number text,
  subject text,
  status text,
  category text,
  description text,
  created_at timestamptz,
  user_id uuid,
  user_label text,
  user_email text,
  transaction_id uuid,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  needle text := trim(COALESCE(_query, ''));
  page_limit integer := LEAST(GREATEST(COALESCE(_limit, 50), 1), 100);
  page_offset integer := GREATEST(COALESCE(_offset, 0), 0);
BEGIN
  IF uid IS NULL OR NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _status IS NOT NULL AND _status NOT IN ('all', 'open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      t.id,
      t.ticket_number::text,
      t.subject::text,
      t.status::text,
      t.category::text,
      t.description::text,
      t.created_at,
      t.user_id,
      COALESCE(p.full_name, p.email, t.user_id::text)::text AS user_label,
      COALESCE(p.email, '')::text AS user_email,
      t.transaction_id
    FROM public.support_tickets t
    LEFT JOIN public.profiles p ON p.user_id = t.user_id
    WHERE (_status IS NULL OR _status = 'all' OR t.status::text = _status)
      AND (
        needle = ''
        OR t.ticket_number ILIKE '%' || needle || '%'
        OR t.subject ILIKE '%' || needle || '%'
        OR t.description ILIKE '%' || needle || '%'
        OR p.full_name ILIKE '%' || needle || '%'
        OR p.email ILIKE '%' || needle || '%'
        OR p.phone ILIKE '%' || needle || '%'
        OR t.transaction_id::text ILIKE '%' || needle || '%'
      )
  )
  SELECT f.*, count(*) OVER ()::bigint
  FROM filtered f
  ORDER BY f.created_at DESC, f.id DESC
  LIMIT page_limit OFFSET page_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_care_queue(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_care_queue(text, text, integer, integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
