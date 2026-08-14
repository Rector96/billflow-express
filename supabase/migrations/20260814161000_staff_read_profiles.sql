-- Staff need profile fields (name/email/phone) in RockPay Care workspace.
-- Does not expose data to non-staff; customers still only see own profile.

DROP POLICY IF EXISTS "staff read profiles" ON public.profiles;
CREATE POLICY "staff read profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
