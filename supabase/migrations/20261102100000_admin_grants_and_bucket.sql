-- Follow-up to the first setup: lets the admin save rates and settings, and makes sure the private
-- bucket for dog photos and health documents exists. Row-level security still limits who can change what.
GRANT INSERT, UPDATE, DELETE ON public.rates TO authenticated;
GRANT UPDATE ON public.settings TO authenticated;
GRANT DELETE ON public.payments TO authenticated;
GRANT DELETE ON public.booking_requests TO authenticated;

insert into storage.buckets (id, name, public) values ('dog-files', 'dog-files', false)
on conflict (id) do nothing;
