// Birinchi super administratorni yaratadi (yoki mavjud bo'lsa parolini yangilaydi).
// Ishlatish:  npm run create-admin
// Kerakli muhit o'zgaruvchilari .env.local da: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// ADMIN_USERNAME, ADMIN_PASSWORD (kamida 8 belgi), ixtiyoriy ADMIN_FULL_NAME.
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const LOGIN_DOMAIN = "yangiyil.local";

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(".env.local");
loadEnv(".env");

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
const username = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "";
const fullName = process.env.ADMIN_FULL_NAME || "Vazirlik administratori";

if (!url || !key) {
  console.error("XATO: NEXT_PUBLIC_SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY .env.local da ko'rsatilishi kerak.");
  process.exit(1);
}
if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
  console.error("XATO: ADMIN_USERNAME 3–40 ta lotin harf, raqam, nuqta, tire yoki pastki chiziqdan iborat bo'lsin.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("XATO: ADMIN_PASSWORD kamida 8 belgidan iborat bo'lishi kerak.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const email = `${username}@${LOGIN_DOMAIN}`;

const { data: existing } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, { password });
  if (error) throw error;
  await admin.from("profiles").update({ role: "super_admin", region_id: null, district_id: null, is_active: true }).eq("id", existing.id);
  console.log(`Mavjud foydalanuvchi "${username}" super administrator qilindi va paroli yangilandi.`);
} else {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const { error: pErr } = await admin.from("profiles").insert({ id: data.user.id, username, full_name: fullName, role: "super_admin" });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw pErr;
  }
  console.log(`Super administrator yaratildi. Login: ${username}`);
}
