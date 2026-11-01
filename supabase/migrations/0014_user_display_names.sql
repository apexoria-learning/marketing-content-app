-- Display names for "Posted by" and history attribution. The application
-- records actors by email (posted_by, activity_log.actor_email); the person's
-- name exists only in Supabase Auth metadata from Google sign-in. Callers get
-- names only for people who already appear in application data, so the
-- function cannot probe arbitrary sign-in accounts. PL/pgSQL defers resolving
-- auth.users until execution.
create or replace function public.user_display_names(p_emails text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_emails is null or cardinality(p_emails) = 0 then
    return '{}'::jsonb;
  end if;
  if cardinality(p_emails) > 200 then
    raise exception 'Too many emails requested' using errcode = '23514';
  end if;
  return coalesce((
    select jsonb_object_agg(lower(u.email), names.display_name)
    from auth.users u
    cross join lateral (
      select nullif(btrim(coalesce(
        u.raw_user_meta_data ->> 'full_name',
        u.raw_user_meta_data ->> 'name'
      )), '') as display_name
    ) names
    where names.display_name is not null
      and lower(u.email) in (select lower(requested) from unnest(p_emails) requested)
      and (
        exists (
          select 1 from public.content_items c
          where lower(c.posted_by) = lower(u.email)
        )
        or exists (
          select 1 from public.activity_log a
          where lower(a.actor_email) = lower(u.email)
        )
      )
  ), '{}'::jsonb);
end;
$$;

revoke all on function public.user_display_names(text[]) from public, anon;
grant execute on function public.user_display_names(text[]) to authenticated;
