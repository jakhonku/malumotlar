-- 0021: foydalanuvchining oxirgi faollik vaqti (online/offline ko'rsatish uchun).
alter table public.profiles add column if not exists last_seen_at timestamptz;
notify pgrst, 'reload schema';
