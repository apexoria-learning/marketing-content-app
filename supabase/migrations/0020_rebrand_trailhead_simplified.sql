-- Rebrand the single workspace from Apexoria Learning to Trailhead Simplified
-- (YouTube + Instagram, @TrailheadSimplified), following the channel plan.
-- Data only: no schema change, and it runs after 0019 has committed the new
-- content_format values.
--
-- Each step is safe to re-run. The profile is replaced only while it still
-- holds the original seeded name; labels and tones change only where they
-- still hold their seeded wording, so Admin edits survive. Keys are immutable
-- and nothing is deleted: superseded platforms and pillars are retired
-- (DATABASE.md §5.12, §5.14).

do $$
begin
  -- ── Business profile (DATABASE.md §5.1) ────────────────────────────────────
  update public.brand_profile
  set business_name = 'Trailhead Simplified',
      industry = 'Salesforce education',
      business_description = 'Trailhead Simplified is a YouTube channel and Instagram account (@TrailheadSimplified) by Wishvesh Ujawane, a Salesforce Technical Lead. It teaches the real Salesforce skills used on projects (admin best practices, Apex, LWC, async Apex, integrations and Agentforce) explained simply, in Hinglish. Weekly 5 to 10 minute YouTube how-tos are each repurposed into 60-second Instagram reels. Tagline: Salesforce Simplified. Career Amplified.',
      audience_description = 'Salesforce admins levelling up to advanced work, and aspiring developers learning Apex and LWC, mostly in India and comfortable with Hinglish. They want practical skills they will use on real projects, explained simply and without fluff.',
      offerings_label = 'Playlists',
      courses = array['Admin', 'Dev (Apex/LWC)', 'Best Practices', 'Agentforce'],
      tone_instagram = 'Hinglish (Hindi in Roman script mixed with English), friendly and energetic. One tip per reel. Hook in the first two seconds, then a screen demo, a one-line recap and the call to action. Keep Salesforce terms in English and highlight one keyword.',
      tone_linkedin = 'Credible and professional English, first person, as a Salesforce Technical Lead sharing real project lessons. Short paragraphs and three to five hashtags at most.',
      tip_topic = 'Practical Salesforce admin and developer skills',
      do_list = array[
        'Write in Hinglish: Hindi in Roman script mixed with English; keep Salesforce terms in English',
        'Teach real skills from real projects, with one concrete takeaway the viewer can use the same day',
        'Put the hook in the first two seconds of every video, Short and reel',
        'Open videos with: "Main hoon Wishvesh Ujawane, welcome to Trailhead Simplified."',
        'Close videos with: "Chalo, Salesforce ko simple banate hain. Milte hain agle video mein!"',
        'Label each script moment ON CAMERA (face), OFF CAMERA (voiceover) or SHOW ON SCREEN (what to screen-share)',
        'Keep scripts at 130 to 150 spoken words per minute, with short sentences and pauses',
        'Cite a source link on every Salesforce release or news claim',
        'Use Salesforce terminology precisely: Flow, Apex, LWC, SOQL, permission sets, Agentforce',
        'End with a call to action: follow Trailhead Simplified; on reels, point to the full video on YouTube',
        'Keep captions paste-ready, with real line breaks and no placeholder text'
      ],
      dont_list = array[
        'Never state a Salesforce release fact without a verifiable source URL',
        'Never use a real person''s name, other than the creator''s, unless the team has entered it here',
        'No guaranteed-job or guaranteed-salary claims',
        'No fluff: avoid generic motivational filler with no Salesforce substance',
        'Do not invent project stories, numbers, certifications or viewer outcomes',
        'Do not present Trailhead Simplified as an official Salesforce product or channel',
        'Never put more than one tip in a reel'
      ],
      links = jsonb_build_object(
        'youtube', 'https://www.youtube.com/@TrailheadSimplified',
        'instagram', 'https://www.instagram.com/trailheadsimplified'
      )
  where id = 1
    and business_name = 'Apexoria Learning';

  -- ── Platforms (DATABASE.md §5.12–5.13): YouTube + Instagram only ──────────
  insert into public.platforms
    (key, label, sort_order, colour_slot, icon, allows_hashtags, max_hashtags,
     caption_max_chars, tone, guidance)
  values
    ('youtube', 'YouTube', 1, 4, 'video', true, 5, 5000,
      'Hinglish, clear and teacherly, as a Salesforce Technical Lead explaining a real project skill. Open with the pain point, promise what the viewer will learn, then show it step by step. Plain language first, correct Salesforce terms second.',
      'Videos: 5 to 10 minute how-tos. ON CAMERA hook (0-15s): a pain-point question and the signature intro. ON CAMERA promise (15-40s): the three things they will learn. OFF CAMERA teaching segments, each with talking points and SHOW ON SCREEN notes. ON CAMERA recap and call to action (last 30s) with a question for the comments. Shorts: vertical, under 60 seconds, one tip. The caption is the video description, with chapters.')
  on conflict (key) do nothing;

  insert into public.platform_formats (platform_key, format)
  values
    ('youtube', 'short'), ('youtube', 'video'),
    ('youtube', 'post'), ('youtube', 'poll')
  on conflict do nothing;

  update public.platforms
  set sort_order = case key when 'instagram' then 2 when 'linkedin' then 3 else 4 end
  where key in ('instagram', 'linkedin', 'whatsapp');

  update public.platforms
  set tone = (select tone_instagram from public.brand_profile where id = 1),
      guidance = 'Reels: 60 seconds, 9:16, burned-in captions. Hook (0-2s) spoken and as on-screen text; one tip with a screen demo (3-50s); call to action (50-60s): follow Trailhead Simplified, full video on YouTube.'
  where key = 'instagram' and guidance = ''
    and tone like 'Playful and meme-literate%';

  update public.platforms
  set tone = (select tone_linkedin from public.brand_profile where id = 1)
  where key = 'linkedin' and tone like 'Credible and professional, never corporate-bland%';

  -- Retired, never deleted: existing content stays readable, and an admin can
  -- re-enable either platform from Admin → Platforms.
  update public.platforms set is_enabled = false where key in ('linkedin', 'whatsapp');

  -- ── Pillars (DATABASE.md §5.14): the channel plan's five + release news ───
  update public.pillars
  set label = 'Admin Tips',
      description = 'Settings, automation and best practices that admins miss'
  where key = 'salesforce_tips' and label = 'Tips';

  update public.pillars
  set label = 'Release Deep Dive',
      description = 'Salesforce releases, features and deprecations, explained with sources',
      sort_order = 6
  where key = 'salesforce_news' and label = 'News';

  insert into public.pillars (key, label, description, guidance, sort_order)
  values
    ('dev_beginners', 'Dev for Beginners',
      'Apex, LWC and SOQL explained simply for admins becoming developers', '', 2),
    ('async_integration', 'Async Apex & Integration',
      'Future, Queueable, Batch and Schedulable Apex, REST callouts, Named Credentials and Platform Events', '', 3),
    ('project_lessons', 'Real-Project Lessons',
      'Gotchas, patterns and decisions from real Salesforce projects',
      'Use only lessons supplied in the idea, steer or owner instructions; never invent project incidents, clients or numbers.', 4),
    ('agentforce', 'Agentforce',
      'Learning Agentforce in public: the creator documents their own journey, episode by episode',
      'First person, learning alongside the viewer ("main bhi seekh raha hoon"). Be explicit about what is still being explored.', 5)
  on conflict (key) do nothing;

  update public.pillars
  set is_enabled = false, sort_order = sort_order + 10
  where is_enabled and key in (
    'memes', 'interview_questions', 'success_stories', 'course_promos',
    'career_guidance', 'behind_the_scenes', 'myth_busting', 'polls_engagement'
  );
end;
$$;
