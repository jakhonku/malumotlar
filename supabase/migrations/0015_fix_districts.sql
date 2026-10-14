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
