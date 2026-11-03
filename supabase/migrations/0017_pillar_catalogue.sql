-- Pillar catalogue (DATABASE.md §5.14, US-19).
--
-- Content pillars move from a fixed enum and the hard-coded salesforce_news
-- rule to admin-managed rows. Today's ten pillars are seeded with their PRD
-- §6.1 intents and current behaviour, so nothing changes until an admin edits
-- the catalogue. Writes happen only through the server's scoped admin module
-- (service_role); members read the catalogue because planning, generation and
-- every screen need it.

-- ── 5.14 pillars ────────────────────────────────────────────────────────────
create table public.pillars (
  key            text         primary key,
  label          text         not null,
  description    text         not null,
  guidance       text         not null default '',
  requires_news  boolean      not null default false,
  is_enabled     boolean      not null default true,
  sort_order     smallint     not null default 0,
  created_at     timestamptz  not null default now(),
  created_by     text,
  updated_at     timestamptz  not null default now(),
  updated_by     text,

  constraint pillars_key_format
    check (key ~ '^[a-z][a-z0-9_]{1,29}$'),
  constraint pillars_label_bounded
    check (label = btrim(label) and length(label) between 1 and 30),
  constraint pillars_description_bounded
    check (description = btrim(description) and length(description) between 1 and 300),
  constraint pillars_guidance_bounded
    check (guidance = btrim(guidance) and length(guidance) <= 1000)
);

create trigger pillars_touch_updated_at
  before update on public.pillars
  for each row execute function public.touch_updated_at();

-- Keys are stored on content and in pillar history, so they never change;
-- pillars are retired (is_enabled = false), never deleted.
create or replace function public.protect_pillar_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Pillars are retired, not deleted' using errcode = '23514';
  end if;
  if new.key is distinct from old.key then
    raise exception 'Pillar keys cannot change' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger pillars_protect_identity
  before update or delete on public.pillars
  for each row execute function public.protect_pillar_identity();

-- ── Seed today's pillars (PRD §6.1) ─────────────────────────────────────────
insert into public.pillars (key, label, description, requires_news, sort_order)
values
  ('salesforce_tips', 'Tips', 'Teach something small and useful', false, 1),
  ('salesforce_news', 'News', 'Releases, features, deprecations', true, 2),
  ('memes', 'Meme', 'Relatable humour, reach driver', false, 3),
  ('interview_questions', 'Interview', 'Interview prep value', false, 4),
  ('success_stories', 'Success', 'Placement and student wins', false, 5),
  ('course_promos', 'Promo', 'Batch launches, offers', false, 6),
  ('career_guidance', 'Career', 'Advice for freshers/switchers', false, 7),
  ('behind_the_scenes', 'BTS', 'Trainer POV, classroom moments', false, 8),
  ('myth_busting', 'Myths', 'Correct common misconceptions', false, 9),
  ('polls_engagement', 'Poll', 'Deliberate engagement bait', false, 10)
on conflict (key) do nothing;

-- The admin "enabled pillars" filter from 0015 becomes the catalogue's
-- is_enabled flag. The old column keeps its value (unused by new code) so the
-- previous release, which still reads it, plans within the same set until the
-- catalogue-aware release is deployed (§9.3).
update public.pillars p
set is_enabled = p.key = any (
  select unnest(s.enabled_pillars)::text from public.app_settings s where s.id = 1
)
where exists (
  select 1 from public.app_settings s where s.id = 1 and s.enabled_pillars is not null
);

-- Transitional: until the catalogue-aware release is deployed, the previous
-- release's Admin → Filters page still writes enabled_pillars. Mirror those
-- writes onto the seeded pillars so its planner and this trigger agree, and no
-- change made in that window is lost. The new release never writes the
-- column, so this stays inert afterwards; a later migration may drop it.
create or replace function public.sync_legacy_enabled_pillars()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.pillars p
  set is_enabled = new.enabled_pillars is null
    or p.key = any (select unnest(new.enabled_pillars)::text)
  where p.key in (select unnest(enum_range(null::public.content_pillar))::text);
  return new;
end;
$$;

create trigger app_settings_sync_legacy_enabled_pillars
  after update of enabled_pillars on public.app_settings
  for each row
  when (new.enabled_pillars is distinct from old.enabled_pillars)
  execute function public.sync_legacy_enabled_pillars();

-- ── content_items.pillar: enum → catalogue key ──────────────────────────────
-- The hard-coded salesforce_news sourcing check is replaced by the catalogue
-- trigger below, which applies the same rule to every requires_news pillar.
alter table public.content_items drop constraint content_items_news_requires_sources;

alter table public.content_items
  alter column pillar type text using pillar::text;

alter table public.content_items
  add constraint content_items_pillar_fkey
  foreign key (pillar) references public.pillars(key);

-- Rules apply when a row is created or when the governed columns change, so
-- later catalogue edits never block unrelated updates to existing content.
create or replace function public.enforce_pillar_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_pillar public.pillars;
begin
  select * into v_pillar from public.pillars where key = new.pillar;
  if not found then
    raise exception 'Unknown pillar' using errcode = '23503';
  end if;
  if tg_op = 'INSERT' and not v_pillar.is_enabled then
    raise exception 'Pillar is disabled' using errcode = '23514';
  end if;
  -- News must be sourced (FR-3.5, US-12, risk R2) once content is usable.
  if v_pillar.requires_news
    and new.status not in ('idea', 'skipped')
    and jsonb_array_length(new.source_refs) = 0
    and (tg_op = 'INSERT'
      or new.pillar is distinct from old.pillar
      or new.source_refs is distinct from old.source_refs
      or old.status in ('idea', 'skipped')) then
    raise exception 'News content requires a source' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger content_items_enforce_pillar_rules
  before insert or update on public.content_items
  for each row execute function public.enforce_pillar_rules();

-- ── Planning writers accept any catalogue pillar (were enum-typed) ──────────
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
    platform text,
    format public.content_format,
    pillar text,
    idea text
  );
  get diagnostics v_count = row_count;

  return jsonb_build_object('plan_id', v_plan_id, 'item_count', v_count);
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
    values(p_date, v_slot, v_item->>'platform',
      (v_item->>'format')::public.content_format, v_item->>'pillar',
      v_item->>'idea', p_prompt_version) returning id into v_id;
    v_ids := v_ids || jsonb_build_array(v_id);
  end loop;
  return jsonb_build_object('item_ids', v_ids);
end;
$$;

revoke all on function public.commit_month_plan(date, jsonb, text, text) from public, anon;
grant execute on function public.commit_month_plan(date, jsonb, text, text) to authenticated, service_role;
revoke all on function public.commit_day_items(date, jsonb, text) from public, anon;
grant execute on function public.commit_day_items(date, jsonb, text) to authenticated, service_role;

-- ── Admin writer ────────────────────────────────────────────────────────────
-- Called only by the server's admin module. Plannability (ARCHITECTURE.md
-- §4.4): three enabled pillars that do not need news keep the no-adjacent-
-- repeat rule satisfiable when news is absent, and at most fourteen enabled
-- pillars can each appear twice even in February at one item per day.
create or replace function public.save_pillar(
  p_pillar jsonb,
  p_create boolean,
  p_actor text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_key text := p_pillar ->> 'key';
begin
  if p_create is null then
    raise exception 'Invalid pillar save' using errcode = '23514';
  end if;
  if p_create then
    insert into public.pillars (
      key, label, description, guidance, requires_news, is_enabled,
      sort_order, created_by, updated_by
    ) values (
      v_key, p_pillar ->> 'label', p_pillar ->> 'description',
      p_pillar ->> 'guidance', (p_pillar ->> 'requires_news')::boolean,
      (p_pillar ->> 'is_enabled')::boolean,
      coalesce((select max(sort_order) from public.pillars), 0) + 1,
      p_actor, p_actor
    );
  else
    update public.pillars set
      label = p_pillar ->> 'label',
      description = p_pillar ->> 'description',
      guidance = p_pillar ->> 'guidance',
      requires_news = (p_pillar ->> 'requires_news')::boolean,
      is_enabled = (p_pillar ->> 'is_enabled')::boolean,
      updated_by = p_actor
    where key = v_key;
    if not found then
      raise exception 'Unknown pillar' using errcode = '23514';
    end if;
  end if;
  if (select count(*) from public.pillars where is_enabled and not requires_news) < 3 then
    raise exception 'At least three enabled pillars that do not need news are required'
      using errcode = '23514';
  end if;
  if (select count(*) from public.pillars where is_enabled) > 14 then
    raise exception 'At most fourteen pillars can be enabled' using errcode = '23514';
  end if;
  return jsonb_build_object('key', v_key);
end;
$$;

revoke all on function public.save_pillar(jsonb, boolean, text)
  from public, anon, authenticated;
grant execute on function public.save_pillar(jsonb, boolean, text)
  to service_role;

-- ── RLS (§7.3) ──────────────────────────────────────────────────────────────
alter table public.pillars enable row level security;

create policy pillars_select
  on public.pillars for select
  to authenticated
  using (true);

-- Trigger functions are never called directly.
revoke all on function public.protect_pillar_identity() from public, anon, authenticated;
revoke all on function public.enforce_pillar_rules() from public, anon, authenticated;
revoke all on function public.sync_legacy_enabled_pillars() from public, anon, authenticated;
