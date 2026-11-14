ALTER TABLE public.dogs ADD COLUMN day_boarding_rate numeric, ADD COLUMN home_boarding_rate numeric;
ALTER TABLE public.day_boarding ADD COLUMN rate_override numeric, ADD COLUMN override_reason text;
CREATE TABLE public.dog_rates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE, service text NOT NULL CHECK (service IN ('day','home')), rate numeric NOT NULL CHECK (rate >= 0), effective_from date NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp());
GRANT SELECT, INSERT ON public.dog_rates TO authenticated;
GRANT ALL ON public.dog_rates TO service_role;
ALTER TABLE public.dog_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate history read" ON public.dog_rates FOR SELECT TO authenticated USING ((public.owns_dog(dog_id) AND public.is_approved()) OR public.is_admin());
CREATE POLICY "rate history admin append" ON public.dog_rates FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE INDEX dog_rates_lookup ON public.dog_rates(dog_id, service, effective_from DESC, created_at DESC);
INSERT INTO public.dog_rates(dog_id,service,rate,effective_from) SELECT dog_id,'day',day_rate,effective_from FROM public.rates WHERE day_rate IS NOT NULL;
INSERT INTO public.dog_rates(dog_id,service,rate,effective_from) SELECT dog_id,'home',night_rate,effective_from FROM public.rates WHERE night_rate IS NOT NULL;
UPDATE public.dogs d SET day_boarding_rate=(SELECT r.rate FROM public.dog_rates r WHERE r.dog_id=d.id AND r.service='day' AND r.effective_from <= (now() AT TIME ZONE 'Asia/Kolkata')::date ORDER BY r.effective_from DESC,r.created_at DESC LIMIT 1), home_boarding_rate=(SELECT r.rate FROM public.dog_rates r WHERE r.dog_id=d.id AND r.service='home' AND r.effective_from <= (now() AT TIME ZONE 'Asia/Kolkata')::date ORDER BY r.effective_from DESC,r.created_at DESC LIMIT 1);
CREATE FUNCTION public.capture_dog_rates() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
 IF NOT public.is_admin() THEN
  IF TG_OP='INSERT' THEN
   IF NEW.day_boarding_rate IS NOT NULL OR NEW.home_boarding_rate IS NOT NULL THEN RAISE EXCEPTION 'Only admins can set rates'; END IF;
  ELSIF NEW.day_boarding_rate IS DISTINCT FROM OLD.day_boarding_rate OR NEW.home_boarding_rate IS DISTINCT FROM OLD.home_boarding_rate THEN RAISE EXCEPTION 'Only admins can set rates'; END IF;
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.day_boarding_rate IS NOT NULL THEN INSERT INTO public.dog_rates(dog_id,service,rate,effective_from) VALUES(NEW.id,'day',NEW.day_boarding_rate,(now() AT TIME ZONE 'Asia/Kolkata')::date); END IF;
  IF NEW.home_boarding_rate IS NOT NULL THEN INSERT INTO public.dog_rates(dog_id,service,rate,effective_from) VALUES(NEW.id,'home',NEW.home_boarding_rate,(now() AT TIME ZONE 'Asia/Kolkata')::date); END IF;
 ELSE
  IF NEW.day_boarding_rate IS DISTINCT FROM OLD.day_boarding_rate AND NEW.day_boarding_rate IS NOT NULL THEN INSERT INTO public.dog_rates(dog_id,service,rate,effective_from) VALUES(NEW.id,'day',NEW.day_boarding_rate,(now() AT TIME ZONE 'Asia/Kolkata')::date); END IF;
  IF NEW.home_boarding_rate IS DISTINCT FROM OLD.home_boarding_rate AND NEW.home_boarding_rate IS NOT NULL THEN INSERT INTO public.dog_rates(dog_id,service,rate,effective_from) VALUES(NEW.id,'home',NEW.home_boarding_rate,(now() AT TIME ZONE 'Asia/Kolkata')::date); END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER capture_dog_rates AFTER INSERT OR UPDATE OF day_boarding_rate,home_boarding_rate ON public.dogs FOR EACH ROW EXECUTE FUNCTION public.capture_dog_rates();
CREATE FUNCTION public.sync_dog_rate_cache() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 UPDATE public.dogs d SET day_boarding_rate=(SELECT rate FROM public.dog_rates WHERE dog_id=NEW.dog_id AND service='day' AND effective_from <= (now() AT TIME ZONE 'Asia/Kolkata')::date ORDER BY effective_from DESC,created_at DESC LIMIT 1),home_boarding_rate=(SELECT rate FROM public.dog_rates WHERE dog_id=NEW.dog_id AND service='home' AND effective_from <= (now() AT TIME ZONE 'Asia/Kolkata')::date ORDER BY effective_from DESC,created_at DESC LIMIT 1) WHERE d.id=NEW.dog_id;
 RETURN NEW; END $$;
CREATE TRIGGER sync_dog_rate_cache AFTER INSERT ON public.dog_rates FOR EACH ROW EXECUTE FUNCTION public.sync_dog_rate_cache();
ALTER TABLE public.dogs ADD CONSTRAINT dog_day_rate_positive CHECK(day_boarding_rate >= 0), ADD CONSTRAINT dog_home_rate_positive CHECK(home_boarding_rate >= 0);
ALTER TABLE public.day_boarding ADD CONSTRAINT day_override_positive CHECK(rate_override >= 0);
CREATE FUNCTION public.mirror_legacy_rates() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.day_rate IS NOT NULL THEN INSERT INTO public.dog_rates(dog_id,service,rate,effective_from) VALUES(NEW.dog_id,'day',NEW.day_rate,NEW.effective_from); END IF;
 IF NEW.night_rate IS NOT NULL THEN INSERT INTO public.dog_rates(dog_id,service,rate,effective_from) VALUES(NEW.dog_id,'home',NEW.night_rate,NEW.effective_from); END IF;
 RETURN NEW; END $$;
CREATE TRIGGER mirror_legacy_rates AFTER INSERT OR UPDATE ON public.rates FOR EACH ROW EXECUTE FUNCTION public.mirror_legacy_rates();