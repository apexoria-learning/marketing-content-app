-- Development seed — DATABASE.md §9.4, IMPLEMENTATION-PLAN Task 2.10.
--
-- NEVER applied to production. Applied by `supabase db reset`.
--
-- The window is anchored to `current_date` (today − 21 … today + 9) rather than
-- to fixed calendar dates, so the fixture stays browsable forever and every
-- edge case below is guaranteed regardless of when it is seeded:
--
--   overdue unposted item   offsets −6 (ready) and −4 (idea)
--   empty day               offset +3
--   two-item day            offsets −17 and 0
--   skipped item            offset −10
--   un-hydrated `idea`      offsets −4 and +5 … +9
--   sourceless non-news     every non-news item (only news requires sources)
--
-- Coverage: all 3 platforms, all 6 formats, all 10 pillars, all 4 statuses.

-- ── news_items: grounding data (FR-3) ───────────────────────────────────────
insert into public.news_items (source, title, url, url_hash, published_at, summary)
select
  source,
  title,
  url,
  encode(sha256(convert_to(url, 'UTF8')), 'hex'),
  current_date - (offset_days || ' days')::interval,
  summary
from (values
  ('Salesforce Release Notes', 'Spring ''26 Release Notes: Flow Builder enhancements', 'https://help.salesforce.com/s/articleView?id=release-notes.spring26_flow.htm', 3, 'Flow Builder adds new debugging and error-handling capabilities in the Spring release.'),
  ('Salesforce Developers', 'Lightning Web Components: new wire adapter patterns', 'https://developer.salesforce.com/blogs/2026/01/lwc-wire-adapter-patterns', 5, 'Guidance on composing wire adapters for cleaner LWC data access.'),
  ('Salesforce Admins', 'Five Flow mistakes that slow down your org', 'https://admin.salesforce.com/blog/2026/five-flow-mistakes', 7, 'Common Flow anti-patterns and how admins can avoid them.'),
  ('Salesforce Release Notes', 'Apex: deprecation timeline for legacy API versions', 'https://help.salesforce.com/s/articleView?id=release-notes.apex_api_deprecation.htm', 9, 'Older REST and SOAP API versions are being retired on a published schedule.'),
  ('Salesforce Developers', 'Getting started with Agentforce for developers', 'https://developer.salesforce.com/blogs/2026/02/agentforce-getting-started', 11, 'An introduction to building agent actions on the Salesforce platform.'),
  ('Salesforce Admins', 'Permission sets vs profiles: the current guidance', 'https://admin.salesforce.com/blog/2026/permission-sets-vs-profiles', 13, 'Salesforce continues to steer orgs away from profile-based permissions.'),
  ('Salesforce Developers', 'SOQL performance: selective filters explained', 'https://developer.salesforce.com/blogs/2026/02/soql-selective-filters', 15, 'How query selectivity affects large data volume performance.'),
  ('Salesforce Release Notes', 'Summer ''26 preview: Data Cloud updates', 'https://help.salesforce.com/s/articleView?id=release-notes.summer26_data_cloud.htm', 17, 'Data Cloud gains new ingestion connectors and identity resolution controls.'),
  ('Salesforce Developers', 'Testing Apex triggers without hitting governor limits', 'https://developer.salesforce.com/blogs/2026/03/apex-trigger-testing', 19, 'Patterns for bulk-safe Apex test data creation.'),
  ('Salesforce Admins', 'Validation rules that users do not hate', 'https://admin.salesforce.com/blog/2026/validation-rules-ux', 21, 'Writing validation rules with clear, actionable error messages.'),
  ('Salesforce Developers', 'Integration patterns: platform events vs outbound messages', 'https://developer.salesforce.com/blogs/2026/03/integration-patterns', 23, 'Choosing between event-driven and point-to-point integration.'),
  ('Salesforce Release Notes', 'Lightning Experience: record page performance changes', 'https://help.salesforce.com/s/articleView?id=release-notes.lex_record_perf.htm', 25, 'Record page rendering improvements and their migration notes.'),
  ('Salesforce Admins', 'Reports and dashboards: subscription limits update', 'https://admin.salesforce.com/blog/2026/report-subscription-limits', 27, 'Changes to how many report subscriptions a user can hold.'),
  ('Salesforce Developers', 'Apex security: enforcing CRUD and FLS correctly', 'https://developer.salesforce.com/blogs/2026/04/apex-crud-fls', 29, 'Using WITH SECURITY_ENFORCED and Security.stripInaccessible.'),
  ('Salesforce Developers', 'LWC local development workflow in 2026', 'https://developer.salesforce.com/blogs/2026/04/lwc-local-dev', 31, 'A faster inner loop for Lightning Web Component development.'),
  ('Salesforce Admins', 'Sandbox refresh strategy for small teams', 'https://admin.salesforce.com/blog/2026/sandbox-refresh-strategy', 33, 'How often to refresh sandboxes without losing configuration work.'),
  ('Salesforce Release Notes', 'MFA enforcement: what changes for admins', 'https://help.salesforce.com/s/articleView?id=release-notes.mfa_enforcement.htm', 35, 'Multi-factor authentication requirements and admin responsibilities.'),
  ('Salesforce Developers', 'Bulk API 2.0: when to prefer it over Batch Apex', 'https://developer.salesforce.com/blogs/2026/05/bulk-api-vs-batch-apex', 37, 'Trade-offs between Bulk API 2.0 and Batch Apex for large loads.'),
  ('Salesforce Admins', 'Dynamic forms rollout checklist', 'https://admin.salesforce.com/blog/2026/dynamic-forms-checklist', 39, 'Steps to migrate record pages to dynamic forms safely.'),
  ('Salesforce Developers', 'Writing Apex that is easy to interview on', 'https://developer.salesforce.com/blogs/2026/05/readable-apex', 41, 'Readable Apex patterns that also happen to be interview favourites.')
) as n(source, title, url, offset_days, summary)
on conflict (url_hash) do nothing;

-- ── daily_tips: 30 days of internal marketing advice (D10, FR-4) ────────────
insert into public.daily_tips (tip_date, tip, category, prompt_version)
select
  current_date - 25 + (n - 1),
  tip,
  category,
  'seed-v1'
from (values
  (1,  'Post the hook before you post the lesson. If the first line does not stop a thumb, the rest is unread.', 'hooks'),
  (2,  'Reply to every comment within the first hour. Early engagement is what the algorithm actually rewards.', 'engagement'),
  (3,  'A carousel that teaches one thing well beats one that teaches five things badly.', 'format'),
  (4,  'Screenshot real Salesforce screens. Stock imagery reads as "we have never opened this product".', 'visuals'),
  (5,  'Ask a question you genuinely want answered. Fake engagement bait is obvious and it ages badly.', 'engagement'),
  (6,  'Name the audience in the first line. "If you are switching into Salesforce" outperforms "Hey everyone".', 'hooks'),
  (7,  'Reels: the first three seconds carry the entire video. Shoot them last, when you know the payoff.', 'format'),
  (8,  'Placement stories convert best when they include the boring middle, not just the offer letter.', 'proof'),
  (9,  'LinkedIn rewards dwell time. Short paragraphs and line breaks keep people on the post.', 'linkedin'),
  (10, 'One call to action per post. Two options is the same as none.', 'cta'),
  (11, 'Save-worthy beats like-worthy. Checklists and cheat sheets get saved and resurfaced.', 'format'),
  (12, 'Post when your learners are commuting, not when your team is free.', 'timing'),
  (13, 'Repurpose a strong carousel into a reel two weeks later. Reach does not overlap as much as you think.', 'repurposing'),
  (14, 'Never claim a Salesforce fact without a source link. Technical audiences fact-check instantly.', 'credibility'),
  (15, 'Memes earn reach; tips earn trust. You need both in the same week.', 'mix'),
  (16, 'A poll is research, not filler. Use the answers in next month''s content.', 'engagement'),
  (17, 'Show the trainer''s face at least once a week. People enrol with a person, not a logo.', 'brand'),
  (18, 'Write the caption as if one specific learner asked you the question.', 'voice'),
  (19, 'Consistency beats brilliance. Three good posts a week outperform one great post a month.', 'cadence'),
  (20, 'Put the keyword in the first 125 characters so the truncated preview still makes sense.', 'copywriting'),
  (21, 'Interview-question posts are the highest-intent content you publish. Make them specific.', 'topics'),
  (22, 'Do not bury the course mention. If a post is a promo, say so in the first line.', 'promos'),
  (23, 'Comment on other Salesforce creators'' posts. Distribution is a relationship, not a feature.', 'growth'),
  (24, 'Batch-produce designs on one day. Context switching is what kills posting consistency.', 'operations'),
  (25, 'Track which pillar drove saves, not just likes. Saves predict enrolment interest.', 'measurement'),
  (26, 'Pin the post that best explains who you teach and what happens after.', 'profile'),
  (27, 'Use WhatsApp Status for batch reminders only. Treat it as a channel, not a billboard.', 'whatsapp'),
  (28, 'Rewrite one underperforming old post each week rather than always starting blank.', 'repurposing'),
  (29, 'If a myth-busting post makes someone defensive, it was worth posting. Keep it factual.', 'topics'),
  (30, 'End the week by marking everything posted. The archive is only useful if it is honest.', 'operations')
) as t(n, tip, category)
on conflict (tip_date) do nothing;

-- ── content_plans: the month that owns the seeded items ─────────────────────
insert into public.content_plans (plan_month, status, model, prompt_version, generated_at)
values (
  date_trunc('month', current_date)::date,
  'complete',
  'claude-sonnet-4',
  'seed-v1',
  now() - interval '20 days'
)
on conflict (plan_month) do nothing;

-- ── content_items ───────────────────────────────────────────────────────────
with spec(
  day_offset, slot, platform, format, pillar, status, idea, hook, caption, cta
) as (
  values
    (-21, 1, 'instagram', 'carousel', 'salesforce_tips',     'posted',  'Five SOQL habits that keep queries selective', 'Your SOQL is slow for one boring reason', E'Selective filters are the whole game.\n\nIndexed field in the WHERE clause. No leading wildcards. No negative operators on big objects.\n\nSwipe for the five habits that fixed every slow query I have reviewed this month.', 'Save this for your next code review'),
    (-20, 1, 'linkedin',  'post',     'career_guidance',      'posted',  'Why non-IT graduates do well in Salesforce', 'The best Salesforce admins I have trained were not developers', E'Three of the last five learners I placed came from non-IT backgrounds.\n\nWhat they had in common was not coding. It was patience with process, and a willingness to ask the business what it actually needs.\n\nSalesforce rewards that more than most tech careers do.', 'What changed your mind about switching?'),
    (-19, 1, 'instagram', 'reel',     'memes',                'posted',  'POV: the deploy fails on validation rules', 'POV: your deploy fails at 97%', E'Every. Single. Time. 😮‍💨\n\nTag the teammate who owns that validation rule.', 'Tag them, we both know who'),
    (-18, 1, 'whatsapp',  'story',    'course_promos',        'posted',  'New Salesforce Foundation batch starting', 'New Foundation batch opens this week', E'Live online, beginner friendly, placement support included.\n\nReply here if you want the schedule.', 'Reply for the schedule'),
    (-17, 1, 'linkedin',  'carousel', 'interview_questions',  'posted',  'Ten Apex trigger interview questions', 'Ten Apex trigger questions I ask in every mock interview', E'If you can answer these without notes, you are interview-ready on triggers.\n\nSwipe through. Answers in the comments.', 'Which one would catch you out?'),
    (-17, 2, 'instagram', 'meme',     'memes',                'posted',  'Governor limits meme', 'Me explaining governor limits to myself at 2am', E'101 SOQL queries walk into a for loop. 🙃', 'Save it for the next code review'),
    (-16, 1, 'instagram', 'post',     'success_stories',      'posted',  'A recent learner moved from support to Salesforce QA', 'From BPO support to Salesforce QA in seven months', E'A recent learner from Pune finished the QA track, built two portfolio projects, and cleared three rounds last week.\n\nNo CS degree. No prior automation experience.', 'DM "QA" for the track details'),
    (-15, 1, 'linkedin',  'poll',     'polls_engagement',     'posted',  'Poll on the hardest Salesforce topic', 'Which Salesforce topic broke your brain first?', E'Genuinely curious — I will build next month''s free session around whichever wins.', 'Vote and tell me why'),
    (-14, 1, 'instagram', 'carousel', 'myth_busting',         'posted',  'Myth: you need to code to work in Salesforce', 'No, you do not need to code to get a Salesforce job', E'The Admin track exists. Flow exists. Config-first roles are real and they pay.\n\nSwipe for what each track actually requires.', 'Send this to someone who is stalling'),
    (-13, 1, 'whatsapp',  'meme',     'memes',                'posted',  'Sandbox refresh meme for the batch group', 'When someone refreshes the sandbox on a Friday', E'Please do not. 🙏', 'See you in class'),
    (-12, 1, 'instagram', 'reel',     'behind_the_scenes',    'posted',  'Inside a live cohort session', 'What a live cohort actually looks like', E'No recordings on loop. Cameras on, questions interrupting, code reviewed live.\n\nThis is a Tuesday.', 'Come sit in on a session'),
    (-11, 1, 'linkedin',  'post',     'salesforce_news',      'posted',  'Legacy API version deprecation timeline', 'Salesforce published the retirement schedule for legacy API versions', E'If your org still calls older REST or SOAP versions, this is the quarter to audit it.\n\nCheck every integration user and every managed package before the cutoff.', 'Audit your integrations this week'),
    (-10, 1, 'instagram', 'story',    'course_promos',        'skipped', 'Weekend offer story — pulled, offer not confirmed', null, null, null),
    ( -9, 1, 'instagram', 'carousel', 'salesforce_tips',      'posted',  'Permission sets over profiles', 'Stop putting permissions on profiles', E'Salesforce has been pointing one direction for years now.\n\nSwipe for the migration order that does not break anyone''s access.', 'Save for your next org cleanup'),
    ( -8, 1, 'linkedin',  'carousel', 'salesforce_news',      'posted',  'Spring release Flow Builder enhancements', 'Flow Builder just got meaningfully better at errors', E'The Spring release adds debugging and error-handling that removes most of the guesswork.\n\nSwipe for the three changes that matter if you build Flows weekly.', 'Which one will you use first?'),
    ( -7, 1, 'instagram', 'poll',     'polls_engagement',     'posted',  'Admin or Developer track poll', 'Admin or Developer — which should a fresher start with?', E'I have an opinion. I want yours first.', 'Vote, then read the comments'),
    ( -6, 1, 'instagram', 'reel',     'interview_questions',  'ready',   'Three questions that end a Salesforce interview', 'Three questions that end an interview early', E'Get these wrong and the call is over. 😬\n\nSave this before your next round.', 'Save it, you will need it'),
    ( -5, 1, 'whatsapp',  'story',    'behind_the_scenes',    'posted',  'Batch project demo day reminder', 'Demo day for the current batch is tomorrow', E'Projects get reviewed live, on camera, by the trainer.\n\nBe there ten minutes early.', 'See you tomorrow'),
    ( -4, 1, 'linkedin',  'post',     'career_guidance',      'idea',    'How to explain a career gap in a Salesforce interview', null, null, null),
    ( -3, 1, 'instagram', 'meme',     'memes',                'posted',  'Trailhead badge collector meme', 'Me: 140 Trailhead badges. Also me: cannot write a trigger', E'Badges are a map, not the journey. 🗺️', 'Build something this week'),
    ( -2, 1, 'linkedin',  'carousel', 'myth_busting',         'posted',  'Myth: certifications alone get you hired', 'A certification did not get you the job. The project did.', E'Certs get you past the filter. Portfolio projects get you through the interview.\n\nSwipe for what a hiring manager actually opens first.', 'What is in your portfolio?'),
    ( -1, 1, 'instagram', 'post',     'success_stories',      'posted',  'Learner cleared Developer interview', 'Seven months ago he had never written Apex', E'A recent learner from Hyderabad cleared his Developer rounds last Friday.\n\nTwo portfolio projects, one referral, zero shortcuts.', 'DM "Developer" for the track'),
    (  0, 1, 'instagram', 'carousel', 'salesforce_tips',      'ready',   'Apex trigger patterns that scale', 'One trigger per object. Still the rule.', E'Handler classes. Bulk-safe logic. No SOQL in loops.\n\nSwipe for the pattern I make every cohort rewrite until it is automatic.', 'Save this before your next build'),
    (  0, 2, 'linkedin',  'post',     'salesforce_news',      'ready',   'Apex CRUD and FLS enforcement guidance', 'Most Apex I review still skips FLS checks', E'WITH SECURITY_ENFORCED and Security.stripInaccessible exist for a reason.\n\nIf your Apex runs in user context and skips both, you have a security bug, not a style problem.', 'Audit one class today'),
    (  1, 1, 'instagram', 'reel',     'memes',                'ready',   'When the client asks for one small change', 'Client: just one small change', E'The change: rebuild the data model. 🫠', 'Tag your project lead'),
    (  2, 1, 'linkedin',  'poll',     'polls_engagement',     'ready',   'Poll on integration patterns', 'Platform events or outbound messages?', E'Both ship. Only one scales the way most teams assume.', 'Vote and defend it in the comments'),
    (  4, 1, 'whatsapp',  'meme',     'memes',                'ready',   'Monday batch energy meme', 'Monday batch, 7am, cameras on', E'We respect the grind. ☕', 'See you in class'),
    (  5, 1, 'instagram', 'carousel', 'interview_questions',  'idea',    'LWC interview questions for freshers', null, null, null),
    (  6, 1, 'linkedin',  'post',     'course_promos',        'idea',    'Next Complete Course cohort announcement', null, null, null),
    (  7, 1, 'instagram', 'story',    'behind_the_scenes',    'idea',    'Trainer desk setup story', null, null, null),
    (  8, 1, 'linkedin',  'carousel', 'career_guidance',      'idea',    'First 90 days in a Salesforce job', null, null, null),
    (  9, 1, 'instagram', 'post',     'success_stories',      'idea',    'Placement round-up for the quarter', null, null, null)
),
resolved as (
  select
    s.*,
    (current_date + s.day_offset)                        as scheduled_date,
    s.status in ('ready', 'posted')                      as is_hydrated,
    s.pillar = 'salesforce_news'                         as is_news
  from spec s
)
insert into public.content_items (
  plan_id, scheduled_date, slot, platform, format, pillar, idea,
  title, hook, caption, body, hashtags, cta, design_brief, source_refs,
  status, posted_at, posted_by, skip_reason,
  prompt_version, hydrated_at
)
select
  p.id,
  r.scheduled_date,
  r.slot,
  r.platform::public.platform,
  r.format::public.content_format,
  r.pillar::public.content_pillar,
  r.idea,
  case when r.is_hydrated then r.idea end,
  r.hook,
  r.caption,

  -- Format-specific payload shapes (PRD §6.2).
  case
    when not r.is_hydrated then null
    when r.format = 'carousel' then jsonb_build_object(
      'slides', jsonb_build_array(
        jsonb_build_object('index', 1, 'headline', r.hook, 'body', 'Cover slide. Hook only, no body copy.', 'visual_note', 'Full-bleed type, no image.'),
        jsonb_build_object('index', 2, 'headline', 'The problem', 'body', 'Name the mistake the learner is making right now.', 'visual_note', 'Single screenshot, annotated.'),
        jsonb_build_object('index', 3, 'headline', 'Why it happens', 'body', 'One paragraph of plain-language cause.', 'visual_note', null),
        jsonb_build_object('index', 4, 'headline', 'The fix', 'body', 'Concrete steps, numbered, in order.', 'visual_note', 'Code block, monospace.'),
        jsonb_build_object('index', 5, 'headline', 'Try it today', 'body', r.cta, 'visual_note', 'Brand lockup bottom right.')
      )
    )
    when r.format = 'reel' then jsonb_build_object(
      'duration_seconds', 28,
      'scenes', jsonb_build_array(
        jsonb_build_object('from', '0:00', 'to', '0:03', 'action', 'Hard cut to trainer, mid-sentence.', 'on_screen_text', r.hook),
        jsonb_build_object('from', '0:03', 'to', '0:12', 'action', 'Screen recording of the problem.', 'on_screen_text', 'This is the bit that breaks'),
        jsonb_build_object('from', '0:12', 'to', '0:24', 'action', 'Walk through the fix on screen.', 'on_screen_text', 'Do this instead'),
        jsonb_build_object('from', '0:24', 'to', '0:28', 'action', 'Back to camera for the CTA.', 'on_screen_text', r.cta)
      ),
      'audio', 'Trending upbeat track, ducked under voiceover.'
    )
    when r.format = 'post' then jsonb_build_object(
      'visual_concept', 'Single frame: bold statement type over a dark editorial background, brand gold underline on the key phrase.'
    )
    when r.format = 'story' then jsonb_build_object(
      'frame', r.caption,
      'interaction_prompt', r.cta
    )
    when r.format = 'meme' then jsonb_build_object(
      'template', 'Two-panel reaction format, widely recognised.',
      'top_text', r.hook,
      'bottom_text', r.caption
    )
    when r.format = 'poll' then jsonb_build_object(
      'question', r.hook,
      'options', jsonb_build_array('Admin track', 'Developer track', 'QA track', 'Still deciding')
    )
  end,

  -- Instagram 8-15 tags, LinkedIn 3-5, WhatsApp none (PRD §6.3).
  case
    when not r.is_hydrated then '{}'::text[]
    when r.platform = 'instagram' then array[
      '#salesforce', '#salesforceadmin', '#salesforcedeveloper', '#apex',
      '#lwc', '#trailhead', '#salesforcetraining', '#techcareers',
      '#careerswitch', '#salesforcejobs'
    ]
    when r.platform = 'linkedin' then array[
      '#Salesforce', '#SalesforceDeveloper', '#CareerChange', '#Hiring'
    ]
    else '{}'::text[]
  end,

  r.cta,

  -- Fixed subsection order so designers learn the shape (DESIGN.md §6.3).
  case when r.is_hydrated then jsonb_build_object(
    'objective', 'Stop the scroll and leave the viewer with one usable takeaway about ' || r.pillar || '.',
    'visual_direction', 'Dark editorial surface, warm gold accent on the single most important phrase. No stock photography, no gradients.',
    'layout_notes', 'Type-led. Generous margins. Keep all copy inside the central safe area.',
    'typography', 'Space Grotesk for headlines, Inter for body, JetBrains Mono for any code.',
    'must_include', jsonb_build_array('Apexoria wordmark', 'The CTA verbatim: ' || coalesce(r.cta, '')),
    'must_avoid', jsonb_build_array('Pasted platform logos', 'Text smaller than 16px', 'More than one accent colour'),
    'specs', jsonb_build_object(
      'dimensions', case when r.format = 'reel' then '1080x1920' when r.format = 'story' then '1080x1920' else '1080x1350' end,
      'aspect_ratio', case when r.format in ('reel', 'story') then '9:16' else '4:5' end,
      'safe_area', '96px top and bottom',
      'slide_count', case when r.format = 'carousel' then 5 else null end
    )
  ) end,

  -- Only salesforce_news carries sources; everything else is deliberately
  -- sourceless, which the schema permits (FR-3.5 applies to news only).
  case
    when r.is_news and r.is_hydrated then jsonb_build_array(
      jsonb_build_object(
        'title', 'Apex: deprecation timeline for legacy API versions',
        'url', 'https://help.salesforce.com/s/articleView?id=release-notes.apex_api_deprecation.htm',
        'source', 'Salesforce Release Notes'
      ),
      jsonb_build_object(
        'title', 'Apex security: enforcing CRUD and FLS correctly',
        'url', 'https://developer.salesforce.com/blogs/2026/04/apex-crud-fls',
        'source', 'Salesforce Developers'
      )
    )
    else '[]'::jsonb
  end,

  r.status::public.content_status,
  case when r.status = 'posted' then (r.scheduled_date + time '10:30') at time zone 'Asia/Kolkata' end,
  case when r.status = 'posted' then 'rohit@apexorialearning.in' end,
  case when r.status = 'skipped' then 'Offer was not confirmed in time, pulled before design.' end,
  'seed-v1',
  case when r.is_hydrated then (r.scheduled_date - 2 + time '03:00') at time zone 'Asia/Kolkata' end
from resolved r
cross join (
  select id from public.content_plans
  where plan_month = date_trunc('month', current_date)::date
) p
on conflict (scheduled_date, slot) do nothing;

-- ── activity_log: history for the posted items (US-14, FR-7.4) ──────────────
-- Guarded by NOT EXISTS so the seed can be reapplied without a full reset;
-- activity_log cannot be cleaned up afterwards (append-only, §7.4).
insert into public.activity_log (content_item_id, action, from_value, to_value, actor_email, note)
select ci.id, 'created', null, 'idea', null, null
from public.content_items ci
where ci.prompt_version = 'seed-v1'
  and not exists (
    select 1 from public.activity_log al
    where al.content_item_id = ci.id and al.action = 'created'
  );

insert into public.activity_log (content_item_id, action, from_value, to_value, actor_email, note)
select ci.id, 'hydrated', 'idea', 'ready', null, null
from public.content_items ci
where ci.prompt_version = 'seed-v1'
  and ci.status in ('ready', 'posted')
  and not exists (
    select 1 from public.activity_log al
    where al.content_item_id = ci.id and al.action = 'hydrated'
  );

insert into public.activity_log (content_item_id, action, from_value, to_value, actor_email, note)
select
  ci.id,
  'status_changed',
  'ready',
  'posted',
  ci.posted_by,
  case when ci.slot = 2 then 'Cross-posted to the batch group as well.' end
from public.content_items ci
where ci.prompt_version = 'seed-v1'
  and ci.status = 'posted'
  and not exists (
    select 1 from public.activity_log al
    where al.content_item_id = ci.id and al.action = 'status_changed'
  );

-- ── generation_runs: a readable Settings run log (S8, NFR-3.4) ──────────────
insert into public.generation_runs (
  kind, status, target_month, model, prompt_version,
  input_tokens, output_tokens, estimated_cost_usd, items_processed,
  error, started_at, finished_at
)
select
  r.kind::public.run_kind,
  r.status::public.run_status,
  r.target_month,
  r.model,
  r.prompt_version,
  r.input_tokens,
  r.output_tokens,
  r.estimated_cost_usd,
  r.items_processed,
  r.error,
  r.started_at,
  r.finished_at
from (values
  ('month_skeleton', 'success', date_trunc('month', current_date)::date, 'claude-sonnet-4', 'seed-v1', 4820, 2130, 0.041250, 32::smallint, null, now() - interval '20 days', now() - interval '20 days' + interval '38 seconds'),
  ('item_hydration', 'success', null, 'claude-sonnet-4', 'seed-v1', 18400, 11200, 0.198000, 24::smallint, null, now() - interval '3 days', now() - interval '3 days' + interval '233 seconds'),
  ('news_ingest',    'success', null, null, null, null, null, null, 20::smallint, null, now() - interval '1 day', now() - interval '1 day' + interval '6 seconds'),
  ('daily_tip',      'success', null, 'claude-sonnet-4', 'seed-v1', 900, 210, 0.004100, 1::smallint, null, now() - interval '4 hours', now() - interval '4 hours' + interval '4 seconds'),
  ('item_hydration', 'partial', null, 'claude-sonnet-4', 'seed-v1', 7300, 3100, 0.061000, 5::smallint, 'One item failed schema validation after a repair attempt and was left as an idea.', now() - interval '2 hours', now() - interval '2 hours' + interval '151 seconds')
) as r(
  kind, status, target_month, model, prompt_version,
  input_tokens, output_tokens, estimated_cost_usd, items_processed,
  error, started_at, finished_at
)
where not exists (select 1 from public.generation_runs);
