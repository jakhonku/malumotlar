-- 0011: (1) vazirlik (admin/kuzatuvchi) qoralamalarni ko'rmaydi; (2) admin ↔ boshqarma chati va umumiy xabar.

-- ---------------------------------------------------------------- 1) qoralamalar faqat o'z egasiga
drop policy if exists collection_entries_select on public.collection_entries;
create policy collection_entries_select on public.collection_entries for select to authenticated using (
  deleted_at is null and (
    (public.auth_role() = 'super_admin' and status <> 'draft')
    or (public.auth_role() = 'observer' and status <> 'draft' and (public.auth_region() is null or region_id = public.auth_region()))
    or (public.auth_role() = 'region_manager' and region_id = public.auth_region())
    or (public.auth_role() = 'district_manager' and district_id = public.auth_district())
  )
);

-- ---------------------------------------------------------------- 2) chat
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  -- null — umumiy xabar (barcha viloyat boshqarmalariga); aks holda shu foydalanuvchi bilan yozishma
  thread_user uuid references public.profiles (id) on delete cascade,
  sender_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index if not exists messages_thread_idx on public.messages (thread_user, created_at desc);

create table if not exists public.chat_reads (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  thread_key text not null,
  read_at    timestamptz not null default now(),
  primary key (user_id, thread_key)
);

alter table public.messages   enable row level security;
alter table public.chat_reads enable row level security;
revoke all on public.messages, public.chat_reads from anon, authenticated;
grant select on public.messages to authenticated;

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated using (
  public.auth_role() = 'super_admin'
  or thread_user = auth.uid()
  or (thread_user is null and public.auth_role() = 'region_manager')
);

create or replace function public.send_message(p_thread uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role public.user_role := public.auth_role();
  v_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_role is null then raise exception 'Ruxsat yo‘q'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 4000 then raise exception 'Xabar 1–4000 belgidan iborat bo‘lishi kerak'; end if;
  if v_role = 'super_admin' then
    if p_thread is not null and not exists (
      select 1 from public.profiles where id = p_thread and is_active and role <> 'super_admin'
    ) then raise exception 'Qabul qiluvchi topilmadi'; end if;
  else
    if p_thread is distinct from auth.uid() then raise exception 'Faqat vazirlik bilan yozishma mumkin'; end if;
  end if;
  insert into public.messages (thread_user, sender_id, body) values (p_thread, auth.uid(), v_body) returning id into v_id;
  insert into public.chat_reads (user_id, thread_key, read_at) values (auth.uid(), coalesce(p_thread::text, 'all'), now())
    on conflict (user_id, thread_key) do update set read_at = excluded.read_at;
  return v_id;
end $$;

create or replace function public.chat_mark_read(p_thread_key text)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.chat_reads (user_id, thread_key, read_at) values (auth.uid(), left(p_thread_key, 64), now())
  on conflict (user_id, thread_key) do update set read_at = excluded.read_at
$$;

-- o'qilmagan xabarlar (suhbat bo'yicha): qabul qiluvchi uchun, o'zi yozganlarini hisoblamaydi
create or replace function public.chat_unread_by_thread()
returns table (thread_key text, n int) language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(m.thread_user::text, 'all'), count(*)::int
  from public.messages m
  left join public.chat_reads r on r.user_id = auth.uid() and r.thread_key = coalesce(m.thread_user::text, 'all')
  where auth.uid() is not null and public.auth_role() is not null
    and m.sender_id <> auth.uid()
    and m.created_at > coalesce(r.read_at, '-infinity'::timestamptz)
    and (
      public.auth_role() = 'super_admin'
      or m.thread_user = auth.uid()
      or (m.thread_user is null and public.auth_role() = 'region_manager')
    )
  group by 1
$$;

revoke all on function public.send_message(uuid, text), public.chat_mark_read(text), public.chat_unread_by_thread() from public, anon;
grant execute on function public.send_message(uuid, text), public.chat_mark_read(text), public.chat_unread_by_thread() to authenticated;
