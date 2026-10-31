-- DATABASE.md §7.4, §7.7 — bind the functions from 0005 to their tables.

create trigger brand_profile_touch_updated_at
  before update on public.brand_profile
  for each row execute function public.touch_updated_at();

create trigger content_items_touch_updated_at
  before update on public.content_items
  for each row execute function public.touch_updated_at();

create trigger content_items_enforce_status_transition
  before update on public.content_items
  for each row execute function public.enforce_status_transition();

create trigger content_items_protect_posted_content
  before update on public.content_items
  for each row execute function public.protect_posted_content();

-- Append-only enforcement that also binds service_role (§7.4).
create trigger activity_log_no_update
  before update on public.activity_log
  for each row execute function public.reject_mutation();

create trigger activity_log_no_delete
  before delete on public.activity_log
  for each row execute function public.reject_mutation();
