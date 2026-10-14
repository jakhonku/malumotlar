-- 0020: bitta profilda faqat bitta faol sessiya — yangi kirishda eskisi chiqarib yuboriladi.
alter table public.profiles add column if not exists active_session_id uuid;
notify pgrst, 'reload schema';
