-- Admin / operations platform support.
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE).

-- ========== AUDIT LOGS ==========
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  description text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON public.admin_audit_logs (actor_user_id, created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

DROP POLICY IF EXISTS "staff read audit logs" ON public.admin_audit_logs;
CREATE POLICY "staff read audit logs" ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- No INSERT/UPDATE/DELETE for authenticated via RLS — only SECURITY DEFINER RPCs.

CREATE OR REPLACE FUNCTION public.admin_write_audit(
  _action text,
  _description text,
  _target_type text DEFAULT NULL,
  _target_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rid uuid;
BEGIN
  IF uid IS NULL OR NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _action IS NULL OR length(trim(_action)) = 0 THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;
  INSERT INTO public.admin_audit_logs (actor_user_id, action, target_type, target_id, description, metadata)
  VALUES (uid, trim(_action), _target_type, _target_id, COALESCE(_description, ''), COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO rid;
  RETURN rid;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_write_audit(text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_write_audit(text, text, text, text, jsonb) TO authenticated, service_role;

-- ========== ACCOUNT STATUS (admin/support with limits) ==========
CREATE OR REPLACE FUNCTION public.admin_set_account_status(
  _user_id uuid,
  _status text,
  _reason text DEFAULT ''
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prev text;
BEGIN
  IF uid IS NULL OR NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  -- support can only view in app; status changes require admin or super_admin
  IF NOT (
    public.has_role(uid, 'admin') OR public.has_role(uid, 'super_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden_role';
  END IF;
  IF _status NOT IN ('active', 'suspended', 'closed') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  IF _user_id = uid THEN
    RAISE EXCEPTION 'cannot_change_self';
  END IF;

  SELECT account_status INTO prev FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  UPDATE public.profiles SET account_status = _status WHERE user_id = _user_id;

  PERFORM public.admin_write_audit(
    CASE WHEN _status = 'active' THEN 'user_reactivate' ELSE 'user_suspend' END,
    COALESCE(nullif(trim(_reason), ''), 'Account status changed to ' || _status),
    'user',
    _user_id::text,
    jsonb_build_object('from', prev, 'to', _status, 'reason', COALESCE(_reason, ''))
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_account_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid, text, text) TO authenticated, service_role;

-- ========== COMPREHENSIVE OPS STATS ==========
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
  month_start timestamptz := date_trunc('month', now());
BEGIN
  IF uid IS NULL OR NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
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

-- Daily volume series for charts (last N days of wallet_transactions)
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
  IF uid IS NULL OR NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
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

-- Service breakdown from bill_transactions
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
  IF uid IS NULL OR NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
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
