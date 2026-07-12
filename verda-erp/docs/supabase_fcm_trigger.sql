-- ============================================================================
-- Verda · Supabase FCM dispatch trigger (silent state change → push)
-- ----------------------------------------------------------------------------
-- When an admin approves/rejects a resource request, Supabase silently updates
-- the row; this trigger fires a push to the supplier's FCM token.
--
-- Place the Firebase service-account / server key in Supabase Vault as a
-- secret named 'fcm_server_key', then deploy this function as an Edge Function
-- (pg_net http_post) or an rpc invoked by the client after the update.
-- ============================================================================

-- Optional: an rpc the client calls right after deciding (keeps the server key
-- server-side). Returns nothing; dispatches FCM via pg_net.
create or replace function notify_resource_decision(p_request_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_request resource_requests%rowtype;
  v_token   text;
  v_title   text;
  v_body    text;
begin
  select * into v_request from resource_requests where id = p_request_id;
  if not found then return; end if;

  -- Resolve the supplier's FCM token (stored by the PWA on registration).
  select token into v_token from fcm_tokens where user_id = v_request.supplier_id limit 1;
  if v_token is null then return; end if;

  v_title := case when v_request.status = 'APPROVED'
                  then 'Resource Request Approved ✅'
                  else 'Resource Request Rejected' end;
  v_body  := v_request.quantity || '× ' || v_request.item_details ||
             coalesce(' — ' || v_request.admin_notes, '');

  -- pg_net must be enabled (Supabase → Database → Extensions).
  perform net.http_post(
    url := 'https://fcm.googleapis.com/fcm/send',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'key=' || current_setting('app.fcm_server_key', true)
    ),
    body := jsonb_build_object(
      'to', v_token,
      'notification', jsonb_build_object('title', v_title, 'body', v_body),
      'data', jsonb_build_object('requestId', v_request.id, 'type', v_request.type)
    )
  );
end;
$$;

-- fcm_tokens table (created if not present; mirrors Firestore fcm_tokens/{uid})
create table if not exists fcm_tokens (
  id        uuid primary key default gen_random_uuid(),
  user_id   text not null references users(id) on delete cascade,
  token     text not null,
  platform  text,
  created_at timestamptz not null default now()
);
create unique index if not exists uniq_fcm_token on fcm_tokens(token);
