begin read only;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'brand_profile', 'content_plans', 'content_items', 'daily_tips',
    'news_items', 'activity_log', 'generation_runs', 'rate_limits',
    'app_users', 'app_settings', 'prompt_instructions',
    'platforms', 'platform_formats'
  ] loop
    if not exists (
      select 1
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_table
        and c.relkind = 'r' and c.relrowsecurity
    ) then
      raise exception 'Required table is missing or RLS is disabled: %', v_table;
    end if;

    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = v_table
        and ('anon' = any(roles) or 'public' = any(roles) or cmd = 'DELETE')
    ) then
      raise exception 'Unexpected anonymous or delete policy: %', v_table;
    end if;
  end loop;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rate_limits'
  ) then
    raise exception 'rate_limits must have no policies';
  end if;

  -- Admin tables are written only by the server's admin module (service_role).
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in (
        'app_users', 'app_settings', 'prompt_instructions',
        'platforms', 'platform_formats'
      )
      and cmd <> 'SELECT'
  ) then
    raise exception 'Admin tables must not have member write policies';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'consume_rate_limit'
      and p.prosecdef and p.proconfig @> array['search_path=""']
      and has_function_privilege('authenticated', p.oid, 'execute')
      and not has_function_privilege('anon', p.oid, 'execute')
  ) then
    raise exception 'Required rate-limit function protection is missing';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'change_content_status'
      and not p.prosecdef and p.proconfig @> array['search_path=""']
      and has_function_privilege('authenticated', p.oid, 'execute')
      and not has_function_privilege('anon', p.oid, 'execute')
  ) then
    raise exception 'Required atomic status function protection is missing';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'commit_month_plan'
      and not p.prosecdef and p.proconfig @> array['search_path=""']
      and has_function_privilege('authenticated', p.oid, 'execute')
      and not has_function_privilege('anon', p.oid, 'execute')
  ) then
    raise exception 'Required atomic planning function protection is missing';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'user_display_names'
      and p.prosecdef and p.proconfig @> array['search_path=""']
      and has_function_privilege('authenticated', p.oid, 'execute')
      and not has_function_privilege('anon', p.oid, 'execute')
  ) then
    raise exception 'Required display-name function protection is missing';
  end if;

  if (
    select count(*)
    from pg_trigger
    where tgrelid = 'public.activity_log'::regclass and not tgisinternal
      and tgname in ('activity_log_no_update', 'activity_log_no_delete')
      and tgenabled in ('O', 'A')
  ) <> 2 then
    raise exception 'Append-only audit triggers are missing or disabled';
  end if;

  if not exists (select 1 from public.brand_profile where id = 1) then
    raise exception 'Brand profile seed is missing';
  end if;
end;
$$;

rollback;
