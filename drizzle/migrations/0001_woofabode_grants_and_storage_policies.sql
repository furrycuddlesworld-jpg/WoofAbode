-- Data API access grants for every WoofAbode public table (parent-facing app data).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dogs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_records TO authenticated;
GRANT SELECT ON public.rates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_boarding TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stays TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.bills_bill_number_seq TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advances TO authenticated;
GRANT SELECT, INSERT ON public.payments TO authenticated;
GRANT SELECT, UPDATE ON public.payments TO authenticated;
GRANT SELECT ON public.settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT ON public.reminder_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.booking_requests TO authenticated;

GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.dogs TO service_role;
GRANT ALL ON public.health_records TO service_role;
GRANT ALL ON public.rates TO service_role;
GRANT ALL ON public.day_boarding TO service_role;
GRANT ALL ON public.stays TO service_role;
GRANT ALL ON public.bills TO service_role;
GRANT ALL ON public.advances TO service_role;
GRANT ALL ON public.payments TO service_role;
GRANT ALL ON public.settings TO service_role;
GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.reminder_log TO service_role;
GRANT ALL ON public.booking_requests TO service_role;
GRANT ALL ON SEQUENCE public.bills_bill_number_seq TO service_role;

-- File storage: private bucket, files stored under <owner id>/<dog id>/<file>
create policy "dog-files: read own or admin" on storage.objects for select
  using (bucket_id = 'dog-files' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "dog-files: upload own or admin" on storage.objects for insert
  with check (bucket_id = 'dog-files' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "dog-files: delete own or admin" on storage.objects for delete
  using (bucket_id = 'dog-files' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
