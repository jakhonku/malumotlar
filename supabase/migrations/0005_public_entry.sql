-- 0005_public_entry.sql
-- Ochiq ma'lumot kiritish: tuman/viloyat mas'ullari login-parolsiz forma to'ldiradi.
-- Har bir hudud (viloyat yoki tuman) bitta maxfiy "hudud havolasi" oladi; shu havola orqali o'z tadbirlarini qo'shadi,
-- tahrirlaydi va yuboradi. Token bazada faqat SHA-256 hash ko'rinishida saqlanadi.
-- Bu funksiyalarni FAQAT server (service_role) chaqiradi; anon/authenticated chaqira olmaydi.

alter table public.events alter column created_by drop not null;
alter table public.events add column if not exists source text not null default 'account'
  check (source in ('account', 'public'));
alter table public.events add column if not exists edit_token_hash text;
-- bitta token (hudud havolasi) bir nechta tadbirni birlashtiradi
drop index if exists public.events_edit_token_idx;
create index if not exists events_edit_token_idx on public.events (edit_token_hash) where edit_token_hash is not null;
drop function if exists public.public_save_event(text, text, text, jsonb);
drop function if exists public.public_submit_event(text, text);

-- ochiq so'rovlar sonini cheklash (suiiste'moldan himoya)
create table if not exists public.public_submission_log (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index if not exists public_submission_log_idx on public.public_submission_log (ip_hash, created_at);
alter table public.public_submission_log enable row level security;
revoke all on public.public_submission_log from anon, authenticated;

-- login qilinmagan (auth.uid() NULL) holatda ham xabarnoma yuborilishi uchun tuzatish
create or replace function public.app_notify_roles(
  p_event_id uuid, p_title text, p_message text, p_role public.user_role, p_region uuid
) returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications (user_id, event_id, title, message)
  select id, p_event_id, p_title, p_message
  from public.profiles
  where is_active and role = p_role and (auth.uid() is null or id <> auth.uid())
    and (p_region is null or region_id = p_region);
$$;

-- hodisa maydonlari va bog'liq yozuvlarni yozish (save_event bilan bir xil mantiq)
create or replace function public.app_write_event_body(p_id uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ev jsonb := coalesce(p_data -> 'event', '{}'::jsonb);
  r  jsonb;
  i  int;
begin
  update public.events set
    title             = trim(ev ->> 'title'),
    event_type        = nullif(trim(ev ->> 'event_type'), ''),
    description       = nullif(trim(ev ->> 'description'), ''),
    venue_name        = nullif(trim(ev ->> 'venue_name'), ''),
    address           = nullif(trim(ev ->> 'address'), ''),
    location_note     = nullif(trim(ev ->> 'location_note'), ''),
    start_date        = nullif(ev ->> 'start_date', '')::date,
    end_date          = nullif(ev ->> 'end_date', '')::date,
    start_time        = nullif(ev ->> 'start_time', '')::time,
    end_time          = nullif(ev ->> 'end_time', '')::time,
    organization_name = nullif(trim(ev ->> 'organization_name'), ''),
    notes             = nullif(trim(ev ->> 'notes'), '')
  where id = p_id;

  delete from public.event_artists where event_id = p_id;
  delete from public.event_participants where event_id = p_id;
  delete from public.event_responsibles where event_id = p_id;

  i := 0;
  for r in select * from jsonb_array_elements(coalesce(p_data -> 'artists', '[]'::jsonb)) loop
    i := i + 1;
    insert into public.event_artists (event_id, artist_name, artist_type, performance_type, role_description, notes, sort_order)
    values (p_id, trim(r ->> 'artist_name'), coalesce(nullif(r ->> 'artist_type', ''), 'artist'),
            nullif(trim(r ->> 'performance_type'), ''), nullif(trim(r ->> 'role_description'), ''),
            nullif(trim(r ->> 'notes'), ''), i);
  end loop;

  i := 0;
  for r in select * from jsonb_array_elements(coalesce(p_data -> 'participants', '[]'::jsonb)) loop
    i := i + 1;
    insert into public.event_participants (event_id, participant_name, participant_category, participant_count, participation_role, notes, sort_order)
    values (p_id, trim(r ->> 'participant_name'), nullif(trim(r ->> 'participant_category'), ''),
            nullif(r ->> 'participant_count', '')::int, nullif(trim(r ->> 'participation_role'), ''),
            nullif(trim(r ->> 'notes'), ''), i);
  end loop;

  i := 0;
  for r in select * from jsonb_array_elements(coalesce(p_data -> 'responsibles', '[]'::jsonb)) loop
    i := i + 1;
    insert into public.event_responsibles (event_id, full_name, position, organization, phone, is_primary, notes, sort_order)
    values (p_id, trim(r ->> 'full_name'), trim(r ->> 'position'), nullif(trim(r ->> 'organization'), ''),
            trim(r ->> 'phone'), coalesce((r ->> 'is_primary')::boolean, false),
            nullif(trim(r ->> 'notes'), ''), i);
  end loop;
end $$;

create or replace function public.app_public_rate_limit(p_ip_hash text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.public_submission_log where created_at < now() - interval '1 day';
  if (select count(*) from public.public_submission_log
        where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Juda ko''p so''rov yuborildi. Birozdan so''ng qayta urinib ko''ring';
  end if;
  insert into public.public_submission_log (ip_hash) values (p_ip_hash);
end $$;

-- ---------------------------------------------------------------- saqlash
-- p_token_hash NULL      → yangi hudud havolasi (hudud ma'lumotdan olinadi), yangi tadbir
-- p_token_hash, event NULL → shu havolaga yangi tadbir qo'shish (hudud havoladagi tadbirlardan olinadi)
-- p_token_hash, event ID   → shu havoladagi tadbirni tahrirlash
create or replace function public.public_save_event(
  p_token_hash text, p_new_token_hash text, p_ip_hash text, p_event_id uuid, p_data jsonb
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  e        public.events;
  base     public.events;
  ev       jsonb := coalesce(p_data -> 'event', '{}'::jsonb);
  v_scope  public.event_scope;
  v_region uuid;
  v_dist   uuid;
  v_hash   text;
  v_id     uuid;
begin
  perform public.app_public_rate_limit(p_ip_hash);
  if nullif(trim(ev ->> 'title'), '') is null or length(trim(ev ->> 'title')) < 3 then
    raise exception 'Tadbir nomini kiriting (kamida 3 belgi)';
  end if;

  if p_token_hash is null or p_event_id is null then
    if p_token_hash is null then
      if p_new_token_hash is null then raise exception 'Token yaratilmadi'; end if;
      v_hash   := p_new_token_hash;
      v_scope  := (p_data ->> 'scope')::public.event_scope;
      v_region := nullif(p_data ->> 'region_id', '')::uuid;
      v_dist   := case when v_scope = 'district' then nullif(p_data ->> 'district_id', '')::uuid end;
      if v_scope is null or v_region is null then raise exception 'Viloyatni tanlang'; end if;
      if not exists (select 1 from public.regions where id = v_region and is_active) then
        raise exception 'Viloyat/hudud faol emas yoki topilmadi';
      end if;

      -- Ro'yxatda yo'q tuman/shahar: nomi yozilsa, shu viloyat ostida yaratiladi
      if v_scope = 'district' and v_dist is null and nullif(trim(p_data ->> 'new_district_name'), '') is not null then
        select id into v_dist from public.districts
          where region_id = v_region and lower(name) = lower(trim(p_data ->> 'new_district_name'));
        if v_dist is null then
          insert into public.districts (region_id, name, district_type)
          values (v_region, trim(p_data ->> 'new_district_name'),
                  case when p_data ->> 'new_district_type' = 'shahar' then 'shahar' else 'tuman' end)
          returning id into v_dist;
          perform public.app_audit('territory.district.create', 'territory', v_dist,
            jsonb_build_object('name', trim(p_data ->> 'new_district_name'), 'region_id', v_region, 'source', 'public_form'));
        end if;
      end if;
      if v_scope = 'district' and not exists (
        select 1 from public.districts where id = v_dist and region_id = v_region and is_active
      ) then
        raise exception 'Tanlangan tuman/shahar ushbu viloyatga tegishli emas';
      end if;
    else
      -- mavjud havolaga yangi tadbir: hudud havoladagi birinchi tadbirdan olinadi
      select * into base from public.events
        where edit_token_hash = p_token_hash and deleted_at is null order by created_at limit 1;
      if not found then raise exception 'Hudud havolasi noto''g''ri yoki eskirgan'; end if;
      v_hash := p_token_hash; v_scope := base.event_scope; v_region := base.region_id; v_dist := base.district_id;
    end if;

    insert into public.events (region_id, district_id, event_scope, title, status, stage, created_by, source, edit_token_hash)
    values (v_region, v_dist, v_scope, trim(ev ->> 'title'), 'draft',
            (case when v_scope = 'regional' then 'region' else 'district' end)::public.review_stage,
            null, 'public', v_hash)
    returning id into v_id;
  else
    select * into e from public.events
      where id = p_event_id and edit_token_hash = p_token_hash and deleted_at is null for update;
    if not found then raise exception 'Hudud havolasi noto''g''ri yoki tadbir topilmadi'; end if;
    if e.status not in ('draft', 'revision') then
      raise exception 'Bu ma''lumot yuborilgan va ko''rib chiqilmoqda — tahrirlab bo''lmaydi';
    end if;
    v_id := e.id;
  end if;

  perform public.app_write_event_body(v_id, p_data);
  perform public.app_audit(case when p_event_id is null then 'event.create' else 'event.update' end,
    'event', v_id, jsonb_build_object('title', ev ->> 'title', 'source', 'public'));
  return v_id;
end $$;

-- ---------------------------------------------------------------- yuborish
-- p_event_id NULL bo'lsa, havoladagi barcha qoralama/qaytarilgan tadbirlar yuboriladi
create or replace function public.public_submit_event(p_token_hash text, p_event_id uuid, p_ip_hash text)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  e       public.events;
  v_stage public.review_stage;
  v_count int := 0;
  v_found boolean := false;
begin
  perform public.app_public_rate_limit(p_ip_hash);
  for e in
    select * from public.events
    where edit_token_hash = p_token_hash and deleted_at is null
      and (p_event_id is null or id = p_event_id)
    order by created_at for update
  loop
    v_found := true;
    if e.status not in ('draft', 'revision') then
      if p_event_id is not null then raise exception 'Bu ma''lumot allaqachon yuborilgan'; end if;
      continue;
    end if;
    begin
      perform public.app_check_complete(e.id);
    exception when others then
      raise exception '«%»: %', e.title, sqlerrm;
    end;

    -- viloyatda faol mas'ul bo'lsa, tuman ma'lumoti avval unga tushadi; aks holda to'g'ridan-to'g'ri vazirlikka
    v_stage := case
      when e.event_scope = 'district' and exists (
        select 1 from public.profiles where role = 'region_manager' and region_id = e.region_id and is_active
      ) then 'region' else 'ministry' end;

    update public.events set status = 'submitted', stage = v_stage, submitted_at = now() where id = e.id;
    insert into public.event_status_history (event_id, changed_by, old_status, new_status, old_stage, new_stage, action, comment)
    values (e.id, null, e.status, 'submitted', e.stage, v_stage, 'submit', null);

    if v_stage = 'region' then
      perform public.app_notify_roles(e.id, 'Yangi ma''lumot tekshiruvga keldi', e.title, 'region_manager', e.region_id);
    else
      perform public.app_notify_roles(e.id, 'Yangi ma''lumot vazirlikka yuborildi', e.title, 'super_admin', null);
    end if;
    perform public.app_audit('event.submit', 'event', e.id, jsonb_build_object('source', 'public', 'stage', v_stage));
    v_count := v_count + 1;
  end loop;

  if not v_found then raise exception 'Hudud havolasi noto''g''ri yoki tadbir topilmadi'; end if;
  if v_count = 0 then raise exception 'Yuborish uchun tayyor tadbir yo''q'; end if;
  return v_count;
end $$;

-- ---------------------------------------------------------------- to'liqlik talabini yumshatish
-- San'atkor/ishtirokchi majburiy emas: asosiy maqsad — tadbir qayerda va qachon o'tishini bilish.
create or replace function public.app_check_complete(p_event_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  e public.events;
  missing text[] := '{}';
begin
  select * into e from public.events where id = p_event_id;
  if e.venue_name is null then missing := array_append(missing, 'o''tkaziladigan joy'); end if;
  if e.address is null then missing := array_append(missing, 'manzil'); end if;
  if e.start_date is null or e.end_date is null then missing := array_append(missing, 'sana'); end if;
  if e.start_time is null or e.end_time is null then missing := array_append(missing, 'vaqt'); end if;
  if not exists (select 1 from public.event_responsibles where event_id = p_event_id and is_primary) then
    missing := array_append(missing, 'asosiy mas''ul ijrochi');
  end if;
  if array_length(missing, 1) > 0 then
    raise exception 'Yuborishdan oldin to''ldiring: %', array_to_string(missing, ', ');
  end if;
end $$;

revoke all on function public.app_write_event_body(uuid, jsonb), public.app_public_rate_limit(text),
  public.public_save_event(text, text, text, uuid, jsonb), public.public_submit_event(text, uuid, text),
  public.app_check_complete(uuid)
  from public, anon, authenticated;
grant execute on function public.public_save_event(text, text, text, uuid, jsonb),
  public.public_submit_event(text, uuid, text) to service_role;
