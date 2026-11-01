-- Hosted Supabase grants anon EXECUTE explicitly through default privileges.
-- Revoking PUBLIC alone does not remove those role-specific grants.
revoke all on function public.consume_rate_limit(
  text, text, timestamptz, integer
) from public, anon;

revoke all on function public.change_content_status(
  uuid, public.content_status, text, text
) from public, anon;

grant execute on function public.consume_rate_limit(
  text, text, timestamptz, integer
) to authenticated;

grant execute on function public.change_content_status(
  uuid, public.content_status, text, text
) to authenticated;
