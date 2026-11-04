-- Industry-neutral business profile (DATABASE.md §5.1, US-16).
--
-- Prompts stop hard-coding "Salesforce training": the industry, the name for
-- what the business sells and the daily-tip topic become profile fields.
-- Today's row is backfilled so generation means exactly what it did before.
-- `courses` keeps its name (renaming would break the release still running
-- between migrate and deploy) and now holds the generic offerings list,
-- labelled by `offerings_label`.
--
-- The profile becomes admin-only: members lose their UPDATE policy and the
-- server's scoped admin module (service_role) writes it from Admin → Business.

alter table public.brand_profile
  add column industry text not null default 'Business',
  add column offerings_label text not null default 'Offerings',
  add column tip_topic text not null default 'Marketing';

update public.brand_profile
set industry = 'Salesforce training',
    offerings_label = 'Courses',
    tip_topic = 'Salesforce learning'
where id = 1;

alter table public.brand_profile
  add constraint brand_profile_industry_bounded
    check (industry = btrim(industry) and length(industry) between 1 and 120),
  add constraint brand_profile_offerings_label_bounded
    check (offerings_label = btrim(offerings_label)
      and length(offerings_label) between 1 and 30),
  add constraint brand_profile_tip_topic_bounded
    check (tip_topic = btrim(tip_topic) and length(tip_topic) between 1 and 200);

-- Members keep reading the profile (generation runs as them); only the
-- admin module writes it now (§7.3).
drop policy brand_profile_update on public.brand_profile;
