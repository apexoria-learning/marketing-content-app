-- Commit the skeleton and its children together; never publish an empty parent.
create or replace function public.commit_month_plan(
  p_month date,
  p_items jsonb,
  p_model text,
  p_prompt_version text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_count integer;
begin
  if p_month is null or p_month <> date_trunc('month', p_month)::date
    or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 28 and 62
    or nullif(btrim(p_prompt_version), '') is null
  then
    raise exception 'Invalid month plan input' using errcode = '23514';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_items) as item(scheduled_date date)
    where item.scheduled_date is null
      or item.scheduled_date < p_month
      or item.scheduled_date >= p_month + interval '1 month'
  ) or exists (
    select 1
    from generate_series(p_month, p_month + interval '1 month' - interval '1 day', interval '1 day') as day(value)
    where not exists (
      select 1 from jsonb_to_recordset(p_items) as item(scheduled_date date)
      where item.scheduled_date = day.value::date
    )
  ) then
    raise exception 'Month plan requires coverage of every date' using errcode = '23514';
  end if;

  insert into public.content_plans (plan_month, status, model, prompt_version, generated_at)
  values (p_month, 'complete', p_model, p_prompt_version, now())
  returning id into v_plan_id;

  insert into public.content_items (
    plan_id, scheduled_date, slot, platform, format, pillar, idea, prompt_version
  )
  select v_plan_id, item.scheduled_date, item.slot, item.platform,
    item.format, item.pillar, item.idea, p_prompt_version
  from jsonb_to_recordset(p_items) as item(
    scheduled_date date,
    slot smallint,
    platform public.platform,
    format public.content_format,
    pillar public.content_pillar,
    idea text
  );
  get diagnostics v_count = row_count;

  return jsonb_build_object('plan_id', v_plan_id, 'item_count', v_count);
end;
$$;

revoke all on function public.commit_month_plan(date, jsonb, text, text) from public, anon;
grant execute on function public.commit_month_plan(date, jsonb, text, text) to authenticated, service_role;
