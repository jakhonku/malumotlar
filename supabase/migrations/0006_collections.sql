-- 0006_collections.sql
-- Umumiy "ma'lumot yig'ish" moduli: administrator o'zi qanday ma'lumot yig'ilishini (maydonlarni) belgilaydi,
-- hududlar (viloyat/tuman) login-parolsiz hudud havolasi orqali to'ldiradi, vazirlik tekshiradi va hisobot oladi.
-- Yangi yil tadbirlari — shu modulning bir ko'rinishi (shablon), boshqa mavzularda ham ishlatiladi.

create table public.collections (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (length(trim(title)) >= 3),
  description   text,
  entry_label   text not null default 'Yozuv',
  audience      text not null default 'both' check (audience in ('regional', 'district', 'both')),
  fields        jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array'),
  allow_multiple boolean not null default true,
  is_active     boolean not null default true,
  deadline      date,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger collections_updated before update on public.collections
  for each row execute function public.tg_set_updated_at();

create table public.collection_entries (
  id              uuid primary key default gen_random_uuid(),
  collection_id   uuid not null references public.collections (id) on delete restrict,
  region_id       uuid not null references public.regions (id) on delete restrict,
  district_id     uuid references public.districts (id) on delete restrict,
  scope           public.event_scope not null,
  answers         jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  status          public.event_status not null default 'draft',
  review_comment  text,
  edit_token_hash text not null,
  submitted_at    timestamptz,
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint collection_entries_scope_chk check (
    (scope = 'regional' and district_id is null) or (scope = 'district' and district_id is not null)
  )
);
create index collection_entries_col_idx    on public.collection_entries (collection_id, status) where deleted_at is null;
create index collection_entries_region_idx on public.collection_entries (region_id) where deleted_at is null;
create index collection_entries_dist_idx   on public.collection_entries (district_id) where deleted_at is null;
create index collection_entries_token_idx  on public.collection_entries (edit_token_hash);
create trigger collection_entries_updated before update on public.collection_entries
  for each row execute function public.tg_set_updated_at();

create or replace function public.tg_collection_entries_geo()
returns trigger language plpgsql as $$
begin
  if new.scope = 'district' and not exists (
    select 1 from public.districts d where d.id = new.district_id and d.region_id = new.region_id
  ) then
    raise exception 'Tanlangan tuman/shahar ushbu viloyatga tegishli emas';
  end if;
  return new;
end $$;
create trigger collection_entries_geo before insert or update on public.collection_entries
  for each row execute function public.tg_collection_entries_geo();

-- yig'ish va yozuvlarni tasodifiy o'chirishdan himoya (faqat faolsizlantirish)
create or replace function public.tg_no_hard_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'Yozuvlarni o''chirib bo''lmaydi — faolsizlantiring';
end $$;
create trigger collections_no_delete before delete on public.collections
  for each row execute function public.tg_no_hard_delete();
create trigger collection_entries_no_delete before delete on public.collection_entries
  for each row execute function public.tg_no_hard_delete();

-- ---------------------------------------------------------------- RLS va huquqlar
alter table public.collections        enable row level security;
alter table public.collection_entries enable row level security;

revoke all on public.collections, public.collection_entries from anon;
revoke delete, truncate on public.collections from authenticated;
revoke insert, update, delete, truncate on public.collection_entries from authenticated;

create policy collections_select on public.collections for select to authenticated using (true);
create policy collections_insert on public.collections for insert to authenticated
  with check (public.auth_role() = 'super_admin');
create policy collections_update on public.collections for update to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

create policy collection_entries_select on public.collection_entries for select to authenticated using (
  deleted_at is null and (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'observer' and (public.auth_region() is null or region_id = public.auth_region()))
    or (public.auth_role() = 'region_manager' and region_id = public.auth_region())
    or (public.auth_role() = 'district_manager' and district_id = public.auth_district())
  )
);

-- ---------------------------------------------------------------- ochiq to'ldirish (faqat server / service_role)
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
  v_id     uuid;
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
      v_scope  := (p_data ->> 'scope')::public.event_scope;
      v_region := nullif(p_data ->> 'region_id', '')::uuid;
      v_dist   := case when v_scope = 'district' then nullif(p_data ->> 'district_id', '')::uuid end;
      if v_scope is null or v_region is null then raise exception 'Viloyatni tanlang'; end if;
      if (c.audience = 'regional' and v_scope <> 'regional') or (c.audience = 'district' and v_scope <> 'district') then
        raise exception 'Bu ma''lumot yig''ish ushbu daraja uchun mo''ljallanmagan';
      end if;
      if not exists (select 1 from public.regions where id = v_region and is_active) then
        raise exception 'Viloyat/hudud faol emas yoki topilmadi';
      end if;
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
      if v_scope = 'district' and not exists (
        select 1 from public.districts where id = v_dist and region_id = v_region and is_active
      ) then
        raise exception 'Tanlangan tuman/shahar ushbu viloyatga tegishli emas';
      end if;
      if not c.allow_multiple and exists (
        select 1 from public.collection_entries
         where collection_id = c.id and deleted_at is null and region_id = v_region
           and district_id is not distinct from v_dist
      ) then
        raise exception 'Bu hudud allaqachon ma''lumot kiritgan. Havolangiz bo''lsa, uni oching; aks holda vazirlikka murojaat qiling';
      end if;
    else
      select * into base from public.collection_entries
        where collection_id = c.id and edit_token_hash = p_token_hash and deleted_at is null order by created_at limit 1;
      if not found then raise exception 'Hudud havolasi noto''g''ri yoki eskirgan'; end if;
      if not c.allow_multiple then raise exception 'Bu ma''lumot yig''ishda hudud faqat bitta yozuv kiritadi'; end if;
      v_hash := p_token_hash; v_scope := base.scope; v_region := base.region_id; v_dist := base.district_id;
    end if;
    insert into public.collection_entries (collection_id, region_id, district_id, scope, answers, status, edit_token_hash)
    values (c.id, v_region, v_dist, v_scope, v_answers, 'draft', v_hash)
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
    'collection_entry', v_id, jsonb_build_object('collection', c.title, 'source', 'public'));
  return v_id;
end $$;

-- Yuborish. Majburiy maydonlar tekshiruvi serverda (TypeScript) bajariladi; bu funksiya holatni o'zgartiradi.
create or replace function public.col_public_submit(p_collection uuid, p_token_hash text, p_entry_id uuid, p_ip_hash text)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c       public.collections;
  e       public.collection_entries;
  v_count int := 0;
  v_found boolean := false;
  v_where text;
begin
  perform public.app_public_rate_limit(p_ip_hash);
  select * into c from public.collections where id = p_collection;
  if not found then raise exception 'Ma''lumot yig''ish topilmadi'; end if;
  if not c.is_active or (c.deadline is not null and c.deadline < current_date) then
    raise exception 'Bu ma''lumot yig''ish yopilgan';
  end if;

  for e in
    select * from public.collection_entries
    where collection_id = c.id and edit_token_hash = p_token_hash and deleted_at is null
      and (p_entry_id is null or id = p_entry_id)
    order by created_at for update
  loop
    v_found := true;
    if e.status not in ('draft', 'revision') then
      if p_entry_id is not null then raise exception 'Bu ma''lumot allaqachon yuborilgan'; end if;
      continue;
    end if;
    update public.collection_entries set status = 'submitted', submitted_at = now(), review_comment = null where id = e.id;
    v_count := v_count + 1;
    v_where := coalesce((select name from public.districts where id = e.district_id), (select name from public.regions where id = e.region_id));
    insert into public.notifications (user_id, title, message)
      select id, 'Yangi ma''lumot yuborildi', c.title || ' — ' || v_where
      from public.profiles where is_active and role = 'super_admin';
    perform public.app_audit('collection.entry.submit', 'collection_entry', e.id, jsonb_build_object('collection', c.title));
  end loop;

  if not v_found then raise exception 'Hudud havolasi noto''g''ri yoki yozuv topilmadi'; end if;
  if v_count = 0 then raise exception 'Yuborish uchun tayyor yozuv yo''q'; end if;
  return v_count;
end $$;

-- ---------------------------------------------------------------- vazirlik tekshiruvi
create or replace function public.col_review(p_entry uuid, p_action text, p_comment text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  p public.profiles := public.app_current_profile();
  e public.collection_entries;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if p.role <> 'super_admin' then raise exception 'Bu amal faqat vazirlik administratori uchun'; end if;
  select * into e from public.collection_entries where id = p_entry and deleted_at is null for update;
  if not found then raise exception 'Yozuv topilmadi'; end if;

  if p_action = 'approve' then
    if e.status <> 'submitted' then raise exception 'Faqat yuborilgan yozuvni tasdiqlash mumkin'; end if;
    update public.collection_entries set status = 'approved', approved_at = now(), review_comment = null where id = e.id;
  elsif p_action = 'return' then
    if e.status <> 'submitted' then raise exception 'Faqat yuborilgan yozuvni qaytarish mumkin'; end if;
    if v_comment is null or length(v_comment) < 3 then raise exception 'Qaytarish sababini yozish majburiy'; end if;
    update public.collection_entries set status = 'revision', review_comment = v_comment where id = e.id;
  elsif p_action = 'reopen' then
    if e.status <> 'approved' then raise exception 'Faqat tasdiqlangan yozuvni qayta ochish mumkin'; end if;
    if v_comment is null or length(v_comment) < 3 then raise exception 'Qayta ochish sababini yozing'; end if;
    update public.collection_entries set status = 'revision', approved_at = null, review_comment = v_comment where id = e.id;
  else
    raise exception 'Noma''lum amal';
  end if;
  perform public.app_audit('collection.entry.' || p_action, 'collection_entry', e.id,
    jsonb_build_object('from', e.status, 'comment', v_comment));
end $$;

-- ---------------------------------------------------------------- monitoring (chaqiruvchi RLS bilan)
create or replace function public.col_monitoring_regions(p_collection uuid)
returns table (
  region_id uuid, region_name text, regional_total int, regional_sent int,
  districts_total int, districts_sent int, entries_total int, entries_approved int
) language sql stable security invoker set search_path = public, pg_temp as $$
  select r.id, r.name,
    (select count(*)::int from collection_entries e where e.collection_id = p_collection and e.region_id = r.id and e.scope = 'regional'),
    (select count(*)::int from collection_entries e where e.collection_id = p_collection and e.region_id = r.id and e.scope = 'regional' and e.status in ('submitted', 'approved')),
    (select count(*)::int from districts d where d.region_id = r.id and d.is_active),
    (select count(*)::int from districts d where d.region_id = r.id and d.is_active and exists (
       select 1 from collection_entries e where e.collection_id = p_collection and e.district_id = d.id and e.status in ('submitted', 'approved'))),
    (select count(*)::int from collection_entries e where e.collection_id = p_collection and e.region_id = r.id),
    (select count(*)::int from collection_entries e where e.collection_id = p_collection and e.region_id = r.id and e.status = 'approved')
  from regions r where r.is_active
  order by r.sort_order, r.name
$$;

create or replace function public.col_monitoring_districts(p_collection uuid, p_region uuid)
returns table (district_id uuid, district_name text, entries_total int, draft int, submitted int, revision int, approved int, sent boolean)
language sql stable security invoker set search_path = public, pg_temp as $$
  select d.id, d.name,
    count(e.id)::int,
    (count(e.id) filter (where e.status = 'draft'))::int,
    (count(e.id) filter (where e.status = 'submitted'))::int,
    (count(e.id) filter (where e.status = 'revision'))::int,
    (count(e.id) filter (where e.status = 'approved'))::int,
    coalesce(bool_or(e.status in ('submitted', 'approved')), false)
  from districts d
  left join collection_entries e on e.district_id = d.id and e.collection_id = p_collection and e.deleted_at is null
  where d.region_id = p_region and d.is_active
  group by d.id, d.name, d.district_type
  order by d.district_type desc, d.name
$$;

revoke all on function public.col_public_save(uuid, text, text, text, uuid, jsonb),
  public.col_public_submit(uuid, text, uuid, text), public.tg_no_hard_delete(), public.tg_collection_entries_geo()
  from public, anon, authenticated;
grant execute on function public.col_public_save(uuid, text, text, text, uuid, jsonb),
  public.col_public_submit(uuid, text, uuid, text) to service_role;

revoke all on function public.col_review(uuid, text, text), public.col_monitoring_regions(uuid),
  public.col_monitoring_districts(uuid, uuid) from public, anon;
grant execute on function public.col_review(uuid, text, text), public.col_monitoring_regions(uuid),
  public.col_monitoring_districts(uuid, uuid) to authenticated;

-- administrator amallarini audit jurnaliga yozish (yig'ish yaratish/o'zgartirish)
create or replace function public.log_action(p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.profiles := public.app_current_profile();
begin
  if p.role <> 'super_admin' then raise exception 'Ruxsat yo''q'; end if;
  perform public.app_audit(p_action, p_entity_type, p_entity_id, p_details);
end $$;
revoke all on function public.log_action(text, text, uuid, jsonb) from public, anon;
grant execute on function public.log_action(text, text, uuid, jsonb) to authenticated;
