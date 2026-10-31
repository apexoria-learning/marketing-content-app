-- DATABASE.md §9.4. Production seed: brand_profile only.
--
-- ON CONFLICT DO NOTHING keeps the migration idempotent and guarantees a
-- re-run never overwrites edits the team has made in Settings (US-16).
--
-- Content is sourced from apexorialearning.in. `current_offers` is left null
-- deliberately: offers change per cohort and are owned by the team in
-- Settings, and a stale offer in generated content is worse than none.

insert into public.brand_profile (
  id,
  business_name,
  business_description,
  audience_description,
  courses,
  tone_instagram,
  tone_linkedin,
  tone_whatsapp,
  do_list,
  dont_list,
  links
) values (
  1,
  'Apexoria Learning',
  'Apexoria Learning runs job-ready live online Salesforce cohorts covering Salesforce Development, Apex, LWC, Integrations and QA. Learners follow Admin, Developer or QA tracks through hands-on projects, with placement support and direct hiring-partner referrals across India.',
  'Beginners and career switchers across India who want a Salesforce job: freshers, non-IT graduates and working professionals moving into the Salesforce ecosystem. They are deciding whether a structured, placement-backed cohort is worth it, and they respond to proof — real projects, real interview questions and real placement outcomes.',
  array[
    'Salesforce Foundation',
    'Salesforce Crash Course',
    'Salesforce Complete Course',
    'Salesforce QA',
    'Automation QA',
    'Salesforce Interview Prep'
  ],
  'Playful and meme-literate. Short lines, high energy, emoji welcome. Put the hook in the first three words. Write for a fresher scrolling fast who is anxious about getting hired.',
  'Credible and professional, never corporate-bland. First person, specific and technically accurate. Short paragraphs, three to five hashtags at most. Written as a trainer who places people, not as a brand account.',
  'Direct and conversational, like a message to a batch group. One idea per status, plain language, minimal emoji, never any hashtags.',
  array[
    'Lead with a concrete takeaway a learner can use the same day',
    'Cite a source link on every Salesforce release or news claim',
    'Use Salesforce terminology precisely: Apex, LWC, Flow, SOQL, sandbox',
    'Write for beginners and career switchers, not for existing architects',
    'Reference placement support and hiring-partner referrals only where genuinely relevant',
    'Keep captions paste-ready, with real line breaks and no placeholder text'
  ],
  array[
    'Never use a real learner name unless the team has entered it here (DR-2)',
    'Never state a Salesforce release fact without a verifiable source URL',
    'No guaranteed-salary or guaranteed-job claims beyond the placement support actually offered',
    'Never put hashtags on WhatsApp Status',
    'Avoid generic motivational filler with no Salesforce substance',
    'Do not invent course names, prices, batch dates or student outcomes'
  ],
  jsonb_build_object(
    'website', 'https://www.apexorialearning.in',
    'courses', 'https://www.apexorialearning.in/courses'
  )
)
on conflict (id) do nothing;
