-- 0001_schema.sql
-- Madaniyat vazirligi — Yangi yil tadbirlari monitoring platformasi: asosiy sxema.
-- Faqat yangi obyektlar yaratadi, mavjud ma'lumotlarni o'zgartirmaydi.

create type public.user_role as enum ('super_admin', 'region_manager', 'district_manager', 'observer');
create type public.event_status as enum ('draft', 'submitted', 'revision', 'approved');
create type public.event_scope as enum ('regional', 'district');
-- Tadbir ma'lumoti hozir kimning ko'rigida turibdi
create type public.review_stage as enum ('district', 'region', 'ministry');

-- ---------------------------------------------------------------- umumiy trigger
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- hududlar
create table public.regions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null unique,
  region_type text not null check (region_type in ('respublika', 'viloyat', 'shahar')),
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.districts (
  id            uuid primary key default gen_random_uuid(),
  region_id     uuid not null references public.regions (id) on delete restrict,
  name          text not null,
  district_type text not null check (district_type in ('tuman', 'shahar')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (region_id, name)
);
create index districts_region_idx on public.districts (region_id);

create trigger regions_updated before update on public.regions
  for each row execute function public.tg_set_updated_at();
create trigger districts_updated before update on public.districts
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------- profillar
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  username           text not null unique check (username ~ '^[a-z0-9._-]{3,40}$'),
  full_name          text not null check (length(trim(full_name)) >= 3),
  role               public.user_role not null,
  region_id          uuid references public.regions (id) on delete restrict,
  district_id        uuid references public.districts (id) on delete restrict,
  phone              text,
  -- viloyat mas'uliga tuman nomidan ma'lumot kiritish/tahrirlash uchun alohida ruxsat
  can_edit_districts boolean not null default false,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint profiles_scope_chk check (
    (role = 'super_admin'      and region_id is null     and district_id is null) or
    (role = 'region_manager'   and region_id is not null and district_id is null) or
    (role = 'district_manager' and region_id is not null and district_id is not null) or
    (role = 'observer'         and district_id is null)
  )
);
create index profiles_region_idx on public.profiles (region_id);
create index profiles_district_idx on public.profiles (district_id);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- tuman tanlangan viloyatga tegishli bo'lishi shart
create or replace function public.tg_profiles_geo()
returns trigger language plpgsql as $$
begin
  if new.district_id is not null and not exists (
    select 1 from public.districts d where d.id = new.district_id and d.region_id = new.region_id
  ) then
    raise exception 'Tanlangan tuman/shahar ushbu viloyatga tegishli emas';
  end if;
  return new;
end $$;
create trigger profiles_geo before insert or update on public.profiles
  for each row execute function public.tg_profiles_geo();

-- ---------------------------------------------------------------- tadbirlar
create table public.events (
  id                uuid primary key default gen_random_uuid(),
  region_id         uuid not null references public.regions (id) on delete restrict,
  district_id       uuid references public.districts (id) on delete restrict,
  event_scope       public.event_scope not null,
  title             text not null check (length(trim(title)) >= 3),
  event_type        text,
  description       text,
  venue_name        text,
  address           text,
  location_note     text,
  start_date        date,
  end_date          date,
  start_time        time,
  end_time          time,
  organization_name text,
  notes             text,
  status            public.event_status not null default 'draft',
  stage             public.review_stage not null,
  created_by        uuid not null references public.profiles (id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  submitted_at      timestamptz,
  approved_at       timestamptz,
  deleted_at        timestamptz,
  constraint events_scope_chk check (
    (event_scope = 'regional' and district_id is null) or
    (event_scope = 'district' and district_id is not null)
  ),
  constraint events_dates_chk check (
    start_date is null or end_date is null or end_date >= start_date
  ),
  constraint events_times_chk check (
    start_date is null or end_date is null or start_time is null or end_time is null
    or start_date <> end_date or end_time >= start_time
  )
);
create index events_region_idx   on public.events (region_id) where deleted_at is null;
create index events_district_idx on public.events (district_id) where deleted_at is null;
create index events_status_idx   on public.events (status, stage) where deleted_at is null;
create index events_start_idx    on public.events (start_date) where deleted_at is null;
create index events_scope_idx    on public.events (event_scope) where deleted_at is null;
create index events_creator_idx  on public.events (created_by);
create trigger events_updated before update on public.events
  for each row execute function public.tg_set_updated_at();

-- server tomonida tekshiruv: tuman aynan region_id ga tegishli bo'lishi shart
create or replace function public.tg_events_geo()
returns trigger language plpgsql as $$
begin
  if new.event_scope = 'district' then
    if not exists (
      select 1 from public.districts d where d.id = new.district_id and d.region_id = new.region_id
    ) then
      raise exception 'Tanlangan tuman/shahar ushbu viloyatga tegishli emas';
    end if;
  end if;
  return new;
end $$;
create trigger events_geo before insert or update on public.events
  for each row execute function public.tg_events_geo();

-- tasodifiy o'chirib yuborishdan himoya: faqat qoralamani (va faqat service orqali) o'chirish mumkin
create or replace function public.tg_events_no_delete()
returns trigger language plpgsql as $$
begin
  if old.status <> 'draft' then
    raise exception 'Yuborilgan yoki tasdiqlangan tadbirni o''chirib bo''lmaydi';
  end if;
  return old;
end $$;
create trigger events_no_delete before delete on public.events
  for each row execute function public.tg_events_no_delete();

-- ---------------------------------------------------------------- bog'liq jadvallar
create table public.event_artists (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events (id) on delete cascade,
  artist_name      text not null check (length(trim(artist_name)) >= 2),
  artist_type      text not null default 'artist' check (artist_type in ('artist', 'group')),
  performance_type text,
  role_description text,
  notes            text,
  sort_order       int not null default 0
);
create index event_artists_event_idx on public.event_artists (event_id);
create index event_artists_name_idx  on public.event_artists (lower(artist_name));

create table public.event_participants (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null references public.events (id) on delete cascade,
  participant_name     text not null check (length(trim(participant_name)) >= 2),
  participant_category text,
  participant_count    int check (participant_count is null or participant_count >= 0),
  participation_role   text,
  notes                text,
  sort_order           int not null default 0
);
create index event_participants_event_idx on public.event_participants (event_id);

create table public.event_responsibles (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events (id) on delete cascade,
  full_name    text not null check (length(trim(full_name)) >= 3),
  position     text not null check (length(trim(position)) >= 2),
  organization text,
  phone        text not null check (phone ~ '^\+998[0-9]{9}$'),
  is_primary   boolean not null default false,
  notes        text,
  sort_order   int not null default 0
);
create index event_responsibles_event_idx on public.event_responsibles (event_id);
create index event_responsibles_name_idx  on public.event_responsibles (lower(full_name));
create index event_responsibles_phone_idx on public.event_responsibles (phone);
-- bitta tadbirda faqat bitta asosiy mas'ul
create unique index event_responsibles_one_primary on public.event_responsibles (event_id) where is_primary;

-- ---------------------------------------------------------------- tarix, xabarnoma, audit
create table public.event_status_history (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  changed_by uuid references public.profiles (id) on delete set null,
  old_status public.event_status,
  new_status public.event_status not null,
  old_stage  public.review_stage,
  new_stage  public.review_stage,
  action     text not null,
  comment    text,
  created_at timestamptz not null default now()
);
create index event_status_history_event_idx on public.event_status_history (event_id, created_at);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  event_id   uuid references public.events (id) on delete cascade,
  title      text not null,
  message    text not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, is_read, created_at desc);

create table public.audit_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx  on public.audit_logs (entity_type, entity_id);

-- tarix va audit o'zgartirib bo'lmaydi
create or replace function public.tg_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'Bu jadval yozuvlarini o''zgartirib yoki o''chirib bo''lmaydi';
end $$;
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function public.tg_immutable();
create trigger status_history_immutable before update or delete on public.event_status_history
  for each row execute function public.tg_immutable();
