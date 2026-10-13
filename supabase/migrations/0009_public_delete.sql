-- 0009_public_delete.sql
-- Hudud o'z kiritgan, hali yuborilmagan (qoralama/qaytarilgan) yozuvini o'chira oladi (yumshoq o'chirish).
-- Yuborilgan yoki tasdiqlangan yozuvni o'chirib bo'lmaydi. Faqat server (service_role) chaqiradi.

create or replace function public.col_public_delete(p_collection uuid, p_token_hash text, p_entry_id uuid, p_ip_hash text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  e public.collection_entries;
begin
  perform public.app_public_rate_limit(p_ip_hash);
  select * into e from public.collection_entries
    where id = p_entry_id and collection_id = p_collection and edit_token_hash = p_token_hash and deleted_at is null
    for update;
  if not found then raise exception 'Hudud havolasi noto''g''ri yoki yozuv topilmadi'; end if;
  if e.status not in ('draft', 'revision') then
    raise exception 'Yuborilgan yozuvni o''chirib bo''lmaydi';
  end if;
  update public.collection_entries set deleted_at = now() where id = e.id;
  perform public.app_audit('collection.entry.delete', 'collection_entry', e.id, jsonb_build_object('source', 'public'));
end $$;

revoke all on function public.col_public_delete(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.col_public_delete(uuid, text, uuid, text) to service_role;
