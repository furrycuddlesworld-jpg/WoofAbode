CREATE TABLE public.expenses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 description text NOT NULL,
 category text NOT NULL DEFAULT 'other',
 service text NOT NULL DEFAULT 'all' CHECK(service IN ('all','day','home')),
 amount numeric NOT NULL CHECK(amount > 0),
 incurred_on date NOT NULL DEFAULT CURRENT_DATE,
 paid_on date,
 method text NOT NULL DEFAULT 'cash' CHECK(method IN ('cash','upi','bank','other')),
 note text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses admin only" ON public.expenses FOR ALL TO authenticated USING(public.is_admin()) WITH CHECK(public.is_admin());
CREATE INDEX expenses_incurred_on ON public.expenses(incurred_on);