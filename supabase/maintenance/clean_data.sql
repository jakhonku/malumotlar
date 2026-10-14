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
union all select 'xabarlar', count(*) from public.messages;
