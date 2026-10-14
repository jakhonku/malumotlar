-- ISHGA TUSHIRISH: BIR MARTA, TO'LIQ MATNNI Supabase -> SQL Editor da Run qiling.
-- 1) 0015 tuman nomlari, 0016 yumshoq muddat, 0017 profil, 0018 hududlar tartibi (hammasi qayta ishga tushirishga xavfsiz)
-- 2) sinov ma'lumotlarini tozalash (yozuvlar, chat, xabarnoma, audit, limit jurnali)
-- Qoladi: hududlar, foydalanuvchilar, ma'lumot yig'ish sozlamalari, push obunalari.
-- DIQQAT: haqiqiy ma'lumot kela boshlagach 2-qismni (tozalash) QAYTA ISHGA TUSHIRMANG.

-- ===== 0015 =====
-- 0015: hududlar ro'yxatini rasmiy manbalarga moslash (takror ishga tushirish xavfsiz).
-- 1) "Yangirabot tumani" alohida tuman emas — Xatirchi tumanining markazi (Yangirabot shahri). Bog'langan yozuvlar Xatirchi tumaniga ko'chiriladi.
-- 2) Taxiatosh — Qoraqalpog'istondagi tuman (Taxiatosh tumani hokimligi mavjud), "shahar" emas.
-- 3) Yangi Namangan tumani (Namangan shahri tarkibida, Senat qarori 24.04.2021) qo'shiladi.
-- 4) G'ozg'on shahri (Navoiy viloyati bo'ysunuvidagi shahar, 2019-yildan) qo'shiladi.
do $$
declare
  v_nav uuid := (select id from public.regions where code = 'navoiy');
  v_nm  uuid := (select id from public.regions where code = 'namangan');
  v_qq  uuid := (select id from public.regions where code = 'qoraqalpogiston');
  v_old uuid;
  v_new uuid;
begin
  select id into v_old from public.districts where region_id = v_nav and name = 'Yangirabot tumani';
  select id into v_new from public.districts where region_id = v_nav and name = 'Xatirchi tumani';
  if v_old is not null and v_new is not null then
    update public.profiles set district_id = v_new where district_id = v_old;
    update public.events set district_id = v_new where district_id = v_old;
    update public.collection_entries set district_id = v_new where district_id = v_old;
    delete from public.districts where id = v_old;
  end if;

  update public.districts set name = 'Taxiatosh tumani', district_type = 'tuman'
   where region_id = v_qq and name = 'Taxiatosh shahri'
     and not exists (select 1 from public.districts where region_id = v_qq and name = 'Taxiatosh tumani');

  insert into public.districts (region_id, name, district_type)
  values (v_nm, 'Yangi Namangan tumani', 'tuman'), (v_nav, 'G‘ozg‘on shahri', 'shahar')
  on conflict (region_id, name) do nothing;
end $$;

-- ===== 0016 =====
-- 0016: muddat «yumshoq» bo'ladi — muddatdan keyin ham ma'lumot qabul qilinadi (kechikish KPI da hisobga olinadi).
-- Yig'ish faqat vazirlik administratori uni yopganda (is_active = false) yopiladi. Aks holda muddat o'tgach
-- qaytarilgan yozuvni tuzatish yoki kechikkan hududning ma'lumotini olish imkonsiz bo'lib qolardi.
-- Funksiyalar matni joyida tuzatiladi (takror ishga tushirish xavfsiz).
do $$
declare
  f record;
  def text;
  patched text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('col_public_save', 'col_public_submit')
  loop
    def := pg_get_functiondef(f.oid);
    patched := replace(def, 'if not c.is_active or (c.deadline is not null and c.deadline < current_date) then', 'if not c.is_active then');
    if patched <> def then execute patched; end if;
  end loop;
end $$;
notify pgrst, 'reload schema';

-- ===== 0017 =====
-- 0017: profil — foydalanuvchi o'zi F.I.Sh., lavozim va 3x4 rasmini to'ldiradi (majburiy emas); vazirlik ko'radi.
alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists position text check (position is null or length(position) <= 120);
notify pgrst, 'reload schema';

-- ===== 0018 =====
-- 0018: hududlar ro'yxati tartibi — Qoraqalpog'iston Respublikasi doim birinchi, so'ng viloyatlar, oxirida Toshkent shahri.
-- Qayta ishga tushirish xavfsiz.
update public.regions r set sort_order = v.n
from (values
  ('qoraqalpogiston', 1), ('andijon', 2), ('buxoro', 3), ('jizzax', 4), ('qashqadaryo', 5), ('navoiy', 6), ('namangan', 7),
  ('samarqand', 8), ('surxondaryo', 9), ('sirdaryo', 10), ('toshkent-v', 11), ('fargona', 12), ('xorazm', 13), ('toshkent-sh', 14)
) as v(code, n)
where r.code = v.code;

-- qo'lda qo'shilgan boshqa hududlar (agar bo'lsa) ro'yxat oxirida qoladi
update public.regions set sort_order = sort_order + 100
where code not in ('qoraqalpogiston','andijon','buxoro','jizzax','qashqadaryo','navoiy','namangan','samarqand','surxondaryo','sirdaryo','toshkent-v','fargona','xorazm','toshkent-sh')
  and sort_order <= 100;

-- ===== TOZALASH =====
-- MA'LUMOT YIG'ISHNI BOSHLASHDAN OLDIN TOZALASH (Supabase -> SQL Editor -> Run)
-- O'chadi: kiritilgan yozuvlar (qoralamalar ham), chat xabarlari, xabarnomalar, audit jurnali, limit jurnali.
-- (Imzolangan PDF fayllari SQL bilan o'chirilmaydi — Storage API orqali alohida tozalanadi.)
-- Qoladi: hududlar, foydalanuvchilar (admin va 14 boshqarma), ma'lumot yig'ish sozlamalari.
-- DIQQAT: haqiqiy ma'lumot kela boshlagach QAYTA ISHGA TUSHIRMANG.
truncate table
  public.collection_entries,
  public.messages,
  public.chat_reads,
  public.notifications,
  public.audit_logs,
  public.public_submission_log
restart identity cascade;

-- imzolangan PDF fayllari SQL bilan o'chirilmaydi (Supabase taqiqlaydi) — ularni Storage API orqali tozalash kerak.

insert into public.audit_logs (action, entity_type, details)
values ('system.launch', 'system', jsonb_build_object('note', 'Ma''lumot yig''ish boshlanishi uchun baza tozalandi'));

select 'yozuvlar' as jadval, count(*) from public.collection_entries
union all select 'xabarlar', count(*) from public.messages
union all select 'xabarnomalar', count(*) from public.notifications
union all select 'foydalanuvchilar (qoladi)', count(*) from public.profiles
union all select 'tuman/shaharlar (qoladi)', count(*) from public.districts;
