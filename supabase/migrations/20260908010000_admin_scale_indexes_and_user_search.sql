-- Production hardening for the admin operations surface.
-- Search remains staff-only and returns bounded pages; it never exposes auth secrets.

CREATE INDEX IF NOT EXISTS idx_profiles_created_at_desc
  ON public.profiles (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_account_status_created_at
  ON public.profiles (account_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bill_transactions_user_created_at
  ON public.bill_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bill_transactions_status_created_at
  ON public.bill_transactions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created_at
  ON public.wallet_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status_created_at
  ON public.wallet_transactions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_created_at
  ON public.support_tickets (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_user_directory(
  _query text DEFAULT '',
  _status text DEFAULT 'all',
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  phone text,
  account_status text,
  created_at timestamptz,
  balance numeric,
  tx_count bigint,
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
  total bigint;
BEGIN
  IF uid IS NULL OR NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _status IS NOT NULL AND _status NOT IN ('all', 'active', 'suspended', 'closed') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT count(*) INTO total
  FROM public.profiles p
  WHERE (_status IS NULL OR _status = 'all' OR p.account_status = _status)
    AND (
      needle = ''
      OR p.full_name ILIKE '%' || needle || '%'
      OR p.email ILIKE '%' || needle || '%'
      OR p.phone ILIKE '%' || needle || '%'
      OR p.user_id::text ILIKE '%' || needle || '%'
    );

  RETURN QUERY
  SELECT
    p.user_id,
    COALESCE(p.full_name, '')::text,
    COALESCE(p.email, '')::text,
    COALESCE(p.phone, '')::text,
    COALESCE(p.account_status, 'active')::text,
    p.created_at,
    COALESCE(w.balance, 0)::numeric,
    COALESCE(tx.tx_count, 0)::bigint,
    total
  FROM public.profiles p
  LEFT JOIN public.wallets w ON w.user_id = p.user_id
  LEFT JOIN LATERAL (
    SELECT count(*)::bigint AS tx_count
    FROM public.wallet_transactions wt
    WHERE wt.user_id = p.user_id
  ) tx ON true
  WHERE (_status IS NULL OR _status = 'all' OR p.account_status = _status)
    AND (
      needle = ''
      OR p.full_name ILIKE '%' || needle || '%'
      OR p.email ILIKE '%' || needle || '%'
      OR p.phone ILIKE '%' || needle || '%'
      OR p.user_id::text ILIKE '%' || needle || '%'
    )
  ORDER BY p.created_at DESC, p.user_id
  LIMIT page_limit OFFSET page_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_directory(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_directory(text, text, integer, integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
