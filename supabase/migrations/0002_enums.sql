-- DATABASE.md §4. Native enums so the Supabase CLI emits string-literal unions.
-- Adding a value later requires its own migration file containing only
-- `alter type ... add value`.

create type public.platform as enum ('instagram', 'linkedin', 'whatsapp');

create type public.content_format as enum (
  'carousel', 'reel', 'post', 'story', 'meme', 'poll'
);

create type public.content_pillar as enum (
  'salesforce_tips', 'salesforce_news', 'memes', 'interview_questions',
  'success_stories', 'course_promos', 'career_guidance',
  'behind_the_scenes', 'myth_busting', 'polls_engagement'
);

create type public.content_status as enum ('idea', 'ready', 'posted', 'skipped');

create type public.plan_status as enum (
  'pending', 'generating', 'complete', 'failed'
);

create type public.run_kind as enum (
  'month_skeleton', 'item_hydration', 'item_regeneration', 'daily_tip', 'news_ingest'
);

create type public.run_status as enum ('running', 'success', 'partial', 'failed');

create type public.activity_action as enum (
  'created', 'hydrated', 'regenerated', 'status_changed', 'note_added'
);
