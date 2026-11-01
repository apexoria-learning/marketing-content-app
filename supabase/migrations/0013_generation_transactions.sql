create or replace function public.consume_ai_budget(
  p_user_limit integer,
  p_global_limit integer,
  p_plan_month boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_window timestamptz;
begin
  v_email := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'email';
  if nullif(btrim(v_email), '') is null or p_user_limit is null
    or p_global_limit is null or p_user_limit <= 0 or p_global_limit <= 0 then
    raise exception 'Invalid AI budget request' using errcode = '23514';
  end if;
  v_window := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  begin
    if not coalesce(public.consume_rate_limit('global', 'ai_generate', v_window, p_global_limit), false)
      or not coalesce(public.consume_rate_limit(v_email, 'ai_generate', v_window, p_user_limit), false)
      or (p_plan_month and not coalesce(public.consume_rate_limit('global', 'plan_month', v_window, 5), false)) then
      raise exception 'AI budget exhausted' using errcode = 'P0002';
    end if;
  exception when no_data_found then
    return false;
  end;
  return true;
end;
$$;

create or replace function public.save_generated_item(
  p_item_id uuid,
  p_content jsonb,
  p_prompt_version text,
  p_expected_updated_at timestamptz,
  p_regenerate boolean
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_item public.content_items;
  v_previous jsonb;
  v_email text;
begin
  select * into v_item from public.content_items where id = p_item_id for update;
  if not found then raise exception 'Content item not found' using errcode = '23514'; end if;
  if v_item.status = 'posted' then
    raise exception 'Posted content cannot be generated' using errcode = '23514';
  end if;
  if not p_regenerate and v_item.hydrated_at is not null then return to_jsonb(v_item); end if;
  if p_expected_updated_at is null or v_item.updated_at <> p_expected_updated_at then
    raise exception 'Content changed during generation' using errcode = '23514';
  end if;
  if p_regenerate is null or p_content is null or jsonb_typeof(p_content) <> 'object'
    or p_content ->> 'format' is distinct from v_item.format::text
    or nullif(btrim(p_prompt_version), '') is null then
    raise exception 'Invalid generated content' using errcode = '23514';
  end if;
  v_previous := jsonb_build_object(
    'title', v_item.title, 'hook', v_item.hook, 'caption', v_item.caption,
    'body', v_item.body, 'hashtags', v_item.hashtags, 'cta', v_item.cta,
    'design_brief', v_item.design_brief, 'source_refs', v_item.source_refs
  );
  v_email := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'email';
  update public.content_items set
    title = p_content ->> 'title', hook = p_content ->> 'hook',
    caption = p_content ->> 'caption', body = p_content -> 'body',
    hashtags = array(select jsonb_array_elements_text(p_content -> 'hashtags')),
    cta = p_content ->> 'cta', design_brief = p_content -> 'design_brief',
    source_refs = p_content -> 'source_refs',
    status = case when status = 'idea' then 'ready'::public.content_status else status end,
    hydrated_at = now(), generation_error = null, prompt_version = p_prompt_version,
    regenerated_count = regenerated_count + case when p_regenerate then 1 else 0 end
  where id = p_item_id returning * into v_item;
  insert into public.activity_log(content_item_id, action, actor_email, from_value, to_value)
  values (p_item_id, case when p_regenerate then 'regenerated'::public.activity_action else 'hydrated'::public.activity_action end,
    v_email, case when p_regenerate then v_previous::text else null end, p_content::text);
  return to_jsonb(v_item);
end;
$$;

create or replace function public.commit_day_items(p_date date, p_items jsonb, p_prompt_version text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_slot integer;
  v_item jsonb;
  v_ids jsonb := '[]'::jsonb;
  v_id uuid;
begin
  if p_date is null or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 2 then
    raise exception 'Invalid day generation' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(53124, p_date - date '2000-01-01');
  if (select count(*) from public.content_items where scheduled_date = p_date)
      + jsonb_array_length(p_items) > 2 then
    raise exception 'Day already has content' using errcode = '23514';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    select candidate into v_slot from generate_series(1, 2) as candidate
    where not exists (
      select 1 from public.content_items where scheduled_date = p_date and slot = candidate
    ) order by candidate limit 1;
    insert into public.content_items(scheduled_date, slot, platform, format, pillar, idea, prompt_version)
    values(p_date, v_slot, (v_item->>'platform')::public.platform,
      (v_item->>'format')::public.content_format, (v_item->>'pillar')::public.content_pillar,
      v_item->>'idea', p_prompt_version) returning id into v_id;
    v_ids := v_ids || jsonb_build_array(v_id);
  end loop;
  return jsonb_build_object('item_ids', v_ids);
end;
$$;

revoke all on function public.consume_ai_budget(integer, integer, boolean) from public, anon;
grant execute on function public.consume_ai_budget(integer, integer, boolean) to authenticated;
revoke all on function public.save_generated_item(uuid, jsonb, text, timestamptz, boolean) from public, anon;
grant execute on function public.save_generated_item(uuid, jsonb, text, timestamptz, boolean) to authenticated, service_role;
revoke all on function public.commit_day_items(date, jsonb, text) from public, anon;
grant execute on function public.commit_day_items(date, jsonb, text) to authenticated, service_role;
