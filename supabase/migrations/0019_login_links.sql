-- 0019: «tezkor kirish» havolalari — viloyat boshqarmasi havola orqali login-parolsiz kiradi (admin yaratadi, istalgan paytda bekor qilinadi).
-- Havolaning o'zi saqlanmaydi, faqat uning xeshi. Jadvalga faqat server (service_role) kiradi.
create table if not exists public.login_links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz,
  use_count   integer not null default 0
);
create index if not exists login_links_user_idx on public.login_links (user_id) where revoked_at is null;
alter table public.login_links enable row level security;
revoke all on public.login_links from anon, authenticated;
notify pgrst, 'reload schema';
