-- DATABASE.md §7.4, §7.6, §7.7.

-- updated_at maintenance (brand_profile, content_items)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Status transitions, per PRD §13.
-- Legal: idea→ready, ready→posted, idea|ready→skipped,
--        posted→ready (un-tick), skipped→ready.
-- A CHECK constraint cannot express this because it cannot see OLD.
create or replace function public.enforce_status_transition()
returns trigger language plpgsql as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'idea'    and new.status in ('ready', 'skipped')) or
    (old.status = 'ready'   and new.status in ('posted', 'skipped')) or
    (old.status = 'posted'  and new.status = 'ready') or
    (old.status = 'skipped' and new.status = 'ready')
  ) then
    raise exception 'illegal status transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

-- Posted items are immutable with respect to content (FR-2.7, PRD §13).
-- Notes are appended to activity_log, never written back onto the item.
create or replace function public.protect_posted_content()
returns trigger language plpgsql as $$
begin
  if old.status = 'posted' and new.status = 'posted' and (
       new.hook         is distinct from old.hook
    or new.caption      is distinct from old.caption
    or new.body         is distinct from old.body
    or new.hashtags     is distinct from old.hashtags
    or new.cta          is distinct from old.cta
    or new.design_brief is distinct from old.design_brief
    or new.source_refs  is distinct from old.source_refs
  ) then
    raise exception 'content of a posted item cannot be modified';
  end if;
  return new;
end;
$$;

-- Append-only layer 2: binds service_role and superusers, which RLS does not.
create or replace function public.reject_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'activity_log is append-only: % is not permitted', tg_op;
end;
$$;

-- Atomic by construction: the read, comparison and increment are one
-- statement, so concurrent callers cannot both pass a limit of one.
-- `set search_path = ''` is mandatory on every SECURITY DEFINER function.
create or replace function public.consume_rate_limit(
  p_actor_key    text,
  p_action_key   text,
  p_window_start timestamptz,
  p_limit        integer
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  insert into public.rate_limits (actor_key, action_key, window_start, count)
  values (p_actor_key, p_action_key, p_window_start, 1)
  on conflict (actor_key, action_key, window_start) do update
    set count = public.rate_limits.count + 1,
        updated_at = now()
    where public.rate_limits.count < p_limit
  returning true;
$$;
