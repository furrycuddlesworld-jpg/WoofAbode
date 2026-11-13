ALTER TABLE public.dogs ADD COLUMN service_type text NOT NULL DEFAULT 'both';
ALTER TABLE public.dogs ADD CONSTRAINT dogs_service_type_check CHECK (service_type IN ('day','home','both'));
UPDATE public.dogs d SET service_type = 'home'
  WHERE EXISTS (SELECT 1 FROM public.stays s WHERE s.dog_id = d.id)
    AND NOT EXISTS (SELECT 1 FROM public.day_boarding b WHERE b.dog_id = d.id);

CREATE TABLE public.day_boarding_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  added_manually boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dog_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_boarding_roster TO authenticated;
GRANT ALL ON public.day_boarding_roster TO service_role;
ALTER TABLE public.day_boarding_roster ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roster: admin write" ON public.day_boarding_roster FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "roster: read" ON public.day_boarding_roster FOR SELECT USING ((public.owns_dog(dog_id) AND public.is_approved()) OR public.is_admin());