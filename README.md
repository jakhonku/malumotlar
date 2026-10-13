# Yangi yil tadbirlari monitoring platformasi

O‘zbekiston Respublikasi Madaniyat vazirligi uchun: hududlardan (viloyat, tuman, shahar) ma’lumotlarni yig‘ish, tekshirish,
tasdiqlash, monitoring qilish va rasmiy **Word (.docx)** / **Excel (.xlsx)** hisobotlarini yaratish tizimi.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, RLS) ·
React Hook Form + Zod · `docx` · `exceljs` · Vercel.

## Imkoniyatlar

- **Ma’lumot yig‘ish konstruktori** (`/collections`): administrator o‘zi qanday ma’lumot yig‘ilishini belgilaydi
  (matn, son, sana, vaqt, telefon, ro‘yxatdan tanlash, **qatorlar jadvali** — masalan san’atkorlar: F.I.Sh. + janri).
  «Yangi yil tadbirlari» tayyor shabloni bor. Kim to‘ldirishi (viloyat / tuman / ikkalasi), muddat, bir hudud nechta yozuv kirita olishi sozlanadi.
- **Ochiq to‘ldirish** (`/kiritish`): viloyat va har bir tuman/shahar **login-parolsiz**, alohida to‘ldiradi. Hududga maxfiy **hudud havolasi** beriladi:
  u orqali yozuv qo‘shish, tuzatish, yuborish; vazirlik qaytarsa — sababi bilan qayta yuborish. Ro‘yxatda yo‘q tuman nomini yozsa, ro‘yxatga qo‘shiladi.
- **Vazirlik paneli** (login bilan): hududlar monitoringi (kim yubordi/yubormadi), tasdiqlash markazi, qidiruv/filtr, audit jurnali,
  foydalanuvchilar va hududlarni boshqarish, xabarnomalar.
- **Hisobotlar:** Word (A4 albom, Times New Roman, har sahifada jadval sarlavhasi, sahifa raqami) — **umumiy jadval** yoki **viloyat/tuman bo‘yicha alohida jadvallar**; Excel.
- Rollar: vazirlik administratori, viloyat mas’uli, tuman/shahar mas’uli, kuzatuvchi (hisobli foydalanuvchilar ixtiyoriy — ochiq forma ularsiz ishlaydi).

## Xavfsizlik modeli

| Qatlam | Nima qiladi |
| --- | --- |
| **RLS** | Hisobli foydalanuvchilar faqat o‘z doirasini ko‘radi; `anon` hech narsani o‘qiy olmaydi; rolni o‘zgartirib bo‘lmaydi. |
| **Yozish funksiyalari** | Jadvallarga to‘g‘ridan-to‘g‘ri INSERT/UPDATE/DELETE yopiq; yozish faqat SECURITY DEFINER funksiyalar orqali (ular rol/hudud/holatni o‘zlari tekshiradi). |
| **Ochiq forma** | Funksiyalarni faqat server (`service_role`) chaqiradi. Hudud havolasi tokeni 192 bit tasodifiy, bazada faqat SHA-256 hash. IP bo‘yicha soatiga 60 ta yozish limiti. Hudud va tuman serverda tekshiriladi. Ma’lumot vazirlik tasdiqlamaguncha hisobotga kirmaydi. |
| **Server** | Zod bilan qayta tekshiruv; `SUPABASE_SERVICE_ROLE_KEY` faqat `server-only` modullarda; xavfsizlik sarlavhalari; token sahifalari `no-store`, `noindex`, `no-referrer`. |

## Vercel’ga deploy qilish

### 1. Supabase (bir marta)
1. Supabase loyihasida **SQL Editor**’da quyidagilarni **tartib bilan** bajaring (har biri qayta ishga tushirishga xavfsiz):
   `supabase/migrations/0001_schema.sql` → `0002_rls.sql` → `0003_functions.sql` → `0004_export_audit.sql` → `0005_public_entry.sql`
   → `0006_collections.sql` → `0007_simplify_event_fields.sql` → `0008_region_groups.sql` → `supabase/seed.sql` (14 hudud va tuman/shaharlar).
2. **Authentication → Sign In / Providers → Email**: yoqilgan bo‘lsin; **Allow new users to sign up** — **o‘chirilgan** (foydalanuvchilarni faqat administrator yaratadi).
3. *Project Settings → API* dan `URL`, `anon` va `service_role` kalitlarini oling.

### 2. Vercel loyihasi
**Dashboard orqali (tavsiya):**
1. Kodni GitHub/GitLab’ga yuklang (`.env.local` gitga tushmaydi — `.gitignore` himoya qiladi).
2. vercel.com → **Add New → Project** → repozitoriyni tanlang. Framework: **Next.js** (avtomatik), Build: `next build`, Install: `npm install`.
3. **Environment Variables** (Production + Preview):

   | Nomi | Qiymat | Izoh |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://XXXX.supabase.co` | ommaviy |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable kalit | ommaviy |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role kalit | **maxfiy**, `NEXT_PUBLIC_` bilan boshlanmasin |

4. **Deploy**. (Funksiya hududini Supabase’ga yaqin qiling: *Settings → Functions → Region*.)

**CLI orqali:** `npx vercel` (login va loyiha ulash), `npx vercel env add …` (yuqoridagi 3 ta), `npx vercel --prod`.

### 3. Deploydan keyin
1. Birinchi administrator: lokal kompyuterda `.env.local` ni to‘ldirib `npm run create-admin` (ADMIN_USERNAME / ADMIN_PASSWORD) — u **production** Supabase’ga yozadi.
2. `https://<domen>/login` → administrator bilan kiring → **Ma’lumot yig‘ish** → shablon yarating → `/kiritish/c/<id>` havolasini hududlarga yuboring.
3. Tekshiring: `/kiritish` ochiladi (loginsiz), `/` loginsiz `/kiritish` ga yo‘naltiradi, Word hisoboti yuklanadi.
4. Maxsus domen: Vercel → *Settings → Domains*.

## Lokal ishga tushirish
```bash
npm install
cp .env.example .env.local      # qiymatlarni to‘ldiring
npm run create-admin
npm run dev                     # http://localhost:3000
```

## Testlar
```bash
npm test            # vitest (SQL migratsiyalar lokal Postgres/PGlite ichida, validatsiya, Word/Excel tuzilmasi)
npm run typecheck
npm run build
```

## Loyiha tuzilmasi
```
supabase/migrations/   SQL (0001–0008)       supabase/seed.sql   hududlar
src/proxy.ts           sessiya + yo‘naltirish   scripts/create-admin.mjs
src/app/(app)/         vazirlik paneli          src/app/kiritish/   ochiq to‘ldirish
src/app/api/           Word/Excel eksporti      src/lib/report/     hujjat quruvchilar
src/lib/collections.ts maydon turlari va tekshiruv (qatorlar jadvali ham)
```

## Cheklovlar
- Parolni tiklash faqat administrator orqali; bildirishnomalar tizim ichida (email yo‘q).
- Hudud havolasi yo‘qolsa, muallif o‘z yozuvini tuzata olmaydi (vazirlik ko‘radi va qaytara oladi).
- Interfeys faqat o‘zbek tilida (lotin). `seed.sql` dagi tuman/shaharlar ro‘yxatini rasmiy manba bilan solishtiring — **Sozlamalar → Hududlar** da tahrirlanadi.
