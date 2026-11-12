-- Restrict dashboard aggregates and pricing economics to Admin and Super Admin.
-- Customer Care retains access to dedicated support queue/statistics functions only.
-- Existing function signatures, result shapes, SECURITY DEFINER behaviour,
-- search_path, and authenticated/service_role execution grants are preserved.

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  result jsonb;
BEGIN
  IF uid IS NULL OR NOT (
    public.has_role(uid, 'admin'::public.app_role)
    OR public.has_role(uid, 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'active_users', (SELECT count(*) FROM public.profiles WHERE account_status = 'active'),
    'wallet_count', (SELECT count(*) FROM public.wallets),
    'wallet_balance_total', (SELECT COALESCE(sum(balance),0) FROM public.wallets),
    'bill_transactions', (SELECT count(*) FROM public.bill_transactions),
    'bill_successful', (SELECT count(*) FROM public.bill_transactions WHERE status='successful'),
    'bill_pending', (SELECT count(*) FROM public.bill_transactions WHERE status='pending'),
    'bill_failed', (SELECT count(*) FROM public.bill_transactions WHERE status='failed'),
    'bill_volume', (SELECT COALESCE(sum(amount),0) FROM public.bill_transactions WHERE status='successful'),
    'support_open', (SELECT count(*) FROM public.support_tickets WHERE status IN ('open','in_progress')),
    'support_total', (SELECT count(*) FROM public.support_tickets)
  ) INTO result;

  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_pricing_economics_summary()
RETURNS TABLE (
  service text,
  provider text,
  transaction_count bigint,
  observed_customer_amount numeric,
  observed_provider_cost numeric,
  observed_provider_commission numeric,
  observed_profit numeric,
  last_observed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT (
    public.has_role(uid, 'admin'::public.app_role)
    OR public.has_role(uid, 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    bt.service,
    coalesce(bt.provider, ''),
    count(*)::bigint,
    round(sum(tp.customer_amount), 2),
    round(sum(coalesce(tp.provider_cost, 0)), 2),
    round(sum(coalesce(tp.provider_commission, 0)), 2),
    round(sum(coalesce(tp.profit, 0)), 2),
    max(tp.calculated_at)
  FROM public.transaction_profits tp
  JOIN public.bill_transactions bt ON bt.id = tp.bill_transaction_id
  GROUP BY bt.service, bt.provider
  ORDER BY max(tp.calculated_at) DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_pricing_economics_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_pricing_economics_summary() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
