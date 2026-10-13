-- Supabase -> SQL Editor: shu faylning TO'LIQ matnini bir marta ishga tushiring (Run). Qayta ishga tushirish xavfsiz.
-- 1) 0012 — push-xabarnomalar jadvali;  2) 0013 — yuborilgan yozuvni tahrirlash.

-- 0012: brauzer push-xabarnomalari uchun obunalar (faqat server / service_role yozadi va o'qiydi)
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- 0013: yuborilgan (tasdiqlanmagan) yozuvni tahrirlash mumkin; tasdiqlanganini faqat vazirlik qayta ochadi.
-- Bir hududga bitta yozuv qoidasi — «allow_multiple = false» sozlamasi bilan (allaqachon mavjud).

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
    if e.status = 'approved' then
      raise exception 'Bu ma''lumot vazirlik tomonidan tasdiqlangan — tahrirlab bo''lmaydi. Tuzatish kerak bo''lsa, vazirlikka yozing';
    end if;
    -- yuborilgan (hali tasdiqlanmagan) yozuv tahrirlansa, holati o'zgarmaydi, yangilangan vaqt ko'rinadi
    update public.collection_entries
       set answers = v_answers,
           submitted_at = case when e.status = 'submitted' then now() else submitted_at end
     where id = e.id;
    v_id := e.id;
  end if;

  perform public.app_audit(case when p_entry_id is null then 'collection.entry.create' else 'collection.entry.update' end,
    'collection_entry', v_id, jsonb_build_object('collection', c.title, 'source', 'public', 'mode', v_mode));
  return v_id;
end $$;

revoke all on function public.col_public_save(uuid, text, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.col_public_save(uuid, text, text, text, uuid, jsonb) to service_role;
notify pgrst, 'reload schema';
