-- ISHGA TUSHIRISHGA TAYYORLASH
-- Supabase -> SQL Editor: shu faylning TO'LIQ matnini bir marta ishga tushiring (Run).
-- 1) 0008 (viloyat boshqarmasi rejimi) va 0009 (yozuvni o'chirish) migratsiyalari — qayta ishga tushirishga xavfsiz.
-- 2) Sinov ma'lumotlarini tozalash.
--    O'chadi: yozuvlar, eski tadbirlar (+ san'atkor/ishtirokchi/mas'ul/tarix), xabarnomalar, audit jurnali, limit jurnali.
--    Qoladi:  hududlar, admin foydalanuvchisi, "Yangi yil tadbirlari" maydonlari.
-- DIQQAT: haqiqiy ma'lumot yig'ila boshlagach bu faylni QAYTA ISHGA TUSHIRMANG.

-- ===== 1-QISM: 0008 =====
alter table public.collection_entries
  add column if not exists group_mode text not null default 'unit' check (group_mode in ('unit', 'region'));

create or replace function public.col_public_save(
  p_collection uuid, p_token_hash text, p_new_token_hash text, p_ip_hash text, p_entry_id uuid, p_data jsonb
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c        public.collections;
  e        public.collection_entries;
  base     public.collection_entries;
  v_scope  public.event_scope;
  v_region uuid;
  v_dist   uuid;
  v_hash   text;
  v_mode   text := 'unit';
  v_id     uuid;
  v_need_geo boolean := false;
  v_answers jsonb := coalesce(p_data -> 'answers', '{}'::jsonb);
begin
  perform public.app_public_rate_limit(p_ip_hash);
  select * into c from public.collections where id = p_collection;
  if not found then raise exception 'Ma''lumot yig''ish topilmadi'; end if;
  if not c.is_active or (c.deadline is not null and c.deadline < current_date) then
    raise exception 'Bu ma''lumot yig''ish yopilgan';
  end if;
  if jsonb_typeof(v_answers) <> 'object' then raise exception 'Javoblar noto''g''ri'; end if;

  if p_token_hash is null or p_entry_id is null then
    if p_token_hash is null then
      if p_new_token_hash is null then raise exception 'Token yaratilmadi'; end if;
      v_hash   := p_new_token_hash;
      v_mode   := case when p_data ->> 'group_mode' = 'region' then 'region' else 'unit' end;
      v_region := nullif(p_data ->> 'region_id', '')::uuid;
      v_need_geo := true;
    else
      select * into base from public.collection_entries
        where collection_id = c.id and edit_token_hash = p_token_hash and deleted_at is null order by created_at limit 1;
      if not found then raise exception 'Hudud havolasi noto''g''ri yoki eskirgan'; end if;
      v_hash := p_token_hash; v_mode := base.group_mode; v_region := base.region_id;
      if v_mode = 'unit' then
        if not c.allow_multiple then raise exception 'Bu ma''lumot yig''ishda hudud faqat bitta yozuv kiritadi'; end if;
        v_scope := base.scope; v_dist := base.district_id;
      else
        v_need_geo := true;
      end if;
    end if;

    if v_region is null then raise exception 'Viloyatni tanlang'; end if;
    if not exists (select 1 from public.regions where id = v_region and is_active) then
      raise exception 'Viloyat/hudud faol emas yoki topilmadi';
    end if;

    if v_need_geo then
      v_scope := (p_data ->> 'scope')::public.event_scope;
      v_dist  := case when v_scope = 'district' then nullif(p_data ->> 'district_id', '')::uuid end;
      if v_scope is null then raise exception 'Hududni tanlang'; end if;
      if v_scope = 'district' and v_dist is null and nullif(trim(p_data ->> 'new_district_name'), '') is not null then
        select id into v_dist from public.districts
          where region_id = v_region and lower(name) = lower(trim(p_data ->> 'new_district_name'));
        if v_dist is null then
          insert into public.districts (region_id, name, district_type)
          values (v_region, trim(p_data ->> 'new_district_name'),
                  case when p_data ->> 'new_district_type' = 'shahar' then 'shahar' else 'tuman' end)
          returning id into v_dist;
          perform public.app_audit('territory.district.create', 'territory', v_dist,
            jsonb_build_object('name', trim(p_data ->> 'new_district_name'), 'region_id', v_region, 'source', 'collection_form'));
        end if;
      end if;
    end if;

    if (c.audience = 'regional' and v_scope <> 'regional') or (c.audience = 'district' and v_scope <> 'district') then
      raise exception 'Bu ma''lumot yig''ish ushbu daraja uchun mo''ljallanmagan';
    end if;
    if v_scope = 'district' and not exists (
      select 1 from public.districts where id = v_dist and region_id = v_region and is_active
    ) then
      raise exception 'Tanlangan tuman/shahar ushbu viloyatga tegishli emas';
    end if;
    if v_need_geo and not c.allow_multiple and exists (
      select 1 from public.collection_entries
       where collection_id = c.id and deleted_at is null and region_id = v_region
         and district_id is not distinct from v_dist
    ) then
      raise exception 'Bu hudud allaqachon ma''lumot kiritgan. Havolangiz bo''lsa, uni oching; aks holda vazirlikka murojaat qiling';
    end if;

    insert into public.collection_entries (collection_id, region_id, district_id, scope, answers, status, edit_token_hash, group_mode)
    values (c.id, v_region, v_dist, v_scope, v_answers, 'draft', v_hash, v_mode)
    returning id into v_id;
  else
    select * into e from public.collection_entries
      where id = p_entry_id and collection_id = c.id and edit_token_hash = p_token_hash and deleted_at is null for update;
    if not found then raise exception 'Hudud havolasi noto''g''ri yoki yozuv topilmadi'; end if;
    if e.status not in ('draft', 'revision') then
      raise exception 'Bu ma''lumot yuborilgan va ko''rib chiqilmoqda — tahrirlab bo''lmaydi';
    end if;
    update public.collection_entries set answers = v_answers where id = e.id;
    v_id := e.id;
  end if;

  perform public.app_audit(case when p_entry_id is null then 'collection.entry.create' else 'collection.entry.update' end,
    'collection_entry', v_id, jsonb_build_object('collection', c.title, 'source', 'public', 'mode', v_mode));
  return v_id;
end $$;

revoke all on function public.col_public_save(uuid, text, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.col_public_save(uuid, text, text, text, uuid, jsonb) to service_role;

-- ===== 1-QISM: 0009 =====
create or replace function public.col_public_delete(p_collection uuid, p_token_hash text, p_entry_id uuid, p_ip_hash text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  e public.collection_entries;
begin
  perform public.app_public_rate_limit(p_ip_hash);
  select * into e from public.collection_entries
    where id = p_entry_id and collection_id = p_collection and edit_token_hash = p_token_hash and deleted_at is null
    for update;
  if not found then raise exception 'Hudud havolasi noto''g''ri yoki yozuv topilmadi'; end if;
  if e.status not in ('draft', 'revision') then
    raise exception 'Yuborilgan yozuvni o''chirib bo''lmaydi';
  end if;
  update public.collection_entries set deleted_at = now() where id = e.id;
  perform public.app_audit('collection.entry.delete', 'collection_entry', e.id, jsonb_build_object('source', 'public'));
end $$;

revoke all on function public.col_public_delete(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.col_public_delete(uuid, text, uuid, text) to service_role;

-- ===== 2-QISM: sinov ma'lumotlarini tozalash =====
begin;

do $$
declare n_approved int;
begin
  select (select count(*) from public.collection_entries where status = 'approved')
       + (select count(*) from public.events where status = 'approved') into n_approved;
  if n_approved > 25 then
    raise exception 'To''xtatildi: % ta tasdiqlangan yozuv bor. Bu fayl faqat sinov ma''lumotlarini tozalash uchun.', n_approved;
  end if;
end $$;

truncate table
  public.collection_entries,
  public.events,
  public.notifications,
  public.audit_logs,
  public.public_submission_log
restart identity cascade;

insert into public.audit_logs (action, entity_type, details)
values ('system.reset', 'system', jsonb_build_object('note', 'Sinov ma''lumotlari tozalandi'));

commit;

-- Tekshiruv: birinchi 4 tasi 0 (audit_logs = 1); hududlar, profiles, collections oldingicha
select 'collection_entries' as jadval, count(*) as soni from public.collection_entries
union all select 'events', count(*) from public.events
union all select 'notifications', count(*) from public.notifications
union all select 'audit_logs', count(*) from public.audit_logs
union all select 'districts (qoladi)', count(*) from public.districts
union all select 'profiles (qoladi)', count(*) from public.profiles
union all select 'collections (qoladi)', count(*) from public.collections;
