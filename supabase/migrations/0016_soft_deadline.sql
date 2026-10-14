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
