-- 0002_rls.sql
-- Row Level Security: o'qish ruxsatlari siyosatlar bilan, yozish esa faqat
-- SECURITY DEFINER funksiyalar (0003) yoki super_admin siyosatlari orqali.

-- ---------------------------------------------------------------- yordamchi funksiyalar
create or replace function public.auth_role()
returns public.user_role language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.auth_region()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select region_id from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.auth_district()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select district_id from public.profiles where id = auth.uid() and is_active
$$;

revoke all on function public.auth_role(), public.auth_region(), public.auth_district() from public, anon;
grant execute on function public.auth_role(), public.auth_region(), public.auth_district() to authenticated;

-- ---------------------------------------------------------------- huquqlar
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon;

-- siyosat bilan boshqariladigan yozuvlar
grant insert, update on public.regions, public.districts to authenticated;
grant update (is_read) on public.notifications to authenticated;

-- ---------------------------------------------------------------- RLS yoqish
alter table public.regions              enable row level security;
alter table public.districts            enable row level security;
alter table public.profiles             enable row level security;
alter table public.events               enable row level security;
alter table public.event_artists        enable row level security;
alter table public.event_participants   enable row level security;
alter table public.event_responsibles   enable row level security;
alter table public.event_status_history enable row level security;
alter table public.notifications        enable row level security;
alter table public.audit_logs           enable row level security;

-- ---------------------------------------------------------------- hududlar (hamma o'qiydi, faqat admin yozadi)
create policy regions_select on public.regions for select to authenticated using (true);
create policy regions_insert on public.regions for insert to authenticated
  with check (public.auth_role() = 'super_admin');
create policy regions_update on public.regions for update to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

create policy districts_select on public.districts for select to authenticated using (true);
create policy districts_insert on public.districts for insert to authenticated
  with check (public.auth_role() = 'super_admin');
create policy districts_update on public.districts for update to authenticated
  using (public.auth_role() = 'super_admin') with check (public.auth_role() = 'super_admin');

-- ---------------------------------------------------------------- profillar (faqat o'qish; o'zgartirish yo'q)
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.auth_role() in ('super_admin', 'observer')
  or (public.auth_role() = 'region_manager' and region_id = public.auth_region())
);

-- ---------------------------------------------------------------- tadbirlar (ko'rish doirasi)
create policy events_select on public.events for select to authenticated using (
  deleted_at is null and (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'observer'
        and (public.auth_region() is null or region_id = public.auth_region()))
    or (public.auth_role() = 'region_manager' and region_id = public.auth_region())
    or (public.auth_role() = 'district_manager' and district_id = public.auth_district())
  )
);

-- bog'liq jadvallar: tadbir ko'rinsa, ular ham ko'rinadi (events RLS qo'llanadi)
create policy artists_select on public.event_artists for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id));
create policy participants_select on public.event_participants for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id));
create policy responsibles_select on public.event_responsibles for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id));
create policy history_select on public.event_status_history for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id));

-- ---------------------------------------------------------------- xabarnomalar
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- audit jurnali
create policy audit_select on public.audit_logs for select to authenticated
  using (public.auth_role() = 'super_admin');
