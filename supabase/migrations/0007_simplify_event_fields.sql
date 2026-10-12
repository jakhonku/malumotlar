-- 0007_simplify_event_fields.sql
-- Soddalashtirish: tadbir joyi nomi va vaqt endi talab qilinmaydi.
-- Yuborish uchun: manzil, tadbir o'tkaziladigan sana va asosiy mas'ul ijrochi yetarli.
-- (venue_name, start_time, end_time ustunlari saqlanib qoladi — eski ma'lumotlar yo'qolmaydi.)

create or replace function public.app_check_complete(p_event_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  e public.events;
  missing text[] := '{}';
begin
  select * into e from public.events where id = p_event_id;
  if e.address is null then missing := array_append(missing, 'manzil'); end if;
  if e.start_date is null then missing := array_append(missing, 'tadbir sanasi'); end if;
  if not exists (select 1 from public.event_responsibles where event_id = p_event_id and is_primary) then
    missing := array_append(missing, 'asosiy mas''ul ijrochi');
  end if;
  if array_length(missing, 1) > 0 then
    raise exception 'Yuborishdan oldin to''ldiring: %', array_to_string(missing, ', ');
  end if;
end $$;

revoke all on function public.app_check_complete(uuid) from public, anon, authenticated;
