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
-- Coverage: both enabled platforms (YouTube, Instagram), all 8 formats, all 6
-- enabled pillars, all 4 statuses. Retired platforms and pillars carry no
-- seeded content, because the catalogue triggers reject new rows on them.

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
  (8,  'Success stories convert best when they include the boring middle, not just the offer letter.', 'proof'),
  (9,  'Reply to every comment in the first 24 hours. Early replies tell YouTube the video is worth showing.', 'youtube'),
  (10, 'One call to action per post. Two options is the same as none.', 'cta'),
  (11, 'Save-worthy beats like-worthy. Checklists and cheat sheets get saved and resurfaced.', 'format'),
  (12, 'Post when your viewers are commuting, not when your team is free.', 'timing'),
  (13, 'Repurpose a strong carousel into a reel two weeks later. Reach does not overlap as much as you think.', 'repurposing'),
  (14, 'Never claim a Salesforce fact without a source link. Technical audiences fact-check instantly.', 'credibility'),
  (15, 'Memes earn reach; tips earn trust. You need both in the same week.', 'mix'),
  (16, 'A poll is research, not filler. Use the answers in next month''s content.', 'engagement'),
  (17, 'Show your face at least once a week. People follow a person, not a logo.', 'brand'),
  (18, 'Write the caption as if one specific viewer asked you the question.', 'voice'),
  (19, 'Consistency beats brilliance. Three good posts a week outperform one great post a month.', 'cadence'),
  (20, 'Put the keyword in the first 125 characters so the truncated preview still makes sense.', 'copywriting'),
  (21, 'Certification and interview-question posts are the highest-intent content you publish. Make them specific.', 'topics'),
  (22, 'Do not bury the promo. If a post is a promo, say so in the first line.', 'promos'),
  (23, 'Comment on other Salesforce creators'' posts. Distribution is a relationship, not a feature.', 'growth'),
  (24, 'Batch-produce designs on one day. Context switching is what kills posting consistency.', 'operations'),
  (25, 'Track which pillar drove saves, not just likes. Saves predict follow-through.', 'measurement'),
  (26, 'Pin the post that best explains who you teach and what they will learn.', 'profile'),
  (27, 'Pin a comment with the next video''s topic. It gives viewers a reason to come back.', 'youtube'),
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
    (-21, 1, 'instagram', 'carousel', 'dev_beginners',     'posted',  'Five SOQL habits that keep queries selective', 'Aapki SOQL slow hai, ek boring reason se', E'Selective filters hi poora game hai.\n\nIndexed field in the WHERE clause. No leading wildcards. No negative operators on big objects.\n\nSwipe karo, five habits jo har slow query fix karti hain.', 'Save this for your next code review'),
    (-20, 1, 'youtube',   'video',    'salesforce_tips',   'posted',  'Top 5 Admin settings beginners miss', 'Ye 5 settings har naya admin miss karta hai', E'Login hours, session settings, field history, email deliverability aur org-wide defaults.\n\nChapters neeche hain. Har setting ka real project example video mein hai.', 'Subscribe for one admin skill every week'),
    (-19, 1, 'instagram', 'reel',     'salesforce_tips',   'posted',  'Admin setting #1 in 60 seconds', 'Ye ek setting aapke users ko lock out kar sakti hai', E'Login hours profile pe set hote hain, user pe nahi.\n\nFull video YouTube pe hai.', 'Follow Trailhead Simplified'),
    (-18, 1, 'instagram', 'story',    'agentforce',        'posted',  'Agentforce learn-in-public series starts', 'Agentforce series starts this week', E'Main bhi seekh raha hoon. Har episode mein ek step.\n\nReply karo agar aap bhi saath seekhna chahte ho.', 'Reply to join the series'),
    (-17, 1, 'youtube',   'video',    'dev_beginners',     'posted',  'Apex Trigger basics: your first trigger', 'Apna pehla Apex trigger, step by step', E'Trigger events, context variables aur ek simple handler pattern.\n\nChapters neeche hain.', 'Comment your first trigger use case'),
    (-17, 2, 'instagram', 'meme',     'dev_beginners',     'posted',  'Governor limits meme', 'Me explaining governor limits to myself at 2am', E'101 SOQL queries walk into a for loop. 🙃', 'Save it for the next code review'),
    (-16, 1, 'instagram', 'post',     'project_lessons',   'posted',  'A bug that cost me hours (and the fix)', 'Ek bug jisne mere 4 ghante kha liye', E'Recursive trigger, ek missing static flag.\n\nFix ek line ka tha. Lesson poore career ka.', 'Full story on YouTube'),
    (-15, 1, 'youtube',   'poll',     'async_integration', 'posted',  'Poll on the async Apex people use most', 'Future, Queueable ya Batch: aap kya use karte ho?', E'Next video isi pe banega. Vote karo.', 'Vote and tell me why'),
    (-14, 1, 'instagram', 'carousel', 'async_integration', 'posted',  'Named Credentials: stop hardcoding endpoints', 'Hardcoded endpoint = future production bug', E'Named Credentials URL aur auth dono sambhalte hain.\n\nSwipe karo, setup in five steps.', 'Save this before your next integration'),
    (-13, 1, 'instagram', 'meme',     'project_lessons',   'posted',  'Sandbox refresh meme', 'When someone refreshes the sandbox on a Friday', E'Please do not. 🙏', 'Follow Trailhead Simplified'),
    (-12, 1, 'instagram', 'reel',     'agentforce',        'posted',  'Agentforce in 60 seconds', 'Agentforce kya hai, 60 seconds mein', E'Agent, topics aur actions: teen words, poora concept.\n\nFull episode YouTube pe hai.', 'Follow Trailhead Simplified'),
    (-12, 2, 'youtube',   'short',    'salesforce_tips',   'posted',  'Profile or permission set in 40 seconds', 'Profile ya Permission Set? 40 seconds mein decide karo', E'Profile baseline set karta hai. Permission sets upar se access dete hain.\n\nHar naye user ko minimal profile do, baaki permission sets se.', 'Follow for tomorrow''s tip'),
    (-11, 1, 'youtube',   'post',     'salesforce_news',   'posted',  'Legacy API version deprecation timeline', 'Salesforce ne legacy API versions ka retirement schedule publish kiya', E'Agar aapka org purane REST ya SOAP versions call karta hai, to is quarter audit karo.\n\nHar integration user aur managed package check karo.', 'Audit your integrations this week'),
    (-10, 1, 'instagram', 'story',    'agentforce',        'skipped', 'Agentforce live session story, pulled because the date was not confirmed', null, null, null),
    ( -9, 1, 'instagram', 'carousel', 'salesforce_tips',   'posted',  'Permission sets over profiles', 'Profiles pe permissions dalna band karo', E'Salesforce saalon se ek hi direction point kar raha hai.\n\nSwipe karo, migration order jo kisi ka access nahi todta.', 'Save for your next org cleanup'),
    ( -8, 1, 'instagram', 'carousel', 'salesforce_news',   'posted',  'Spring release Flow Builder enhancements', 'Flow Builder errors mein ab kaafi better hai', E'Spring release debugging aur error handling add karta hai.\n\nSwipe karo, teen changes jo weekly Flow builders ke liye matter karte hain.', 'Which one will you use first?'),
    ( -8, 2, 'youtube',   'video',    'salesforce_news',   'posted',  'Spring release Flow Builder walkthrough', 'Flow Builder ka har naya feature, eight minutes mein', E'Spring release Flow Builder mein debugging aur error handling laata hai.\n\nChapters neeche hain. Release notes description mein linked hain.', 'Subscribe so you never miss a release'),
    ( -7, 1, 'instagram', 'poll',     'dev_beginners',     'posted',  'Flow or Apex poll', 'Flow ya Apex: aap pehle kya uthate ho?', E'Mera answer next reel mein. Pehle aapka.', 'Vote, then read the comments'),
    ( -6, 1, 'instagram', 'reel',     'async_integration', 'ready',   'Async Apex in 60 seconds', 'Async Apex, 60 seconds mein', E'Future, Queueable, Batch, Schedulable: kab kya.\n\nFull video YouTube pe hai.', 'Follow Trailhead Simplified'),
    ( -5, 1, 'instagram', 'story',    'project_lessons',   'posted',  'Deployment day checklist', 'Deployment day: meri checklist', E'Backup, validation-only deploy, test run, rollback plan.\n\nKya miss ho raha hai? Reply karo.', 'Reply with your step'),
    ( -4, 1, 'youtube',   'video',    'project_lessons',   'idea',    'How I structure a Salesforce project handoff', null, null, null),
    ( -3, 1, 'instagram', 'meme',     'dev_beginners',     'posted',  'Trailhead badge collector meme', 'Me: 140 Trailhead badges. Also me: cannot write a trigger', E'Badges are a map, not the journey. 🗺️', 'Build something this week'),
    ( -2, 1, 'instagram', 'carousel', 'agentforce',        'posted',  'Agent vs Flow vs Bot', 'Agent, Flow ya Bot: kya badla?', E'Teeno automation karte hain. Sirf ek reasoning karta hai.\n\nSwipe karo, difference real examples ke saath.', 'Follow the Agentforce series'),
    ( -1, 1, 'instagram', 'post',     'salesforce_tips',   'posted',  'Validation rules vs required fields', 'Validation rule ya required field: kab kya?', E'Required field har jagah lagta hai. Validation rule sirf condition pe.\n\nPage layout pe required karna sabse weak option hai.', 'Save this for your next build'),
    (  0, 1, 'instagram', 'carousel', 'dev_beginners',     'ready',   'Apex trigger patterns that scale', 'One trigger per object. Still the rule.', E'Handler classes. Bulk-safe logic. No SOQL in loops.\n\nSwipe karo, pattern jo main har project mein use karta hoon.', 'Save this before your next build'),
    (  0, 2, 'youtube',   'post',     'salesforce_news',   'ready',   'Apex CRUD and FLS enforcement guidance', 'Zyada tar Apex abhi bhi FLS checks skip karta hai', E'WITH SECURITY_ENFORCED aur Security.stripInaccessible ek reason se exist karte hain.\n\nUser context mein dono skip kiye, to wo security bug hai, style problem nahi.', 'Audit one class today'),
    (  1, 1, 'instagram', 'reel',     'dev_beginners',     'ready',   'Stop writing SOQL in loops', 'SOQL loop ke andar? Ye dekho', E'Ek query loop ke bahar, ek map, aur governor limit safe.\n\nFull video YouTube pe hai.', 'Follow Trailhead Simplified'),
    (  1, 2, 'youtube',   'short',    'async_integration', 'ready',   'Queueable Apex in 40 seconds', 'Queueable Apex, 40 seconds mein', E'Future se better: chaining, complex types aur job ID.\n\nFull walkthrough channel pe hai.', 'Follow for tomorrow''s tip'),
    (  2, 1, 'youtube',   'poll',     'async_integration', 'ready',   'Poll on integration patterns', 'Platform events ya outbound messages?', E'Dono ship hote hain. Scale sirf ek karta hai jaise teams sochti hain.', 'Vote and defend it in the comments'),
    (  4, 1, 'instagram', 'meme',     'agentforce',        'ready',   'Agentforce learning streak meme', 'Day 12 of learning Agentforce', E'Agent ne mujhse better summary likhi. 🫠', 'Follow the Agentforce series'),
    (  5, 1, 'instagram', 'carousel', 'salesforce_tips',   'idea',    'Org-wide defaults and sharing explained simply', null, null, null),
    (  6, 1, 'youtube',   'video',    'agentforce',        'idea',    'Ep. 2: Setting up my first Agent', null, null, null),
    (  7, 1, 'instagram', 'story',    'project_lessons',   'idea',    'The code review checklist I actually use', null, null, null),
    (  7, 2, 'youtube',   'video',    'salesforce_tips',   'idea',    'Record types vs page layouts: the practical difference', null, null, null),
    (  8, 1, 'instagram', 'carousel', 'async_integration', 'idea',    'REST callout from Apex, step by step', null, null, null),
    (  9, 1, 'instagram', 'post',     'project_lessons',   'idea',    'Do not do this in production: three stories', null, null, null)
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
  r.platform,
  r.format::public.content_format,
  r.pillar,
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
        jsonb_build_object('index', 2, 'headline', 'The problem', 'body', 'Name the mistake the viewer is making right now.', 'visual_note', 'Single screenshot, annotated.'),
        jsonb_build_object('index', 3, 'headline', 'Why it happens', 'body', 'One paragraph of plain-language cause.', 'visual_note', null),
        jsonb_build_object('index', 4, 'headline', 'The fix', 'body', 'Concrete steps, numbered, in order.', 'visual_note', 'Code block, monospace.'),
        jsonb_build_object('index', 5, 'headline', 'Try it today', 'body', r.cta, 'visual_note', 'Brand lockup bottom right.')
      )
    )
    when r.format in ('reel', 'short') then jsonb_build_object(
      'duration_seconds', 28,
      'scenes', jsonb_build_array(
        jsonb_build_object('from', '0:00', 'to', '0:03', 'action', 'Hard cut to presenter, mid-sentence.', 'on_screen_text', r.hook),
        jsonb_build_object('from', '0:03', 'to', '0:12', 'action', 'Screen recording of the problem.', 'on_screen_text', 'This is the bit that breaks'),
        jsonb_build_object('from', '0:12', 'to', '0:24', 'action', 'Walk through the fix on screen.', 'on_screen_text', 'Do this instead'),
        jsonb_build_object('from', '0:24', 'to', '0:28', 'action', 'Back to camera for the CTA.', 'on_screen_text', r.cta)
      ),
      'audio', 'Same low-volume track every time, ducked under voiceover.'
    )
    when r.format = 'video' then jsonb_build_object(
      'duration_seconds', 480,
      'scenes', jsonb_build_array(
        jsonb_build_object('from', '0:00', 'to', '0:15', 'action', 'ON CAMERA: pain-point question, then "Main hoon Wishvesh Ujawane, welcome to Trailhead Simplified."', 'on_screen_text', r.hook),
        jsonb_build_object('from', '0:15', 'to', '0:40', 'action', 'ON CAMERA: promise the three things the viewer will learn.', 'on_screen_text', '3 things you will learn'),
        jsonb_build_object('from', '0:40', 'to', '7:30', 'action', 'OFF CAMERA voiceover. SHOW ON SCREEN: build it step by step in a sandbox, browser zoom 110-125%, cursor highlighted.', 'on_screen_text', 'Build it'),
        jsonb_build_object('from', '7:30', 'to', '8:00', 'action', 'ON CAMERA: one-line recap, a question for the comments, then "Chalo, Salesforce ko simple banate hain."', 'on_screen_text', r.cta)
      ),
      'audio', 'Calm background track, low volume.'
    )
    when r.format = 'post' then jsonb_build_object(
      'visual_concept', 'Single frame: bold statement type over a Night background, Mint underline on the key phrase.'
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

  -- YouTube 3-5 tags, Instagram 8-15 (PRD §6.3).
  case
    when not r.is_hydrated then '{}'::text[]
    when r.platform = 'instagram' then array[
      '#salesforce', '#salesforceadmin', '#salesforcedeveloper', '#apex',
      '#lwc', '#trailhead', '#agentforce', '#salesforcehindi',
      '#trailheadsimplified', '#salesforcetips'
    ]
    when r.platform = 'youtube' then array[
      '#Salesforce', '#Trailhead', '#SalesforceAdmin'
    ]
    else '{}'::text[]
  end,

  r.cta,

  -- Fixed subsection order so designers learn the shape (DESIGN.md §6.3).
  case when r.is_hydrated then jsonb_build_object(
    'objective', 'Stop the scroll and leave the viewer with one usable takeaway about ' || r.pillar || '.',
    'visual_direction', 'Night background, Trailhead Blue for structure, Mint on the single most important keyword. No stock photography, no gradients.',
    'layout_notes', 'Type-led. Generous margins. Keep all copy inside the central safe area.',
    'typography', 'Poppins Bold for hooks and headings, Inter Medium for captions, JetBrains Mono for any code.',
    'must_include', jsonb_build_array('Trailhead Simplified logo', 'The CTA verbatim: ' || coalesce(r.cta, '')),
    'must_avoid', jsonb_build_array('Pasted platform logos', 'Text smaller than 16px', 'Colours outside the brand palette'),
    'specs', jsonb_build_object(
      'dimensions', case when r.format in ('reel', 'short', 'story') then '1080x1920' when r.format = 'video' then '1920x1080' else '1080x1350' end,
      'aspect_ratio', case when r.format in ('reel', 'short', 'story') then '9:16' when r.format = 'video' then '16:9' else '4:5' end,
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
  case when r.status = 'posted' then 'creator@example.test' end,
  case when r.status = 'skipped' then 'Session date was not confirmed in time, pulled before recording.' end,
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
  case when ci.slot = 2 then 'Cross-posted to the community group as well.' end
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
