-- 0017: profil — foydalanuvchi o'zi F.I.Sh., lavozim va 3x4 rasmini to'ldiradi (majburiy emas); vazirlik ko'radi.
alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists position text check (position is null or length(position) <= 120);
notify pgrst, 'reload schema';
