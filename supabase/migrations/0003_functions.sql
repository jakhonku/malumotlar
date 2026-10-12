-- 0003_functions.sql
-- Barcha yozish amallari shu funksiyalar orqali bajariladi (SECURITY DEFINER).
-- Har bir funksiya chaqiruvchi profilini o'zi tekshiradi: rol, hudud, faollik.

-- ---------------------------------------------------------------- ichki yordamchilar
create or replace function public.app_audit(
  p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb default '{}'::jsonb
) returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

create or replace function public.app_current_profile()
returns public.profiles language plpgsql stable security definer set search_path = public, pg_temp as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid() and is_active;
  if not found then
    raise exception 'Foydalanuvchi topilmadi yoki faolsizlantirilgan';
  end if;
  return p;
end $$;

-- tahrirlash huquqi
create or replace function public.app_can_edit(e public.events, p public.profiles)
returns boolean language sql immutable as $$
  select case
    when p.role = 'super_admin' then true
    when p.role = 'district_manager' then
      e.district_id = p.district_id and e.stage = 'district' and e.status in ('draft', 'revision')
    when p.role = 'region_manager' then
      e.region_id = p.region_id and e.status <> 'approved' and (
        (e.event_scope = 'regional' and e.stage = 'region' and e.status in ('draft', 'revision'))
        or (e.event_scope = 'district' and p.can_edit_districts and e.stage in ('region', 'district'))
      )
    else false
  end
$$;

create or replace function public.app_notify_roles(
  p_event_id uuid, p_title text, p_message text,
  p_role public.user_role, p_region uuid
) returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications (user_id, event_id, title, message)
  select id, p_event_id, p_title, p_message
  from public.profiles
  where is_active and role = p_role and id <> auth.uid()
    and (p_region is null or region_id = p_region);
$$;

create or replace function public.app_notify_user(
  p_event_id uuid, p_user uuid, p_title text, p_message text
) returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications (user_id, event_id, title, message)
  select id, p_event_id, p_title, p_message
  from public.profiles where id = p_user and is_active and id <> auth.uid();
$$;

revoke all on function public.app_audit(text, text, uuid, jsonb),
  public.app_current_profile(),
  public.app_can_edit(public.events, public.profiles),
  public.app_notify_roles(uuid, text, text, public.user_role, uuid),
  public.app_notify_user(uuid, uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- tadbirni saqlash
create or replace function public.save_event(p_event_id uuid, p_data jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  p        public.profiles := public.app_current_profile();
  e        public.events;
  ev       jsonb := coalesce(p_data -> 'event', '{}'::jsonb);
  v_scope  public.event_scope;
  v_region uuid;
  v_dist   uuid;
  v_stage  public.review_stage;
  v_id     uuid;
  r        jsonb;
  i        int;
begin
  if p.role = 'observer' then
    raise exception 'Kuzatuvchi ma''lumot kirita olmaydi';
  end if;
  if nullif(trim(ev ->> 'title'), '') is null or length(trim(ev ->> 'title')) < 3 then
    raise exception 'Tadbir nomini kiriting (kamida 3 belgi)';
  end if;

  if p_event_id is null then
    -- ===== yangi tadbir: hudud foydalanuvchi profilidan aniqlanadi =====
    if p.role = 'district_manager' then
      v_scope := 'district'; v_region := p.region_id; v_dist := p.district_id; v_stage := 'district';
    else
      v_scope := (p_data ->> 'scope')::public.event_scope;
      if p.role = 'region_manager' then
        v_region := p.region_id;
        if v_scope = 'regional' then
          v_dist := null; v_stage := 'region';
        else
          if not p.can_edit_districts then
            raise exception 'Tuman nomidan tadbir kiritish uchun sizga ruxsat berilmagan';
          end if;
          v_dist := (p_data ->> 'district_id')::uuid; v_stage := 'region';
        end if;
      else -- super_admin
        v_region := (p_data ->> 'region_id')::uuid;
        if v_scope = 'regional' then
          v_dist := null; v_stage := 'region';
        else
          v_dist := (p_data ->> 'district_id')::uuid; v_stage := 'district';
        end if;
      end if;
    end if;
    if v_scope is null or v_region is null then
      raise exception 'Tadbir ko''lami va hududi aniqlanmadi';
    end if;
    -- Ro'yxatda yo'q tuman/shahar: foydalanuvchi nomini yozsa, shu viloyat ostida yaratiladi
    if v_scope = 'district' and v_dist is null and p.role <> 'district_manager'
       and nullif(trim(p_data ->> 'new_district_name'), '') is not null then
      select id into v_dist from public.districts
        where region_id = v_region and lower(name) = lower(trim(p_data ->> 'new_district_name'));
      if v_dist is null then
        insert into public.districts (region_id, name, district_type)
        values (v_region, trim(p_data ->> 'new_district_name'),
                case when p_data ->> 'new_district_type' = 'shahar' then 'shahar' else 'tuman' end)
        returning id into v_dist;
        perform public.app_audit('territory.district.create', 'territory', v_dist,
          jsonb_build_object('name', trim(p_data ->> 'new_district_name'), 'region_id', v_region, 'source', 'event_form'));
      end if;
    end if;
    if not exists (select 1 from public.regions where id = v_region and is_active) then
      raise exception 'Viloyat/hudud faol emas yoki topilmadi';
    end if;
    if v_scope = 'district' and not exists (
      select 1 from public.districts where id = v_dist and region_id = v_region and is_active
    ) then
      raise exception 'Tanlangan tuman/shahar ushbu viloyatga tegishli emas';
    end if;

    insert into public.events (region_id, district_id, event_scope, title, status, stage, created_by)
    values (v_region, v_dist, v_scope, trim(ev ->> 'title'), 'draft', v_stage, p.id)
    returning id into v_id;
  else
    -- ===== mavjud tadbir =====
    select * into e from public.events where id = p_event_id and deleted_at is null for update;
    if not found then raise exception 'Tadbir topilmadi'; end if;
    if not public.app_can_edit(e, p) then
      raise exception 'Bu tadbirni tahrirlash huquqingiz yo''q yoki u hozir tahrirlash holatida emas';
    end if;
    v_id := e.id;
  end if;

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
  where id = v_id;

  -- bog'liq yozuvlarni almashtirish
  delete from public.event_artists where event_id = v_id;
  delete from public.event_participants where event_id = v_id;
  delete from public.event_responsibles where event_id = v_id;

  i := 0;
  for r in select * from jsonb_array_elements(coalesce(p_data -> 'artists', '[]'::jsonb)) loop
    i := i + 1;
    insert into public.event_artists (event_id, artist_name, artist_type, performance_type, role_description, notes, sort_order)
    values (v_id, trim(r ->> 'artist_name'), coalesce(nullif(r ->> 'artist_type', ''), 'artist'),
            nullif(trim(r ->> 'performance_type'), ''), nullif(trim(r ->> 'role_description'), ''),
            nullif(trim(r ->> 'notes'), ''), i);
  end loop;

  i := 0;
  for r in select * from jsonb_array_elements(coalesce(p_data -> 'participants', '[]'::jsonb)) loop
    i := i + 1;
    insert into public.event_participants (event_id, participant_name, participant_category, participant_count, participation_role, notes, sort_order)
    values (v_id, trim(r ->> 'participant_name'), nullif(trim(r ->> 'participant_category'), ''),
            nullif(r ->> 'participant_count', '')::int, nullif(trim(r ->> 'participation_role'), ''),
            nullif(trim(r ->> 'notes'), ''), i);
  end loop;

  i := 0;
  for r in select * from jsonb_array_elements(coalesce(p_data -> 'responsibles', '[]'::jsonb)) loop
    i := i + 1;
    insert into public.event_responsibles (event_id, full_name, position, organization, phone, is_primary, notes, sort_order)
    values (v_id, trim(r ->> 'full_name'), trim(r ->> 'position'), nullif(trim(r ->> 'organization'), ''),
            trim(r ->> 'phone'), coalesce((r ->> 'is_primary')::boolean, false),
            nullif(trim(r ->> 'notes'), ''), i);
  end loop;

  perform public.app_audit(case when p_event_id is null then 'event.create' else 'event.update' end,
    'event', v_id, jsonb_build_object('title', ev ->> 'title'));
  return v_id;
end $$;

-- ---------------------------------------------------------------- holat o'tishlari
create or replace function public.app_check_complete(p_event_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  e public.events;
  missing text[] := '{}';
begin
  select * into e from public.events where id = p_event_id;
  if e.event_type is null then missing := array_append(missing, 'tadbir turi'); end if;
  if e.venue_name is null then missing := array_append(missing, 'o''tkaziladigan joy'); end if;
  if e.address is null then missing := array_append(missing, 'manzil'); end if;
  if e.start_date is null or e.end_date is null then missing := array_append(missing, 'sana'); end if;
  if e.start_time is null or e.end_time is null then missing := array_append(missing, 'vaqt'); end if;
  if not exists (select 1 from public.event_responsibles where event_id = p_event_id and is_primary) then
    missing := array_append(missing, 'asosiy mas''ul ijrochi');
  end if;
  if not exists (select 1 from public.event_artists where event_id = p_event_id)
     and not exists (select 1 from public.event_participants where event_id = p_event_id) then
    missing := array_append(missing, 'san''atkorlar yoki ishtirokchilar');
  end if;
  if array_length(missing, 1) > 0 then
    raise exception 'Yuborishdan oldin to''ldiring: %', array_to_string(missing, ', ');
  end if;
end $$;
revoke all on function public.app_check_complete(uuid) from public, anon, authenticated;

create or replace function public.transition_event(p_event_id uuid, p_action text, p_comment text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  p          public.profiles := public.app_current_profile();
  e          public.events;
  v_status   public.event_status;
  v_stage    public.review_stage;
  v_back     public.review_stage;
  v_comment  text := nullif(trim(coalesce(p_comment, '')), '');
  v_title    text;
begin
  select * into e from public.events where id = p_event_id and deleted_at is null for update;
  if not found then raise exception 'Tadbir topilmadi'; end if;
  if p.role = 'observer' then raise exception 'Kuzatuvchi holatni o''zgartira olmaydi'; end if;

  -- muallifga qaytarish bosqichi
  v_back := case when e.event_scope = 'district' then 'district' else 'region' end;

  if p_action = 'submit' then
    if e.status not in ('draft', 'revision') or not public.app_can_edit(e, p) then
      raise exception 'Bu tadbirni yuborish mumkin emas';
    end if;
    perform public.app_check_complete(e.id);
    v_status := 'submitted';
    v_stage := case when p.role = 'district_manager' then 'region' else 'ministry' end;

  elsif p_action = 'forward' then
    if not (p.role = 'super_admin' or (p.role = 'region_manager' and p.region_id = e.region_id)) then
      raise exception 'Ruxsat yo''q';
    end if;
    if e.event_scope <> 'district' or e.status <> 'submitted' or e.stage <> 'region' then
      raise exception 'Faqat viloyat tekshiruvidagi tuman tadbirini vazirlikka yuborish mumkin';
    end if;
    v_status := 'submitted'; v_stage := 'ministry';

  elsif p_action = 'return' then
    if v_comment is null or length(v_comment) < 3 then
      raise exception 'Qaytarish sababini yozish majburiy';
    end if;
    if e.status <> 'submitted' then raise exception 'Faqat yuborilgan tadbirni qaytarish mumkin'; end if;
    if p.role = 'region_manager' then
      if not (p.region_id = e.region_id and e.event_scope = 'district' and e.stage = 'region') then
        raise exception 'Ruxsat yo''q';
      end if;
    elsif p.role <> 'super_admin' then
      raise exception 'Ruxsat yo''q';
    end if;
    v_status := 'revision'; v_stage := v_back;

  elsif p_action = 'approve' then
    if p.role <> 'super_admin' then raise exception 'Tasdiqlash faqat vazirlik huquqi'; end if;
    if e.status <> 'submitted' then raise exception 'Faqat yuborilgan tadbirni tasdiqlash mumkin'; end if;
    v_status := 'approved'; v_stage := 'ministry';

  elsif p_action = 'reopen' then
    if p.role <> 'super_admin' then raise exception 'Qayta ochish faqat vazirlik huquqi'; end if;
    if e.status <> 'approved' then raise exception 'Faqat tasdiqlangan tadbirni qayta ochish mumkin'; end if;
    if v_comment is null or length(v_comment) < 3 then raise exception 'Qayta ochish sababini yozing'; end if;
    v_status := 'revision'; v_stage := v_back;
  else
    raise exception 'Noma''lum amal';
  end if;

  update public.events set
    status = v_status, stage = v_stage,
    submitted_at = case when p_action in ('submit', 'forward') then now() else submitted_at end,
    approved_at  = case when p_action = 'approve' then now() when p_action = 'reopen' then null else approved_at end
  where id = e.id;

  insert into public.event_status_history (event_id, changed_by, old_status, new_status, old_stage, new_stage, action, comment)
  values (e.id, p.id, e.status, v_status, e.stage, v_stage, p_action, v_comment);

  v_title := e.title;
  if p_action = 'submit' and v_stage = 'region' then
    perform public.app_notify_roles(e.id, 'Yangi ma''lumot tekshiruvga keldi', v_title, 'region_manager', e.region_id);
  elsif p_action in ('submit', 'forward') then
    perform public.app_notify_roles(e.id, 'Tadbir vazirlik tasdig''iga yuborildi', v_title, 'super_admin', null);
  else
    perform public.app_notify_user(e.id, e.created_by,
      case p_action when 'approve' then 'Tadbir tasdiqlandi'
                    when 'return' then 'Tadbir qayta ishlashga qaytarildi'
                    else 'Tadbir qayta ochildi' end,
      v_title || coalesce(' — ' || v_comment, ''));
    if e.event_scope = 'district' then
      perform public.app_notify_roles(e.id,
        case p_action when 'approve' then 'Tuman tadbiri tasdiqlandi'
                      when 'return' then 'Tuman tadbiri qaytarildi'
                      else 'Tuman tadbiri qayta ochildi' end,
        v_title || coalesce(' — ' || v_comment, ''), 'region_manager', e.region_id);
    end if;
  end if;

  perform public.app_audit('event.' || p_action, 'event', e.id,
    jsonb_build_object('from', e.status, 'to', v_status, 'stage', v_stage, 'comment', v_comment));
end $$;

-- ---------------------------------------------------------------- qoralamani o'chirish (yumshoq)
create or replace function public.delete_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  p public.profiles := public.app_current_profile();
  e public.events;
begin
  select * into e from public.events where id = p_event_id and deleted_at is null for update;
  if not found then raise exception 'Tadbir topilmadi'; end if;
  if e.status <> 'draft' then raise exception 'Faqat qoralamani o''chirish mumkin'; end if;
  if not public.app_can_edit(e, p) then raise exception 'Ruxsat yo''q'; end if;
  update public.events set deleted_at = now() where id = e.id;
  perform public.app_audit('event.delete', 'event', e.id, jsonb_build_object('title', e.title));
end $$;

-- ---------------------------------------------------------------- monitoring (chaqiruvchi RLS bilan)
create or replace function public.dashboard_stats()
returns jsonb language sql stable security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'total',          (select count(*) from events),
    'regional',       (select count(*) from events where event_scope = 'regional'),
    'district',       (select count(*) from events where event_scope = 'district'),
    'draft',          (select count(*) from events where status = 'draft'),
    'pending',        (select count(*) from events where status = 'submitted'),
    'revision',       (select count(*) from events where status = 'revision'),
    'approved',       (select count(*) from events where status = 'approved'),
    'regions_total',  (select count(*) from regions where is_active),
    'regions_sent',   (select count(distinct region_id) from events where status in ('submitted', 'approved'))
  )
$$;

create or replace function public.monitoring_regions()
returns table (
  region_id uuid, region_name text, sort_order int,
  regional_total int, regional_approved int,
  districts_total int, districts_sent int, districts_not_sent int,
  events_total int, events_approved int, events_pending int, events_revision int
) language sql stable security invoker set search_path = public, pg_temp as $$
  select r.id, r.name, r.sort_order,
    (select count(*)::int from events e where e.region_id = r.id and e.event_scope = 'regional'),
    (select count(*)::int from events e where e.region_id = r.id and e.event_scope = 'regional' and e.status = 'approved'),
    (select count(*)::int from districts d where d.region_id = r.id and d.is_active),
    (select count(*)::int from districts d where d.region_id = r.id and d.is_active and exists (
       select 1 from events e where e.district_id = d.id and e.status in ('submitted', 'approved'))),
    (select count(*)::int from districts d where d.region_id = r.id and d.is_active and not exists (
       select 1 from events e where e.district_id = d.id and e.status in ('submitted', 'approved'))),
    (select count(*)::int from events e where e.region_id = r.id),
    (select count(*)::int from events e where e.region_id = r.id and e.status = 'approved'),
    (select count(*)::int from events e where e.region_id = r.id and e.status = 'submitted'),
    (select count(*)::int from events e where e.region_id = r.id and e.status = 'revision')
  from regions r where r.is_active
  order by r.sort_order, r.name
$$;

create or replace function public.monitoring_districts(p_region_id uuid)
returns table (
  district_id uuid, district_name text, district_type text,
  events_total int, draft int, submitted int, revision int, approved int, sent boolean
) language sql stable security invoker set search_path = public, pg_temp as $$
  select d.id, d.name, d.district_type,
    count(e.id)::int,
    (count(e.id) filter (where e.status = 'draft'))::int,
    (count(e.id) filter (where e.status = 'submitted'))::int,
    (count(e.id) filter (where e.status = 'revision'))::int,
    (count(e.id) filter (where e.status = 'approved'))::int,
    coalesce(bool_or(e.status in ('submitted', 'approved')), false)
  from districts d
  left join events e on e.district_id = d.id
  where d.region_id = p_region_id and d.is_active
  group by d.id, d.name, d.district_type
  order by d.district_type desc, d.name
$$;

-- ---------------------------------------------------------------- ruxsatlar
revoke all on function public.save_event(uuid, jsonb), public.transition_event(uuid, text, text),
  public.delete_event(uuid), public.dashboard_stats(), public.monitoring_regions(),
  public.monitoring_districts(uuid) from public, anon;
grant execute on function public.save_event(uuid, jsonb), public.transition_event(uuid, text, text),
  public.delete_event(uuid), public.dashboard_stats(), public.monitoring_regions(),
  public.monitoring_districts(uuid) to authenticated;
