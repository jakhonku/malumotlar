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
