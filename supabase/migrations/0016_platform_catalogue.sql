-- Platform catalogue (DATABASE.md §5.12–5.13, US-18).
--
-- Platforms move from a fixed enum and hard-coded checks to admin-managed
-- rows. The three existing platforms are seeded with today's exact rules, so
-- behaviour is unchanged until an admin edits the catalogue. Writes happen
-- only through the server's scoped admin module (service_role); members can
-- read the catalogue because generation and every screen need it.

-- ── 5.12 platforms ──────────────────────────────────────────────────────────
create table public.platforms (
  key                text         primary key,
  label              text         not null,
  is_enabled         boolean      not null default true,
  sort_order         smallint     not null default 0,
  colour_slot        smallint     not null,
  icon               text         not null,
  allows_hashtags    boolean      not null default true,
  max_hashtags       smallint     not null default 30,
  caption_max_chars  integer,
  tone               text         not null default '',
  guidance           text         not null default '',
  created_at         timestamptz  not null default now(),
  created_by         text,
  updated_at         timestamptz  not null default now(),
  updated_by         text,

  constraint platforms_key_format
    check (key ~ '^[a-z][a-z0-9_]{1,29}$'),
  constraint platforms_label_bounded
    check (label = btrim(label) and length(label) between 1 and 40),
  constraint platforms_colour_slot_range
    check (colour_slot between 1 and 8),
  constraint platforms_icon_format
    check (icon ~ '^[a-z][a-z-]{1,39}$'),
  constraint platforms_hashtag_range
    check (max_hashtags between 0 and 30 and (allows_hashtags or max_hashtags = 0)),
  constraint platforms_caption_limit_range
    check (caption_max_chars is null or caption_max_chars between 50 and 10000),
  constraint platforms_tone_bounded
    check (tone = btrim(tone) and length(tone) <= 2000),
  constraint platforms_guidance_bounded
    check (guidance = btrim(guidance) and length(guidance) <= 1000)
);

create trigger platforms_touch_updated_at
  before update on public.platforms
  for each row execute function public.touch_updated_at();

-- Keys are referenced by content and prompt history, so they never change,
-- and platforms are retired (is_enabled = false), never deleted.
create or replace function public.protect_platform_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Platforms are retired, not deleted' using errcode = '23514';
  end if;
  if new.key is distinct from old.key then
    raise exception 'Platform keys cannot change' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger platforms_protect_identity
  before update or delete on public.platforms
  for each row execute function public.protect_platform_identity();

-- ── 5.13 platform_formats ───────────────────────────────────────────────────
create table public.platform_formats (
  platform_key  text                   not null references public.platforms(key),
  format        public.content_format  not null,
  primary key (platform_key, format)
);

-- ── Seed today's platforms with their current rules (PRD §6.2–6.3) ─────────
insert into public.platforms
  (key, label, sort_order, colour_slot, icon, allows_hashtags, max_hashtags, tone)
values
  ('instagram', 'Instagram', 1, 1, 'instagram', true, 30,
    coalesce((select btrim(tone_instagram) from public.brand_profile where id = 1), '')),
  ('linkedin', 'LinkedIn', 2, 2, 'linkedin', true, 30,
    coalesce((select btrim(tone_linkedin) from public.brand_profile where id = 1), '')),
  ('whatsapp', 'WhatsApp Status', 3, 3, 'whatsapp', false, 0,
    coalesce((select btrim(tone_whatsapp) from public.brand_profile where id = 1), ''))
on conflict (key) do nothing;

insert into public.platform_formats (platform_key, format)
values
  ('instagram', 'carousel'), ('instagram', 'reel'), ('instagram', 'post'),
  ('instagram', 'story'), ('instagram', 'meme'), ('instagram', 'poll'),
  ('linkedin', 'carousel'), ('linkedin', 'post'), ('linkedin', 'poll'),
  ('whatsapp', 'story'), ('whatsapp', 'meme')
on conflict do nothing;

-- The admin "enabled platforms" filter from 0015 becomes the catalogue's
-- is_enabled flag. The old column keeps its value (unused by new code) so the
-- previous release, which still reads it, plans within the same set until the
-- catalogue-aware release is deployed (§9.3).
update public.platforms p
set is_enabled = p.key = any (
  select unnest(s.enabled_platforms)::text from public.app_settings s where s.id = 1
)
where exists (
  select 1 from public.app_settings s where s.id = 1 and s.enabled_platforms is not null
);

-- ── content_items.platform: enum → catalogue key ────────────────────────────
-- The hard-coded format and WhatsApp checks are replaced by the catalogue
-- trigger below, which enforces the same rules from data.
alter table public.content_items drop constraint content_items_format_platform_valid;
alter table public.content_items drop constraint content_items_whatsapp_no_hashtags;

alter table public.content_items
  alter column platform type text using platform::text;

alter table public.content_items
  add constraint content_items_platform_fkey
  foreign key (platform) references public.platforms(key);

-- Rules apply when a row is created or when the governed columns change, so
-- later catalogue edits never block unrelated updates to existing content.
create or replace function public.enforce_platform_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_platform public.platforms;
  v_hashtag_limit integer;
begin
  select * into v_platform from public.platforms where key = new.platform;
  if not found then
    raise exception 'Unknown platform' using errcode = '23503';
  end if;
  v_hashtag_limit := case when v_platform.allows_hashtags then v_platform.max_hashtags else 0 end;
  if tg_op = 'INSERT' and not v_platform.is_enabled then
    raise exception 'Platform is disabled' using errcode = '23514';
  end if;
  if (tg_op = 'INSERT' or new.platform is distinct from old.platform
      or new.format is distinct from old.format)
    and not exists (
      select 1 from public.platform_formats f
      where f.platform_key = new.platform and f.format = new.format
    ) then
    raise exception 'Format is not enabled for this platform' using errcode = '23514';
  end if;
  if (tg_op = 'INSERT' or new.platform is distinct from old.platform
      or new.hashtags is distinct from old.hashtags)
    and cardinality(new.hashtags) > v_hashtag_limit then
    raise exception 'Too many hashtags for this platform' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger content_items_enforce_platform_rules
  before insert or update on public.content_items
  for each row execute function public.enforce_platform_rules();

-- ── Planning writers accept any catalogue key (were enum-typed in 0012/0013) ─
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
    pillar public.content_pillar,
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
      (v_item->>'format')::public.content_format, (v_item->>'pillar')::public.content_pillar,
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

-- ── Admin writer: platform row and its formats change together ──────────────
-- Called only by the server's admin module. Planning forbids repeating a
-- platform+format on consecutive days, so two enabled pairs must remain.
create or replace function public.save_platform(
  p_platform jsonb,
  p_formats public.content_format[],
  p_create boolean,
  p_actor text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_key text := p_platform ->> 'key';
begin
  if p_create is null or p_formats is null or cardinality(p_formats) = 0 then
    raise exception 'A platform needs at least one format' using errcode = '23514';
  end if;
  if p_create then
    insert into public.platforms (
      key, label, is_enabled, sort_order, colour_slot, icon, allows_hashtags,
      max_hashtags, caption_max_chars, tone, guidance, created_by, updated_by
    ) values (
      v_key, p_platform ->> 'label', (p_platform ->> 'is_enabled')::boolean,
      coalesce((select max(sort_order) from public.platforms), 0) + 1,
      (p_platform ->> 'colour_slot')::smallint, p_platform ->> 'icon',
      (p_platform ->> 'allows_hashtags')::boolean,
      (p_platform ->> 'max_hashtags')::smallint,
      (p_platform ->> 'caption_max_chars')::integer,
      p_platform ->> 'tone', p_platform ->> 'guidance', p_actor, p_actor
    );
  else
    update public.platforms set
      label = p_platform ->> 'label',
      is_enabled = (p_platform ->> 'is_enabled')::boolean,
      colour_slot = (p_platform ->> 'colour_slot')::smallint,
      icon = p_platform ->> 'icon',
      allows_hashtags = (p_platform ->> 'allows_hashtags')::boolean,
      max_hashtags = (p_platform ->> 'max_hashtags')::smallint,
      caption_max_chars = (p_platform ->> 'caption_max_chars')::integer,
      tone = p_platform ->> 'tone',
      guidance = p_platform ->> 'guidance',
      updated_by = p_actor
    where key = v_key;
    if not found then
      raise exception 'Unknown platform' using errcode = '23514';
    end if;
    delete from public.platform_formats
    where platform_key = v_key and format <> all (p_formats);
  end if;
  insert into public.platform_formats (platform_key, format)
  select v_key, chosen.format from unnest(p_formats) as chosen(format)
  on conflict do nothing;
  if (
    select count(*) from public.platform_formats f
    join public.platforms p on p.key = f.platform_key
    where p.is_enabled
  ) < 2 then
    raise exception 'At least two enabled platform formats are required' using errcode = '23514';
  end if;
  return jsonb_build_object('key', v_key);
end;
$$;

revoke all on function public.save_platform(jsonb, public.content_format[], boolean, text)
  from public, anon, authenticated;
grant execute on function public.save_platform(jsonb, public.content_format[], boolean, text)
  to service_role;

-- ── RLS (§7.3) ──────────────────────────────────────────────────────────────
alter table public.platforms enable row level security;

create policy platforms_select
  on public.platforms for select
  to authenticated
  using (true);

alter table public.platform_formats enable row level security;

create policy platform_formats_select
  on public.platform_formats for select
  to authenticated
  using (true);

-- Trigger functions are never called directly.
revoke all on function public.protect_platform_identity() from public, anon, authenticated;
revoke all on function public.enforce_platform_rules() from public, anon, authenticated;
