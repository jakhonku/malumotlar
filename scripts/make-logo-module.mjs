// Gerb PNG sini Word hisobotlari uchun base64 modul sifatida yozadi (fayl tizimiga bog'liq bo'lmasligi uchun).
// Ishlatish: node scripts/make-logo-module.mjs .tmp/logo-emblem-small.png
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const src = process.argv[2] ?? "public/logo-emblem.png";
const buf = await sharp(src).resize({ height: 110 }).png({ compressionLevel: 9, palette: true }).toBuffer({ resolveWithObject: true });
const out =
  "// Avtomatik hosil qilingan (scripts/make-logo-module.mjs): gerb PNG, Word hisobotlariga joylanadi.\n" +
  `export const LOGO_PNG_BASE64 =\n  "${buf.data.toString("base64")}";\n` +
  `export const LOGO_ASPECT = ${(buf.info.width / buf.info.height).toFixed(4)}; // kenglik / balandlik\n`;
writeFileSync("src/lib/report/logo.ts", out);
void readFileSync;
console.log("logo.ts yozildi:", buf.info.width + "x" + buf.info.height, Math.round(buf.data.length / 1024) + " KB");
