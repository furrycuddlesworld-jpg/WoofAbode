DROP POLICY IF EXISTS "settings: read" ON public.settings;
CREATE POLICY "settings: read" ON public.settings FOR SELECT TO authenticated USING (public.is_approved() OR public.is_admin());