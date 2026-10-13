-- 0014: vazirlik administratori yuborilgan yozuvdagi ma'lumotni tahrirlay oladi (holati o'zgarmaydi, audit jurnaliga yoziladi).
create or replace function public.col_admin_update(p_entry uuid, p_answers jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  p public.profiles := public.app_current_profile();
  e public.collection_entries;
begin
  if p.role <> 'super_admin' then raise exception 'Bu amal faqat vazirlik administratori uchun'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then raise exception 'Javoblar noto''g''ri'; end if;
  select * into e from public.collection_entries where id = p_entry and deleted_at is null for update;
  if not found then raise exception 'Yozuv topilmadi'; end if;
  if e.status = 'draft' then raise exception 'Qoralamani tahrirlab bo''lmaydi'; end if;
  update public.collection_entries set answers = p_answers where id = e.id;
  perform public.app_audit('collection.entry.admin_update', 'collection_entry', e.id,
    jsonb_build_object('status', e.status));
end $$;

revoke all on function public.col_admin_update(uuid, jsonb) from public, anon;
grant execute on function public.col_admin_update(uuid, jsonb) to authenticated;
notify pgrst, 'reload schema';
