-- Hub orders contain payment and customer-service records.
--
-- SECURITY DECISION:
-- Customer clients may read their own orders, but they must never be allowed
-- to create arbitrary successful hub orders from the browser. Server-side hub
-- functions use the Supabase service role for inserts, so no authenticated
-- INSERT policy is required.
--
-- This closes the previous broad INSERT policy while preserving the existing
-- service-role/server workflow used by hub.functions.ts.

DROP POLICY IF EXISTS hub_orders_insert_service ON public.hub_orders;

-- Intentionally no authenticated INSERT policy is recreated here.
-- service_role bypasses RLS and remains the only supported insert path.

NOTIFY pgrst, 'reload schema';
