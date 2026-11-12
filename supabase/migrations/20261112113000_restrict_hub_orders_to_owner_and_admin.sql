-- Hub order records are private to their owner and platform administrators.
-- Customer Care works through the ticket queue, not the full Hub operations queue.

DROP POLICY IF EXISTS hub_orders_select_own ON public.hub_orders;

CREATE POLICY hub_orders_select_own
ON public.hub_orders
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

NOTIFY pgrst, 'reload schema';
