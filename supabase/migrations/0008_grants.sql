-- DATABASE.md §7.6. The rate limiter is reachable only through this function,
-- so execution is granted narrowly and never to public.

revoke all on function public.consume_rate_limit(text, text, timestamptz, integer) from public;

grant execute on function public.consume_rate_limit(text, text, timestamptz, integer) to authenticated;
