CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE imported_name text; imported_phone text;
BEGIN
 SELECT pending_owner_name, pending_owner_phone INTO imported_name, imported_phone
 FROM public.dogs WHERE owner_id IS NULL AND lower(pending_owner_email) = lower(new.email) LIMIT 1;
 INSERT INTO public.profiles(id,email,full_name,phone)
 VALUES(new.id,coalesce(new.email,''),coalesce(nullif(new.raw_user_meta_data->>'full_name',''),imported_name,''),imported_phone);
 UPDATE public.dogs SET owner_id=new.id,pending_owner_email=NULL
 WHERE owner_id IS NULL AND lower(pending_owner_email)=lower(new.email);
 INSERT INTO public.user_roles(user_id,role) VALUES(new.id,'client'::public.app_role);
 RETURN new;
END;
$$;
COMMENT ON FUNCTION public.handle_new_user() IS 'Registration grants client access automatically; admin access is only granted by an existing administrator.';