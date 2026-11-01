-- DATABASE.md §7.7, API.md §5.1. Keep a status change and its audit event
-- inside the same Postgres transaction.
create or replace function public.change_content_status(
  p_item_id uuid,
  p_status public.content_status,
  p_skip_reason text default null,
  p_note text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_item public.content_items;
  v_actor_email text;
  v_old_status public.content_status;
begin
  v_actor_email :=
    (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
      ->> 'email');

  select *
    into v_item
    from public.content_items
   where id = p_item_id
   for update;

  if not found then
    raise exception 'content item not found';
  end if;
  v_old_status := v_item.status;

  if p_status = 'posted' and nullif(btrim(v_actor_email), '') is null then
    raise exception 'authenticated email is required to mark an item posted';
  end if;

  update public.content_items
     set status = p_status,
         posted_at = case when p_status = 'posted' then now() else null end,
         posted_by = case when p_status = 'posted' then v_actor_email else null end,
         skip_reason = case
           when p_status = 'skipped' then nullif(btrim(p_skip_reason), '')
           else null
         end
   where id = p_item_id
   returning * into v_item;

  insert into public.activity_log (
    content_item_id, action, from_value, to_value, actor_email
  ) values (
    p_item_id, 'status_changed', v_old_status::text, p_status::text, v_actor_email
  );

  if nullif(btrim(p_note), '') is not null then
    insert into public.activity_log (
      content_item_id, action, actor_email, note
    ) values (
      p_item_id, 'note_added', v_actor_email, btrim(p_note)
    );
  end if;

  return jsonb_build_object(
    'item', to_jsonb(v_item),
    'month_progress', jsonb_build_object(
      'posted', (
        select count(*)
          from public.content_items
         where scheduled_date >= date_trunc('month', v_item.scheduled_date)::date
           and scheduled_date < (date_trunc('month', v_item.scheduled_date)
                                 + interval '1 month')::date
           and status = 'posted'
      ),
      'planned', (
        select count(*)
          from public.content_items
         where scheduled_date >= date_trunc('month', v_item.scheduled_date)::date
           and scheduled_date < (date_trunc('month', v_item.scheduled_date)
                                 + interval '1 month')::date
      )
    )
  );
end;
$$;

revoke all on function public.change_content_status(
  uuid, public.content_status, text, text
) from public;

grant execute on function public.change_content_status(
  uuid, public.content_status, text, text
) to authenticated;
