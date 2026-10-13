// Har bir viloyat/hudud uchun boshqarma boshlig'i akkauntini yaratadi (mavjud bo'lsa o'tkazib yuboradi).
// Natija: viloyat-loginlar.csv (login, parol) — gitga tushmaydi. Parollarni viloyatlarga xavfsiz yuboring.
// Ishlatish:  npm run create-region-managers
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomInt } from "node:crypto";
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
if (!url || !key) {
  console.error("XATO: NEXT_PUBLIC_SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY .env.local da bo'lishi kerak.");
  process.exit(1);
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makePassword = () => Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: regions, error } = await admin.from("regions").select("id,code,name").eq("is_active", true).order("sort_order");
if (error) throw error;

const rows = [["Viloyat", "Login", "Parol"]];
let created = 0;
let skipped = 0;
for (const r of regions) {
  const username = r.code.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  const { data: exists } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
  if (exists) {
    skipped++;
    console.log(`o'tkazildi (bor): ${username}`);
    continue;
  }
  const password = makePassword();
  const { data, error: aErr } = await admin.auth.admin.createUser({ email: `${username}@${LOGIN_DOMAIN}`, password, email_confirm: true });
  if (aErr || !data.user) {
    console.error(`XATO ${username}: ${aErr?.message}`);
    continue;
  }
  const { error: pErr } = await admin.from("profiles").insert({
    id: data.user.id, username, full_name: `${r.name} boshqarma boshlig‘i`, role: "region_manager", region_id: r.id,
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    console.error(`XATO ${username}: profil yozilmadi`);
    continue;
  }
  rows.push([r.name, username, password]);
  created++;
  console.log(`yaratildi: ${username}`);
}

if (created > 0) {
  const csv = "﻿" + rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\r\n") + "\r\n";
  writeFileSync("viloyat-loginlar.csv", csv, "utf8");
  console.log(`\n${created} ta akkaunt yaratildi, ${skipped} tasi o'tkazildi. Loginlar: viloyat-loginlar.csv`);
} else {
  console.log("Yangi akkaunt yaratilmadi.");
}
