-- 0004_export_audit.sql
-- Hisobot yuklab olish amalini audit jurnaliga yozish (faqat faol foydalanuvchi uchun).

create or replace function public.log_export(p_details jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.profiles := public.app_current_profile();
begin
  perform public.app_audit('report.export', 'report', null, coalesce(p_details, '{}'::jsonb) || jsonb_build_object('role', p.role));
end $$;

revoke all on function public.log_export(jsonb) from public, anon;
grant execute on function public.log_export(jsonb) to authenticated;
