# MASTER PROMPT — MADANIYAT VAZIRLIGI YANGI YIL TADBIRLARI MONITORING PLATFORMASI

Sen Senior Full-Stack Developer, Software Architect, Database Engineer, Security Engineer va Professional UI/UX Designer sifatida ishlaysan.

O‘zbekiston Respublikasi Madaniyat vazirligi uchun respublika hududlarida o‘tkaziladigan Yangi yil tadbirlari haqidagi ma’lumotlarni yig‘ish, boshqarish, tekshirish, monitoring qilish va rasmiy Microsoft Word hujjati ko‘rinishida shakllantirish imkonini beruvchi professional veb-platforma yarat.

Loyiha oddiy demo yoki statik dizayn bo‘lmasin. Ma’lumotlar bazasi, foydalanuvchilar, autentifikatsiya, rollar, hududlar, formalar, tasdiqlash jarayoni, monitoring va Word eksporti haqiqatan ishlaydigan tizim bo‘lsin.

Barcha interfeyslar o‘zbek tilida, lotin yozuvida bo‘lsin.

# 1. LOYIHANING ASOSIY MAQSADI

Madaniyat vazirligi barcha hududlardan Yangi yil tadbirlari haqidagi ma’lumotlarni yagona elektron platforma orqali yig‘ishi kerak.

Platformada:

- Viloyatning o‘z asosiy tadbirlari alohida kiritiladi.
- Har bir tuman va shahar o‘z tadbirlarini mustaqil kiritadi.
- Viloyat mas’uli viloyatning asosiy tadbirlarini kiritadi va o‘ziga tegishli tumanlar ma’lumotlarini nazorat qiladi.
- Tuman/shahar mas’uli faqat o‘z hududining tadbirlarini kiritadi.
- Barcha ma’lumotlar vazirlikning yagona boshqaruv panelida jamlanadi.
- Har bir tadbir bo‘yicha joy, manzil, sana, vaqt, san’atkorlar, ishtirokchilar, mas’ul ijrochilar, lavozimlar va telefon raqamlari saqlanadi.
- Barcha ma’lumotlar hududlar kesimida tartiblanadi.
- Vazirlik bitta tugma orqali rasmiy Word hisobotini yaratadi.

ASOSIY QOIDA: viloyatning asosiy tadbirlari tuman tadbirlari bilan aralashib ketmasligi kerak. Lekin ikkala turdagi tadbirlar ham umumiy hisobotga kiritilishi mumkin bo‘lsin.

# 2. TEXNOLOGIK STACK

Quyidagi texnologiyalardan foydalan:

- Next.js App Router.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- Supabase PostgreSQL.
- Supabase Auth.
- Supabase Row Level Security (RLS).
- React Hook Form.
- Zod.
- `docx` npm paketi.
- `date-fns`.
- Lucide ikonkalari.
- Vercel deployment.

Agar mavjud loyiha boshqa mos texnologiyalar bilan yozilgan bo‘lsa, avval uni tekshir va zaruratsiz qayta yozma.

Loyiha modulli, xavfsiz, kengaytiriladigan va ishlab chiqarish muhitiga mos bo‘lsin.

# 3. FOYDALANUVCHI ROLLARI

## 3.1. Vazirlik super administratori

Super administrator quyidagi imkoniyatlarga ega bo‘lsin:

- Respublika bo‘yicha barcha tadbirlarni ko‘rish.
- Barcha viloyat, tuman va shaharlar ma’lumotlarini ko‘rish.
- Barcha hududlarning topshiriq bajarish holatini monitoring qilish.
- Foydalanuvchilar yaratish va ularni hududlarga biriktirish.
- Foydalanuvchilarning rollarini boshqarish.
- Ma’lumotlarni tekshirish, tasdiqlash yoki qayta ishlashga qaytarish.
- Ma’lumotlarni zarur hollarda tahrirlash.
- Tasdiqlangan ma’lumotlarni qayta ochish.
- Barcha ma’lumotlardan Word hisoboti yaratish.
- Viloyat, tuman, sana va tadbir turi bo‘yicha hisobot olish.
- Audit jurnalini ko‘rish.
- Hududlar ro‘yxatini boshqarish.

## 3.2. Viloyat mas’uli

Viloyat mas’uli tizimga kirganda o‘z hududi uchun alohida boshqaruv panelini ko‘rsin.

Uning imkoniyatlari:

1. Viloyatning asosiy tadbirlarini mustaqil kiritish.
2. Viloyat miqyosidagi bir nechta tadbirni ro‘yxatdan o‘tkazish.
3. Tadbir joyi, manzili, muddati va vaqtini ko‘rsatish.
4. San’atkorlar, ijodiy jamoalar, ishtirokchilar va mas’ul ijrochilarni kiritish.
5. O‘zining asosiy tadbirlarini tahrirlash va vazirlikka yuborish.
6. O‘z viloyatiga tegishli tuman va shaharlar ro‘yxatini ko‘rish.
7. Har bir tuman ma’lumot yuborgan yoki yubormaganini ko‘rish.
8. Tumanlardan kelgan ma’lumotlarni tekshirish.
9. Tuman ma’lumotlarini vazirlikka yuborish.
10. O‘z viloyati bo‘yicha Word hisoboti olish.

Viloyat mas’uli tumanlar ma’lumotini nazorat qilishi mumkin, lekin tuman nomidan tadbir kiritishi yoki tuman ma’lumotlarini o‘zgartirishi faqat unga alohida ruxsat berilganida mumkin bo‘lsin.

## 3.3. Tuman/shahar mas’uli

Har bir tuman yoki shahar mas’uli o‘zining alohida login va paroli bilan kiradi.

U quyidagilarni bajara olsin:

- O‘z tumanining tadbirlarini kiritish.
- Bir nechta tadbir qo‘shish.
- Tadbir sanasi va vaqtini ko‘rsatish.
- Tadbir joyi va manzilini yozish.
- San’atkorlar va ijodiy jamoalarni qo‘shish.
- Ishtirokchilar ma’lumotlarini kiritish.
- Mas’ul ijrochilarning F.I.Sh., lavozimi va telefonini kiritish.
- Qoralama saqlash.
- Ma’lumotni viloyat mas’uliga yuborish.
- Qaytarilgan ma’lumotni tahrirlab, qayta yuborish.
- O‘z yuborgan ma’lumotlarining holatini kuzatish.

Tuman mas’uli boshqa tuman yoki viloyatning maxfiy ma’lumotlarini ko‘ra olmasin va o‘zgartira olmasin.

## 3.4. Kuzatuvchi roli

Zarurat bo‘lsa, faqat ko‘rish huquqiga ega kuzatuvchi rolini ham qo‘sh. Bu rolga ma’lumotlarni o‘zgartirish yoki tasdiqlash huquqini bermagin.

# 4. O‘ZBEKISTON HUDUDLARINING IERARXIK RO‘YXATI

Platformada quyidagi 14 ta asosiy hudud bo‘lsin:

1. Qoraqalpog‘iston Respublikasi.
2. Andijon viloyati.
3. Buxoro viloyati.
4. Jizzax viloyati.
5. Qashqadaryo viloyati.
6. Navoiy viloyati.
7. Namangan viloyati.
8. Samarqand viloyati.
9. Surxondaryo viloyati.
10. Sirdaryo viloyati.
11. Toshkent viloyati.
12. Farg‘ona viloyati.
13. Xorazm viloyati.
14. Toshkent shahri.

Har bir hududga tegishli rasmiy tuman va shaharlar ro‘yxatini alohida ma’lumotlar bazasida saqla.

Tuman va shaharlarning ma’muriy-hududiy tegishliligini aralashtirma. Ayniqsa, Toshkent shahri tumanlarini Toshkent viloyati tumanlaridan ajrat.

Hududlar ierarxiyasi:

Respublika → Viloyat/hudud → Tuman/shahar → Tadbirlar.

Tuman yoki shahar o‘zining tegishli hududiga tashqi kalit orqali bog‘langan bo‘lsin.

Ro‘yxatlar administrator tomonidan boshqarilsin. Hududlarni keyinchalik qo‘shish, tahrirlash yoki faolsizlantirish mumkin bo‘lsin.

# 5. VILOYAT ASOSIY TADBIRI VA TUMAN TADBIRLARINI AJRATISH

BU LOYIHANING ENG MUHIM TALABI.

Har bir hududda ikkita alohida turdagi ma’lumot bo‘lsin.

## 5.1. Viloyatning asosiy tadbirlari

Viloyat mas’uli o‘z viloyatining asosiy tadbirlarini mustaqil ravishda kiritadi.

Masalan, viloyat markazida yoki viloyat miqyosida tashkil etiladigan Yangi yil konserti.

Bu tadbirlar:

- Alohida bo‘limda ko‘rsatiladi.
- Tuman tadbirlari sifatida belgilanmaydi.
- Viloyat mas’ulining hisobida turadi.
- Vazirlikning umumiy hisobotiga kiritiladi.

Ma’lumotlar bazasida `event_scope = regional` bo‘lsin va `district_id = NULL` bo‘lsin.

## 5.2. Tuman va shaharlarning mustaqil tadbirlari

Har bir tuman/shahar mas’uli o‘z tadbirlarini mustaqil ravishda kiritadi.

Masalan, Urgut tumani o‘zining Yangi yil bayram dasturini kiritadi.

Bu tadbirlar:

- Tegishli tuman yoki shaharga biriktiriladi.
- Viloyatning asosiy tadbirlaridan alohida turadi.
- Avval viloyat mas’uliga yuboriladi.
- Viloyat tekshiruvidan so‘ng vazirlikka yuboriladi.
- Umumiy Word hisobotida tegishli tuman nomi ostida ko‘rsatiladi.

Ma’lumotlar bazasida `event_scope = district` va `district_id` tegishli tuman identifikatoriga teng bo‘lsin.

Server tomonida hudud va tuman bir-biriga mos kelishi shartligini tekshir.

# 6. TADBIR MA’LUMOTLARINI KIRITISH FORMASI

Har bir tadbir uchun quyidagi maydonlarni yarat.

## A. Asosiy ma’lumotlar

- Tadbir nomi.
- Tadbir turi.
- Tadbirning qisqacha mazmuni.
- Tadbir ko‘lami: viloyat asosiy tadbiri yoki tuman/shahar tadbiri.
- Viloyat/hudud.
- Tuman/shahar.
- Tashkilot yoki muassasa nomi.
- Qo‘shimcha izoh.

Viloyat mas’ulida viloyat hududi avtomatik tanlansin. Tuman mas’ulida viloyat va tuman avtomatik belgilansin.

Foydalanuvchi o‘ziga biriktirilgan hududni o‘zgartira olmasin.

## B. Tadbir o‘tkaziladigan joy

- Joy nomi.
- To‘liq manzil.
- Zarur bo‘lsa, qo‘shimcha lokatsiya tavsifi.

## C. Tadbir muddati

- Boshlanish sanasi.
- Tugash sanasi.
- Boshlanish vaqti.
- Tugash vaqti.

Sana kalendar orqali, vaqt esa vaqt tanlagich orqali kiritilsin.

Bir kunlik tadbirda boshlanish va tugash sanasi bir xil bo‘lishi mumkin.

Bir necha kun davom etadigan tadbirlar qo‘llab-quvvatlansin.

## D. San’atkorlar va ijodiy jamoalar

Bitta tadbirga bir nechta san’atkor yoki ijodiy jamoa qo‘shish mumkin bo‘lsin.

Har bir yozuvda:

- San’atkor F.I.Sh.
- Yoki ijodiy jamoa nomi.
- Ijro yo‘nalishi yoki turi.
- Tadbirdagi vazifasi.
- Izoh.

San’atkor va jamoalarni alohida yozuvlar sifatida saqla.

Foydalanuvchini barcha san’atkorlarni bitta matn maydoniga yozishga majburlama.

## E. Tadbir ishtirokchilari

Tadbir ishtirokchilari haqidagi ma’lumotlar alohida bo‘limda bo‘lsin.

Quyidagi maydonlarni qo‘sh:

- Ishtirokchi yoki tashkilot nomi.
- Ishtirokchilar toifasi.
- Ishtirokchilar soni — ma’lum bo‘lsa.
- Ishtirokdagi vazifasi.
- Izoh.

Bitta tadbirga bir nechta ishtirokchi guruhi yoki tashkilot biriktirilishi mumkin bo‘lsin.

San’atkorlar va oddiy ishtirokchilar ro‘yxati bir-biridan ajratilsin.

## F. Mas’ul ijrochilar

Har bir tadbirga bir yoki bir nechta mas’ul ijrochi biriktirish mumkin bo‘lsin.

Har bir mas’ul uchun:

- F.I.Sh.
- Lavozimi.
- Ish joyi yoki tashkiloti.
- Telefon raqami.
- Asosiy mas’ul yoki qo‘shimcha mas’ul ekanligi.
- Izoh.

Bitta mas’ul asosiy mas’ul sifatida belgilansin.

Telefon raqami O‘zbekiston formatiga mos tekshirilsin. F.I.Sh., lavozim va telefon alohida maydonlarda saqlansin.

# 7. FORMALAR VA FOYDALANISH QULAYLIGI

Formalar bosqichlarga ajratilsin:

1. Tadbirning asosiy ma’lumotlari.
2. Joy va muddat.
3. San’atkorlar va ijodiy jamoalar.
4. Ishtirokchilar.
5. Mas’ul ijrochilar.
6. Yakuniy tekshirish va yuborish.

Foydalanuvchi istalgan bosqichda avvalgi bosqichga qayta olsin.

Quyidagi tugmalar bo‘lsin:

- Qoralama sifatida saqlash.
- Oldingi bosqich.
- Keyingi bosqich.
- Ma’lumotlarni tekshirish.
- Yuborish.

Majburiy maydonlar tekshirilsin. Xatolar o‘zbek tilida tushuntirilsin.

Takroriy tadbir ehtimoli aniqlansa, ogohlantirish ko‘rsatilsin. Biroq bir joyda bir kunda bir nechta turli tadbir o‘tkazishga ruxsat berilsin.

# 8. TOPSHIRISH VA TASDIQLASH JARAYONI

Quyidagi statuslardan foydalan:

- `draft` — qoralama.
- `submitted` — yuborilgan.
- `revision` — qayta ishlashga qaytarilgan.
- `approved` — tasdiqlangan.

Jarayon:

Tuman mas’uli → Viloyat mas’uli → Vazirlik.

Viloyatning asosiy tadbirlari uchun jarayon:

Viloyat mas’uli → Vazirlik.

Har bir bosqichda ma’lumotni tekshirish imkoniyati bo‘lsin.

Qaytarishda sabab yozish majburiy bo‘lsin.

Tasdiqlangan tadbirni oddiy foydalanuvchi o‘zgartira olmasin. Uni qayta ochish faqat tegishli ruxsat bilan amalga oshirilsin.

Holat o‘zgarishlari tarixda saqlansin.

# 9. VAZIRLIK ADMIN PANELI

Professional boshqaruv panelini yarat.

## Statistik kartalar

- Jami tadbirlar.
- Viloyat asosiy tadbirlari.
- Tuman va shahar tadbirlari.
- Ma’lumot yuborgan hududlar.
- Ma’lumot yubormagan hududlar.
- Tasdiqlash kutilayotgan tadbirlar.
- Qayta ishlashga qaytarilgan tadbirlar.

Statistika haqiqiy ma’lumotlar bazasidan olinsin.

## Navigatsiya

- Bosh sahifa.
- Barcha tadbirlar.
- Viloyat asosiy tadbirlari.
- Tuman/shahar tadbirlari.
- Hududlar monitoringi.
- Tasdiqlash markazi.
- San’atkorlar va ijodiy jamoalar.
- Mas’ul ijrochilar.
- Word hisobotlari.
- Foydalanuvchilar.
- Audit jurnali.
- Sozlamalar.

## Qidiruv va filtrlar

Quyidagilar bo‘yicha qidirish va filtrlash mumkin bo‘lsin:

- Viloyat.
- Tuman/shahar.
- Tadbir turi.
- Sana oralig‘i.
- San’atkor yoki jamoa nomi.
- Mas’ul F.I.Sh.
- Telefon raqami.
- Tasdiqlash holati.

Jadvalda sahifalash, saralash va mobil ekranlarga moslashish bo‘lsin.

# 10. HUDUDLAR MONITORINGI

Vazirlik har bir hududning topshiriq bajarish holatini ko‘rsin.

Har bir viloyat uchun:

- Viloyatning asosiy tadbiri kiritilganmi?
- Viloyat asosiy tadbirlari soni.
- Jami tuman va shaharlar soni.
- Ma’lumot yuborgan tumanlar soni.
- Ma’lumot yubormagan tumanlar soni.
- Tasdiqlangan tadbirlar soni.
- Kutilayotgan tadbirlar soni.

Har bir viloyat ochilganda uning tumanlari ro‘yxati ko‘rinsin.

Har bir tuman qatorida ma’lumot yuborish holati, tadbirlar soni va tasdiqlash holati ko‘rsatilsin.

Agar tuman ma’lumot yubormagan bo‘lsa, “Ma’lumot yuborilmagan” deb ko‘rsat.

Tuman tadbiri mavjudligi viloyatning asosiy tadbiri mavjudligi bilan aralashtirilmasin. Ular mustaqil tekshirilsin.

# 11. ASOSIY JADVAL

Barcha tadbirlar quyidagi ustunlarda ko‘rsatilsin:

1. №.
2. Viloyat/hudud.
3. Tadbir darajasi.
4. Tuman/shahar.
5. Tadbir nomi.
6. O‘tkaziladigan joy.
7. Manzil.
8. Boshlanish sanasi.
9. Tugash sanasi.
10. Boshlanish vaqti.
11. Tugash vaqti.
12. San’atkorlar va ijodiy jamoalar.
13. Ishtirokchilar haqidagi ma’lumotlar.
14. Mas’ul ijrochi F.I.Sh.
15. Lavozimi.
16. Telefon raqami.
17. Holati.

Keng jadvalda barcha ustunlarni bitta ekranga majburan sig‘dirma.

Asosiy jadvalda muhim ustunlar ko‘rsatilsin, qolgan ma’lumotlar esa “Batafsil ko‘rish” sahifasida ochilsin.

# 12. WORD HISOBOTI — LOYIHANING ASOSIY FUNKSIYASI

Vazirlik panelida ko‘zga yaqqol tashlanadigan “WORD HISOBOTINI YARATISH” tugmasi bo‘lsin.

Tugma bosilganda haqiqiy Microsoft Word `.docx` fayli yaratilishi va yuklab olinishi kerak.

HTML faylga `.docx` kengaytmasi berish taqiqlanadi. Haqiqiy Word hujjati yaratish uchun `docx` npm paketidan foydalan.

## 12.1. Hisobot sarlavhasi

O‘ZBEKISTON RESPUBLIKASI MADANIYAT VAZIRLIGI

YANGI YIL BAYRAMI MUNOSABATI BILAN O‘TKAZILADIGAN TADBIRLAR TO‘G‘RISIDA MA’LUMOT

## 12.2. Word hujjatining tuzilishi

Hujjatda quyidagi tartibdan foydalan:

1. Viloyat/hudud nomi.
2. “Viloyatning asosiy tadbirlari” bo‘limi.
3. Viloyatning asosiy tadbirlari jadvali.
4. “Tuman va shaharlar tadbirlari” bo‘limi.
5. Har bir tuman/shahar nomi.
6. Shu tuman/shaharning tadbirlari jadvali.

Har bir tadbir uchun:

- Tadbir nomi.
- O‘tkaziladigan joy va manzil.
- Boshlanish va tugash sanasi.
- Boshlanish va tugash vaqti.
- San’atkorlar va ijodiy jamoalar.
- Ishtirokchilar haqidagi ma’lumotlar.
- Mas’ul ijrochilarning F.I.Sh.
- Lavozimi.
- Telefon raqami.

Bir nechta san’atkor, ishtirokchi yoki mas’ul bo‘lsa, ularning barchasi tartibli va o‘qilishi oson ko‘rsatilsin.

## 12.3. Word formatlash

- A4 format.
- Times New Roman.
- Asosiy matn 12–14 pt.
- Jadval matni 9–11 pt.
- Rasmiy, sodda va professional dizayn.
- Jadval chegaralari.
- Qalin sarlavhalar.
- To‘g‘ri sahifa chetlari.
- Jadval ustunlarining sahifaga mos joylashuvi.
- Keyingi sahifalarda jadval sarlavha qatorlarining takrorlanishi.
- Sahifalar bo‘yicha avtomatik davom etish.
- Matnlarning sahifa chegarasidan chiqib ketmasligi.
- Kerakli joylarda sahifa raqamlari.

Word hujjatining yuqori qismida hisobot nomi va yaratilgan sana ko‘rsatilsin.

## 12.4. Eksport turlari

Quyidagi hisobotlarni yaratish mumkin bo‘lsin:

1. Butun respublika bo‘yicha barcha hududlar.
2. Bitta viloyat bo‘yicha.
3. Bitta tuman/shahar bo‘yicha.
4. Faqat viloyat asosiy tadbirlari.
5. Faqat tuman/shahar tadbirlari.
6. Tanlangan sana oralig‘i.
7. Faqat tasdiqlangan tadbirlar.
8. San’atkorlar va ijodiy jamoalar ro‘yxati.
9. Mas’ul ijrochilar ro‘yxati.

Hisobot yaratishdan oldin filtrlarni tanlash mumkin bo‘lsin.

Standart rejimda yakuniy rasmiy hisobotga tasdiqlangan ma’lumotlar kiritilsin. Administrator boshqa statuslarni ham alohida tanlab eksport qila olsin.

Fayl nomi hudud va hisobot sanasiga qarab shakllantirilsin. Masalan:

`Yangi_yil_tadbirlari_2026-12-15.docx`

Bo‘sh ma’lumotlar yoki mavjud bo‘lmagan tadbirlarni to‘qib chiqarma. Bo‘sh bo‘limlarni yashirish yoki “Ma’lumot kiritilmagan” deb belgilash imkoniyati bo‘lsin.

# 13. MA’LUMOTLAR BAZASI

Quyidagi jadvallarni yarat yoki mavjudlarini xavfsiz kengaytir:

### `profiles`
- `id`
- `full_name`
- `role`
- `region_id`
- `district_id`
- `is_active`
- `created_at`
- `updated_at`

### `regions`
- `id`
- `name`
- `region_type`
- `is_active`

### `districts`
- `id`
- `region_id`
- `name`
- `district_type`
- `is_active`

### `events`
- `id`
- `region_id`
- `district_id`
- `event_scope`
- `title`
- `event_type`
- `description`
- `venue_name`
- `address`
- `start_date`
- `end_date`
- `start_time`
- `end_time`
- `organization_name`
- `status`
- `created_by`
- `created_at`
- `updated_at`
- `submitted_at`
- `approved_at`

### `event_artists`
- `id`
- `event_id`
- `artist_name`
- `artist_type`
- `performance_type`
- `role_description`
- `notes`

### `event_participants`
- `id`
- `event_id`
- `participant_name`
- `participant_category`
- `participant_count`
- `participation_role`
- `notes`

### `event_responsibles`
- `id`
- `event_id`
- `full_name`
- `position`
- `organization`
- `phone`
- `is_primary`
- `notes`

### `event_status_history`
- `id`
- `event_id`
- `changed_by`
- `old_status`
- `new_status`
- `comment`
- `created_at`

### `notifications`
- `id`
- `user_id`
- `title`
- `message`
- `is_read`
- `created_at`

### `audit_logs`
- `id`
- `user_id`
- `action`
- `entity_type`
- `entity_id`
- `details`
- `created_at`

Barcha jadvallarda mos ma’lumot turlari, tashqi kalitlar, indekslar va kerakli cheklovlar bo‘lsin.

`event_scope` qiymati faqat `regional` yoki `district` bo‘lsin.

`regional` tadbirda `district_id` NULL bo‘lishi kerak.

`district` tadbirda `district_id` majburiy bo‘lsin va u aynan `region_id` ga tegishli ekanligi serverda tekshirilsin.

Bir nechta san’atkor, ishtirokchi va mas’ul yozuvlari bitta tadbirga bog‘lanishi mumkin bo‘lsin.

# 14. XAVFSIZLIK VA RUXSATLAR

Supabase Auth va RLS siyosatlarini to‘liq amalga oshir.

- Tuman mas’uli faqat o‘z hududidagi yozuvlarni boshqarsin.
- Viloyat mas’uli faqat o‘z viloyati doirasidagi ma’lumotlarni ko‘rsin.
- Vazirlik administratori respublika bo‘yicha vakolatga ega bo‘lsin.
- Foydalanuvchi o‘z rolini o‘zgartira olmasin.
- Foydalanuvchi so‘rov parametrlarini o‘zgartirib boshqa hududga ma’lumot yubora olmasin.
- Ruxsatlar faqat frontendda emas, server va ma’lumotlar bazasida ham tekshirilsin.
- Har bir muhim o‘zgarish audit jurnalida qayd etilsin.
- Telefon raqamlari va xodimlarning ma’lumotlari faqat vakolatli foydalanuvchilarga ko‘rsatilsin.
- Maxfiy kalitlar frontendga chiqarilmasin.
- `SUPABASE_SERVICE_ROLE_KEY` faqat server muhitida va zarur bo‘lgandagina ishlatilsin.
- Maxfiy ma’lumotlar xatolik xabarlarida ko‘rsatilmasin.

# 15. DIZAYN

Professional davlat tashkiloti axborot tizimiga mos interfeys yarat.

Dizayn xususiyatlari:

- Minimalist.
- Rasmiy.
- Zamonaviy.
- Toza oq yoki och kulrang fon.
- To‘q ko‘k yoki grafit navigatsiya.
- O‘qilishi oson shriftlar.
- Tartibli jadvallar.
- Chiroyli statistik kartalar.
- Keraksiz bezaklarsiz.
- Kompyuter, planshet va telefon ekranlariga mos.

Barcha matnlar o‘zbek tilida, lotin yozuvida bo‘lsin.

Interfeysda quyidagilar bo‘lishi kerak:

- Kirish sahifasi.
- Dashboard.
- Yon navigatsiya.
- Profil va chiqish tugmasi.
- Ma’lumot kiritish formasi.
- Tasdiqlash oynalari.
- Xatolik xabarlari.
- Yuklanish indikatorlari.
- Bo‘sh holat xabarlari.
- Muvaffaqiyatli saqlash xabarlari.

Haqiqiy funksiyaga ega bo‘lmagan tugmalarni qoldirma.

# 16. TEXNIK TALABLAR

- TypeScript xatolarini tuzat.
- Server va client komponentlarini to‘g‘ri ajrat.
- Formlarni Zod orqali validatsiya qil.
- Server tomonida barcha muhim ma’lumotlarni qayta tekshir.
- Ma’lumotlar bazasi so‘rovlarini samarali tashkil et.
- Katta jadvallar uchun sahifalashdan foydalan.
- Word faylini server tomonida xavfsiz yarat.
- Sana va vaqtni izchil formatda saqla va ko‘rsat.
- Xatolarni to‘g‘ri qayta ishlash mexanizmini yarat.
- Zarur indekslarni qo‘sh.
- Ma’lumotlarni tasodifiy o‘chirib yuborishdan himoya qil.
- SQL migratsiyalarini alohida fayllarda saqla.
- Boshlang‘ich hududlar ma’lumotlarini seed skripti orqali yukla.

# 17. ISHLAB CHIQISH TARTIBI

Ishni quyidagi bosqichlarda amalga oshir.

1. Mavjud loyiha papkasini tekshir.
2. Mavjud kod va konfiguratsiyalarni tahlil qil.
3. Arxitektura rejasini tuz.
4. Ma’lumotlar bazasi sxemasini tayyorla.
5. SQL migratsiyalarini yarat.
6. Autentifikatsiya va rollarni amalga oshir.
7. Hududlar va tumanlarning bog‘langan ro‘yxatini yarat.
8. Viloyat asosiy tadbirlari va tuman tadbirlarini alohida amalga oshir.
9. Tadbir formasi, san’atkorlar, ishtirokchilar va mas’ullar modullarini yarat.
10. Viloyat nazorati va vazirlik tasdiqlash jarayonini yarat.
11. Monitoring dashboardini yarat.
12. Umumiy jadval va filtrlarni yarat.
13. Haqiqiy Word eksportini yarat.
14. RLS va server ruxsatlarini tekshir.
15. Testlarni yoz va ishga tushir.
16. Build jarayonini bajar.
17. Aniqlangan xatolarni tuzat.
18. README va o‘rnatish ko‘rsatmalarini yoz.

Agar tashqi xizmatlar uchun kalitlar mavjud bo‘lmasa, ularni qanday sozlash kerakligini tushuntir. Tashqi xizmat ishlamayotgan bo‘lsa, funksiyani ishlayotgandek ko‘rsatma.

Mavjud loyiha fayllarini ko‘rmasdan ularni o‘chirib tashlama. Ma’lumotlar bazasini buzadigan yoki foydalanuvchi ma’lumotlarini yo‘qotadigan migratsiyalarni bajarma.

# 18. YAKUNIY QABUL QILISH MEZONLARI

Loyiha tayyor deb hisoblanishi uchun:

1. Super administrator foydalanuvchilarni yaratishi va hududlarga biriktirishi mumkin.
2. Viloyat mas’uli o‘zining asosiy tadbirlarini kiritishi mumkin.
3. Tuman mas’uli o‘z tadbirlarini mustaqil kiritishi mumkin.
4. Tumanlar ro‘yxati tegishli viloyatga avtomatik bog‘langan.
5. Viloyat asosiy tadbiri tuman tadbiri bilan aralashmaydi.
6. Bitta tadbirga bir nechta san’atkor va ishtirokchi qo‘shish mumkin.
7. Bitta tadbirga bir nechta mas’ul ijrochi biriktirish mumkin.
8. F.I.Sh., lavozim va telefon alohida saqlanadi.
9. Tuman ma’lumotlari viloyat tekshiruvidan so‘ng vazirlikka yuboriladi.
10. Vazirlik barcha hududlarni yagona jadvalda ko‘ra oladi.
11. Topshiriqni bajarmagan hududlar aniqlanadi.
12. Filtrlar va qidiruv ishlaydi.
13. Word hisoboti haqiqiy `.docx` formatida yaratiladi.
14. Word hujjatida hududlar va tumanlar tartibli joylashadi.
15. Xavfsizlik qoidalari server va RLS darajasida ishlaydi.
16. Loyiha build jarayonidan xatosiz o‘tadi.
17. Ishga tushirish va deploy yo‘riqnomalari mavjud.

Yakuniy natija — Madaniyat vazirligining Yangi yil tadbirlari bo‘yicha ma’lumotlarni respublika miqyosida yig‘ish, monitoring qilish va rasmiy Word hisobotini tayyorlashga mo‘ljallangan to‘liq ishlaydigan veb-platforma.

Avval loyihani tekshir, keyin kodlashni boshlagin. Faqat reja yoki tavsiyalar yozib to‘xtama. Mavjud muhit imkon bergan barcha funksiyalarni amalda yarat, test qil va yakuniy natijani tushuntir. 