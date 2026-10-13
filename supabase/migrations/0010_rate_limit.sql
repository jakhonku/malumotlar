-- 0010_rate_limit.sql
-- Bir IP dan soatiga ruxsat etilgan ochiq yozuvlar sonini 60 dan 600 ga oshiradi
-- (bitta idoradagi ko'p xodim bitta tashqi IP dan ishlaganda bloklanib qolmasligi uchun).
create or replace function public.app_public_rate_limit(p_ip_hash text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.public_submission_log where created_at < now() - interval '1 day';
  if (select count(*) from public.public_submission_log
        where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 600 then
    raise exception 'Juda ko''p so''rov yuborildi. Birozdan so''ng qayta urinib ko''ring';
  end if;
  insert into public.public_submission_log (ip_hash) values (p_ip_hash);
end $$;
revoke all on function public.app_public_rate_limit(text) from public, anon, authenticated;
