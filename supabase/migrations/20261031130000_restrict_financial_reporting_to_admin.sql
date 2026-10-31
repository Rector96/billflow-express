-- Financial reporting is restricted to Admin and Super Admin.
-- Customer Care retains operational support access but cannot query aggregate
-- wallet balances, funding totals, transaction volumes, or service revenue data.

CREATE OR REPLACE FUNCTION public.admin_ops_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  result jsonb;
  day_start timestamptz := date_trunc('day', now());
  yday_start timestamptz := date_trunc('day', now()) - interval '1 day';
  week_start timestamptz := date_trunc('week', now());
  prev_week_start timestamptz := date_trunc('week', now()) - interval '7 days';
BEGIN
  IF uid IS NULL OR NOT (
    public.has_role(uid, 'admin') OR public.has_role(uid, 'super_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden_role';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'active_users', (SELECT count(*) FROM public.profiles WHERE account_status = 'active'),
    'suspended_users', (SELECT count(*) FROM public.profiles WHERE account_status = 'suspended'),
    'new_users_today', (SELECT count(*) FROM public.profiles WHERE created_at >= day_start),
    'new_users_yesterday', (SELECT count(*) FROM public.profiles WHERE created_at >= yday_start AND created_at < day_start),
    'new_users_week', (SELECT count(*) FROM public.profiles WHERE created_at >= week_start),
    'new_users_prev_week', (SELECT count(*) FROM public.profiles WHERE created_at >= prev_week_start AND created_at < week_start),
    'wallet_balance_total', (SELECT COALESCE(sum(balance), 0) FROM public.wallets),
    'wallet_count', (SELECT count(*) FROM public.wallets),
    'funding_total', (
      SELECT COALESCE(sum(amount), 0) FROM public.wallet_transactions
      WHERE type = 'deposit' AND status = 'successful'
    ),
    'funding_today', (
      SELECT COALESCE(sum(amount), 0) FROM public.wallet_transactions
      WHERE type = 'deposit' AND status = 'successful' AND created_at >= day_start
    ),
    'funding_yesterday', (
      SELECT COALESCE(sum(amount), 0) FROM public.wallet_transactions
      WHERE type = 'deposit' AND status = 'successful'
        AND created_at >= yday_start AND created_at < day_start
    ),
    'funding_count', (
      SELECT count(*) FROM public.wallet_transactions
      WHERE type = 'deposit' AND status = 'successful'
    ),
    'funding_avg', (
      SELECT COALESCE(avg(amount), 0) FROM public.wallet_transactions
      WHERE type = 'deposit' AND status = 'successful'
    ),
    'funding_max', (
      SELECT COALESCE(max(amount), 0) FROM public.wallet_transactions
      WHERE type = 'deposit' AND status = 'successful'
    ),
    'debits_total', (
      SELECT COALESCE(sum(amount), 0) FROM public.wallet_transactions
      WHERE type = 'bill_payment' AND status = 'successful'
    ),
    'refunds_total', (
      SELECT COALESCE(sum(amount), 0) FROM public.wallet_transactions
      WHERE type = 'refund' AND status = 'successful'
    ),
    'tx_successful_today', (
      SELECT count(*) FROM public.wallet_transactions
      WHERE status = 'successful' AND created_at >= day_start
    ),
    'tx_failed_today', (
      SELECT count(*) FROM public.wallet_transactions
      WHERE status = 'failed' AND created_at >= day_start
    ),
    'tx_pending', (
      SELECT count(*) FROM public.wallet_transactions WHERE status = 'pending'
    ),
    'tx_successful', (
      SELECT count(*) FROM public.wallet_transactions WHERE status = 'successful'
    ),
    'tx_failed', (
      SELECT count(*) FROM public.wallet_transactions WHERE status = 'failed'
    ),
    'tx_volume_successful', (
      SELECT COALESCE(sum(amount), 0) FROM public.wallet_transactions WHERE status = 'successful'
    ),
    'bill_successful', (SELECT count(*) FROM public.bill_transactions WHERE status = 'successful'),
    'bill_pending', (SELECT count(*) FROM public.bill_transactions WHERE status = 'pending'),
    'bill_failed', (SELECT count(*) FROM public.bill_transactions WHERE status = 'failed'),
    'bill_volume', (
      SELECT COALESCE(sum(amount), 0) FROM public.bill_transactions WHERE status = 'successful'
    ),
    'revenue_fees', 0,
    'generated_at', now()
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ops_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ops_stats() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_tx_volume_series(_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  d int := LEAST(GREATEST(COALESCE(_days, 30), 1), 90);
BEGIN
  IF uid IS NULL OR NOT (
    public.has_role(uid, 'admin') OR public.has_role(uid, 'super_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden_role';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.day)
    FROM (
      SELECT
        to_char(gs.day, 'YYYY-MM-DD') AS day,
        COALESCE(sum(w.amount) FILTER (WHERE w.status = 'successful'), 0) AS volume,
        count(w.id) FILTER (WHERE w.status = 'successful') AS successful,
        count(w.id) FILTER (WHERE w.status = 'pending') AS pending,
        count(w.id) FILTER (WHERE w.status = 'failed') AS failed,
        COALESCE(sum(w.amount) FILTER (WHERE w.type = 'deposit' AND w.status = 'successful'), 0) AS funding
      FROM generate_series(
        (date_trunc('day', now()) - ((d - 1) || ' days')::interval)::date,
        date_trunc('day', now())::date,
        '1 day'::interval
      ) AS gs(day)
      LEFT JOIN public.wallet_transactions w
        ON w.created_at >= gs.day
       AND w.created_at < gs.day + interval '1 day'
      GROUP BY gs.day
    ) t
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_tx_volume_series(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_tx_volume_series(int) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_service_breakdown()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT (
    public.has_role(uid, 'admin') OR public.has_role(uid, 'super_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden_role';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.volume DESC)
    FROM (
      SELECT
        COALESCE(nullif(trim(service), ''), 'other') AS service,
        count(*) AS total,
        count(*) FILTER (WHERE status = 'successful') AS successful,
        count(*) FILTER (WHERE status = 'pending') AS pending,
        count(*) FILTER (WHERE status = 'failed') AS failed,
        COALESCE(sum(amount) FILTER (WHERE status = 'successful'), 0) AS volume
      FROM public.bill_transactions
      GROUP BY 1
    ) t
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_service_breakdown() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_service_breakdown() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
