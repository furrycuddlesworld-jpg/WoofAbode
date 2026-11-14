GRANT UPDATE, DELETE ON public.dog_rates TO authenticated;
CREATE POLICY "rate history admin correct" ON public.dog_rates FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "rate history admin remove" ON public.dog_rates FOR DELETE TO authenticated USING (public.is_admin());
CREATE OR REPLACE FUNCTION public.sync_dog_rate_cache()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE _dog uuid := coalesce(NEW.dog_id, OLD.dog_id); BEGIN
 UPDATE public.dogs d SET day_boarding_rate=(SELECT rate FROM public.dog_rates WHERE dog_id=_dog AND service='day' AND effective_from <= (now() AT TIME ZONE 'Asia/Kolkata')::date ORDER BY effective_from DESC,created_at DESC LIMIT 1),home_boarding_rate=(SELECT rate FROM public.dog_rates WHERE dog_id=_dog AND service='home' AND effective_from <= (now() AT TIME ZONE 'Asia/Kolkata')::date ORDER BY effective_from DESC,created_at DESC LIMIT 1) WHERE d.id=_dog;
 RETURN NULL; END $function$;
DROP TRIGGER IF EXISTS sync_dog_rate_cache ON public.dog_rates;
CREATE TRIGGER sync_dog_rate_cache AFTER INSERT OR UPDATE OR DELETE ON public.dog_rates FOR EACH ROW EXECUTE FUNCTION public.sync_dog_rate_cache();