-- DATABASE.md §6.3. Seven indexes, derived from the queries the PRD §7
-- journeys actually generate. Nothing speculative — see §6.4 for what is
-- deliberately absent.

-- Q3: the hydration queue. Partial, so it indexes only pending work
-- and shrinks to near-zero rows once a month is fully hydrated.
create index idx_content_items_hydration_queue
  on public.content_items (scheduled_date)
  where status = 'idea';

-- Q4: the designer's work queue (Create screen).
create index idx_content_items_work_queue
  on public.content_items (scheduled_date)
  where status in ('idea', 'ready');

-- Q5, Q6: archive listing and the 60-day anti-repetition lookback.
create index idx_content_items_posted
  on public.content_items (posted_at desc)
  where status = 'posted';

-- Q7: news grounding, newest first. NULLS LAST because published_at
-- is nullable when a feed omits a date.
create index idx_news_items_published
  on public.news_items (published_at desc nulls last);

-- Q10: audit trail for a single item.
create index idx_activity_log_item
  on public.activity_log (content_item_id, created_at desc);

-- Q11: the Settings run log.
create index idx_generation_runs_recent
  on public.generation_runs (started_at desc);

-- FK support: avoids a sequential scan when a content_plans row is
-- deleted and plan_id must be nulled across items.
create index idx_content_items_plan
  on public.content_items (plan_id)
  where plan_id is not null;
