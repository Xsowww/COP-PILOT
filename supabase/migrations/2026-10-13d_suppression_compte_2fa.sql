-- « Supprimer mon compte » exige la 2FA quand le compte en a une (même règle que les tables).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.mfa_ok() then
    raise exception 'mfa required';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
