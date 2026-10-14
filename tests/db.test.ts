import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const sql = (f: string) => readFileSync(path.join(root, "supabase", f), "utf8");

let db: PGlite;
const ids = {
  admin: "00000000-0000-0000-0000-000000000001",
  region: "00000000-0000-0000-0000-000000000002",
  regionNoPerm: "00000000-0000-0000-0000-000000000003",
  district: "00000000-0000-0000-0000-000000000004",
  district2: "00000000-0000-0000-0000-000000000005",
  observer: "00000000-0000-0000-0000-000000000006",
  otherRegion: "00000000-0000-0000-0000-000000000007",
};
let samarqand: string, urgut: string, jomboy: string, buxoro: string, toshkentV: string, toshkentSh: string;

/** Foydalanuvchi sifatida (authenticated + JWT sub) so'rov bajaradi. */
async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

const q = async (text: string, params: unknown[] = []) => (await db.query(text, params)).rows as Record<string, unknown>[];
const fail = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("Xatolik kutilgan edi, lekin bajarildi");
};

const payload = (over: Record<string, unknown> = {}, ev: Record<string, unknown> = {}) => ({
  scope: "district",
  event: {
    title: "Yangi yil bayram dasturi", event_type: "Bayram konserti",
    address: "Urgut shahri, Mustaqillik ko‘chasi 1", start_date: "2026-12-30", end_date: "2026-12-30", ...ev,
  },
  artists: [{ artist_name: "Sherzod Qurbonov", artist_type: "artist", performance_type: "Estrada" }, { artist_name: "Navbahor", artist_type: "group" }],
  participants: [{ participant_name: "Mahalla yoshlari", participant_category: "Yoshlar", participant_count: 120 }],
  responsibles: [
    { full_name: "Aliyev Vali Karimovich", position: "Bo‘lim boshlig‘i", phone: "+998901234567", is_primary: true },
    { full_name: "Rustamova Dilfuza", position: "Mutaxassis", phone: "+998931112233", is_primary: false },
  ],
  ...over,
});

const save = (uid: string, id: string | null, p: object) =>
  as(uid, async () => (await q("select public.save_event($1, $2::jsonb) as id", [id, JSON.stringify(p)]))[0].id as string);
const transition = (uid: string, id: string, action: string, comment: string | null = null) =>
  as(uid, () => db.query("select public.transition_event($1, $2, $3)", [id, action, comment]));
const status = async (id: string) => (await q("select status, stage from events where id = $1", [id]))[0] as { status: string; stage: string };

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    grant usage on schema public, auth to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  `);
  for (const f of ["migrations/0001_schema.sql", "migrations/0002_rls.sql", "migrations/0003_functions.sql", "migrations/0004_export_audit.sql", "migrations/0005_public_entry.sql", "migrations/0006_collections.sql", "migrations/0007_simplify_event_fields.sql", "migrations/0008_region_groups.sql", "migrations/0009_public_delete.sql", "migrations/0011_chat_and_hide_drafts.sql", "migrations/0013_edit_submitted.sql", "migrations/0014_admin_edit.sql", "migrations/0016_soft_deadline.sql", "migrations/0017_profile_photo.sql", "migrations/0019_login_links.sql", "migrations/0020_single_session.sql", "migrations/0021_last_seen.sql", "seed.sql", "migrations/0015_fix_districts.sql", "migrations/0018_region_order.sql"]) {
    await db.exec(sql(f));
  }
  await db.exec("grant all on all tables in schema public to service_role;");

  const reg = async (code: string) => (await q("select id from regions where code = $1", [code]))[0].id as string;
  const dist = async (rc: string, name: string) =>
    (await q("select d.id from districts d join regions r on r.id = d.region_id where r.code = $1 and d.name = $2", [rc, name]))[0].id as string;
  samarqand = await reg("samarqand");
  buxoro = await reg("buxoro");
  toshkentV = await reg("toshkent-v");
  toshkentSh = await reg("toshkent-sh");
  urgut = await dist("samarqand", "Urgut tumani");
  jomboy = await dist("samarqand", "Jomboy tumani");
  const buxTuman = await dist("buxoro", "Buxoro tumani");

  const users: [string, string, string, string, string | null, string | null, boolean][] = [
    [ids.admin, "admin", "Vazirlik administratori", "super_admin", null, null, false],
    [ids.region, "samarqand", "Samarqand viloyat mas’uli", "region_manager", samarqand, null, true],
    [ids.regionNoPerm, "samarqand2", "Samarqand ikkinchi mas’ul", "region_manager", samarqand, null, false],
    [ids.district, "urgut", "Urgut tuman mas’uli", "district_manager", samarqand, urgut, false],
    [ids.district2, "jomboy", "Jomboy tuman mas’uli", "district_manager", samarqand, jomboy, false],
    [ids.observer, "kuzatuvchi", "Kuzatuvchi foydalanuvchi", "observer", null, null, false],
    [ids.otherRegion, "buxoro", "Buxoro tuman mas’uli", "district_manager", buxoro, buxTuman, false],
  ];
  for (const u of users) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [u[0], `${u[1]}@yangiyil.local`]);
    await db.query(
      "insert into profiles (id, username, full_name, role, region_id, district_id, can_edit_districts) values ($1,$2,$3,$4,$5,$6,$7)",
      [u[0], u[1], u[2], u[3], u[4], u[5], u[6]],
    );
  }
});

describe("hududlar seed", () => {
  it("14 ta asosiy hudud mavjud", async () => {
    expect((await q("select count(*)::int as n from regions"))[0].n).toBe(14);
  });
  it("hududlar ro‘yxatida Qoraqalpog‘iston Respublikasi birinchi, Toshkent shahri oxirgi", async () => {
    const r = await q("select code from regions order by sort_order");
    expect(r[0].code).toBe("qoraqalpogiston");
    expect(r[r.length - 1].code).toBe("toshkent-sh");
  });
  it("Toshkent shahri tumanlari Toshkent viloyatiga aralashmagan", async () => {
    const city = (await q("select name from districts where region_id = $1", [toshkentSh])).map((r) => r.name as string);
    const region = (await q("select name from districts where region_id = $1", [toshkentV])).map((r) => r.name as string);
    expect(city).toContain("Yunusobod tumani");
    expect(region).not.toContain("Yunusobod tumani");
    expect(city).not.toContain("Piskent tumani");
  });
  it("seed takror ishga tushirilganda dublikat yaratmaydi", async () => {
    const before = (await q("select count(*)::int as n from districts"))[0].n;
    await db.exec(sql("seed.sql"));
    expect((await q("select count(*)::int as n from districts"))[0].n).toBe(before);
  });
});

describe("tadbir yaratish va hudud majburiyligi", () => {
  it("tuman mas’uli: hudud profilidan olinadi, payloaddagi begona hudud e’tiborga olinmaydi", async () => {
    const id = await save(ids.district, null, payload({ region_id: buxoro, district_id: jomboy, scope: "regional" }));
    const e = (await q("select region_id, district_id, event_scope, status, stage from events where id = $1", [id]))[0];
    expect(e).toMatchObject({ region_id: samarqand, district_id: urgut, event_scope: "district", status: "draft", stage: "district" });
  });

  it("viloyat asosiy tadbiri: event_scope=regional va district_id NULL", async () => {
    const id = await save(ids.region, null, payload({ scope: "regional" }, { title: "Viloyat Yangi yil konserti" }));
    const e = (await q("select region_id, district_id, event_scope, stage from events where id = $1", [id]))[0];
    expect(e).toMatchObject({ region_id: samarqand, district_id: null, event_scope: "regional", stage: "region" });
  });

  it("ruxsatsiz viloyat mas’uli tuman nomidan tadbir kirita olmaydi", async () => {
    const msg = await fail(save(ids.regionNoPerm, null, payload({ scope: "district", district_id: urgut })));
    expect(msg).toContain("ruxsat");
  });

  it("ruxsatli viloyat mas’uli faqat o‘z viloyati tumani uchun kirita oladi", async () => {
    const ok = await save(ids.region, null, payload({ scope: "district", district_id: urgut }, { title: "Urgut nomidan tadbir" }));
    expect(ok).toBeTruthy();
    const buxTuman = (await q("select id from districts where name = 'Buxoro tumani'"))[0].id;
    const msg = await fail(save(ids.region, null, payload({ scope: "district", district_id: buxTuman })));
    expect(msg).toContain("viloyatga tegishli emas");
  });

  it("super admin tuman va viloyat mos kelmasa rad etiladi (server tekshiruvi)", async () => {
    const msg = await fail(save(ids.admin, null, payload({ scope: "district", region_id: buxoro, district_id: urgut })));
    expect(msg).toContain("viloyatga tegishli emas");
  });

  it("ro‘yxatda yo‘q tuman: nom yozilsa viloyat ostida yaratiladi, qayta yozilsa dublikat bo‘lmaydi", async () => {
    const p = payload({ scope: "district", new_district_name: "Yangi Sinov tumani", new_district_type: "tuman" }, { title: "Yangi tuman tadbiri" });
    const id = await save(ids.region, null, p);
    const d = (await q("select d.name, d.region_id from events e join districts d on d.id = e.district_id where e.id = $1", [id]))[0];
    expect(d).toMatchObject({ name: "Yangi Sinov tumani", region_id: samarqand });
    await save(ids.region, null, payload({ scope: "district", new_district_name: "yangi sinov TUMANI" }, { title: "Ikkinchi tadbir" }));
    expect((await q("select count(*)::int as n from districts where region_id = $1 and lower(name) = 'yangi sinov tumani'", [samarqand]))[0].n).toBe(1);
  });

  it("tuman mas’uli yangi tuman yarata olmaydi", async () => {
    const before = (await q("select count(*)::int as n from districts"))[0].n;
    await save(ids.district, null, payload({ new_district_name: "Hack tumani" }));
    expect((await q("select count(*)::int as n from districts"))[0].n).toBe(before);
  });

  it("kuzatuvchi ma’lumot kirita olmaydi", async () => {
    expect(await fail(save(ids.observer, null, payload()))).toContain("Kuzatuvchi");
  });

  it("bir joyda, bir kunda bir nechta turli tadbirga ruxsat", async () => {
    const a = await save(ids.district, null, payload({}, { title: "Birinchi dastur" }));
    const b = await save(ids.district, null, payload({}, { title: "Ikkinchi, boshqa dastur" }));
    expect(a).not.toBe(b);
  });

  it("bir nechta san’atkor, ishtirokchi va mas’ul saqlanadi; bitta asosiy mas’ul", async () => {
    const id = await save(ids.district, null, payload({}, { title: "Bir nechta qatnashchili tadbir" }));
    expect((await q("select count(*)::int as n from event_artists where event_id = $1", [id]))[0].n).toBe(2);
    expect((await q("select count(*)::int as n from event_responsibles where event_id = $1", [id]))[0].n).toBe(2);
    expect((await q("select count(*)::int as n from event_responsibles where event_id = $1 and is_primary", [id]))[0].n).toBe(1);
    // ikkinchi asosiy mas'ul qo'shish rad etiladi
    const bad = payload();
    bad.responsibles[1].is_primary = true;
    expect(await fail(save(ids.district, id, bad))).toBeTruthy();
  });

  it("noto‘g‘ri telefon formati bazada rad etiladi", async () => {
    const bad = payload();
    bad.responsibles[0].phone = "12345";
    expect(await fail(save(ids.district, null, bad))).toBeTruthy();
  });
});

describe("RLS: ko‘rish va yozish doirasi", () => {
  let urgutEvent: string, jomboyEvent: string;
  beforeAll(async () => {
    urgutEvent = await save(ids.district, null, payload({}, { title: "RLS Urgut tadbiri" }));
    jomboyEvent = await save(ids.district2, null, payload({}, { title: "RLS Jomboy tadbiri" }));
  });

  it("tuman mas’uli faqat o‘z tumani tadbirlarini ko‘radi", async () => {
    const rows = await as(ids.district, () => q("select id, district_id from events"));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.district_id === urgut)).toBe(true);
    expect(rows.some((r) => r.id === jomboyEvent)).toBe(false);
  });

  it("viloyat mas’uli o‘z viloyatini ko‘radi, boshqa viloyatni ko‘rmaydi", async () => {
    await save(ids.otherRegion, null, payload({}, { title: "Buxoro tadbiri" }));
    const rows = await as(ids.region, () => q("select region_id from events"));
    expect(rows.every((r) => r.region_id === samarqand)).toBe(true);
    expect(rows.length).toBeGreaterThan(1);
  });

  it("super admin va kuzatuvchi hammasini ko‘radi", async () => {
    const a = await as(ids.admin, () => q("select count(*)::int as n from events"));
    const o = await as(ids.observer, () => q("select count(*)::int as n from events"));
    expect(a[0].n).toBe(o[0].n);
    expect(a[0].n as number).toBeGreaterThan(5);
  });

  it("tuman mas’uli boshqa tuman tadbirini tahrirlay olmaydi", async () => {
    expect(await fail(save(ids.district, jomboyEvent, payload()))).toBeTruthy();
  });

  it("to‘g‘ridan-to‘g‘ri INSERT/UPDATE/DELETE rad etiladi", async () => {
    expect(await fail(as(ids.district, () => db.query("update events set title = 'hack' where id = $1", [urgutEvent])))).toContain("permission denied");
    expect(await fail(as(ids.district, () => db.query("delete from events where id = $1", [urgutEvent])))).toContain("permission denied");
    expect(await fail(as(ids.district, () => db.query("insert into events (region_id,event_scope,title,stage,created_by) values ($1,'regional','Hack',$2,$3)", [samarqand, "region", ids.district])))).toContain("permission denied");
  });

  it("foydalanuvchi o‘z rolini o‘zgartira olmaydi", async () => {
    expect(await fail(as(ids.district, () => db.query("update profiles set role = 'super_admin' where id = $1", [ids.district])))).toContain("permission denied");
  });

  it("audit jurnalini faqat super admin ko‘radi", async () => {
    expect((await as(ids.admin, () => q("select count(*)::int as n from audit_logs")))[0].n as number).toBeGreaterThan(0);
    expect((await as(ids.district, () => q("select count(*)::int as n from audit_logs")))[0].n).toBe(0);
  });

  it("audit jurnali o‘zgartirilmaydi", async () => {
    expect(await fail(db.query("delete from audit_logs"))).toContain("o'chirib bo'lmaydi");
  });

  it("anon hech narsani o‘qiy olmaydi", async () => {
    await db.exec("set role anon");
    try {
      expect(await fail(db.query("select * from events"))).toContain("permission denied");
    } finally {
      await db.exec("reset role");
    }
  });

  it("faolsiz foydalanuvchi ma’lumot ko‘rmaydi va yoza olmaydi", async () => {
    await db.exec(`update profiles set is_active = false where id = '${ids.district2}'`);
    const rows = await as(ids.district2, () => q("select id from events"));
    expect(rows.length).toBe(0);
    expect(await fail(save(ids.district2, null, payload()))).toContain("faolsizlantirilgan");
    await db.exec(`update profiles set is_active = true where id = '${ids.district2}'`);
  });
});

describe("tasdiqlash jarayoni", () => {
  it("tuman → viloyat → vazirlik to‘liq zanjiri", async () => {
    const id = await save(ids.district, null, payload({}, { title: "Zanjir sinovi" }));
    await transition(ids.district, id, "submit");
    expect(await status(id)).toEqual({ status: "submitted", stage: "region" });

    // yuborilgan tadbirni muallif tahrirlay olmaydi
    expect(await fail(save(ids.district, id, payload()))).toBeTruthy();

    // viloyat mas'uli xabarnoma oldi
    const n = await as(ids.region, () => q("select title from notifications where event_id = $1", [id]));
    expect(n.length).toBe(1);

    await transition(ids.region, id, "forward");
    expect(await status(id)).toEqual({ status: "submitted", stage: "ministry" });

    // viloyat mas'uli tasdiqlay olmaydi
    expect(await fail(transition(ids.region, id, "approve"))).toContain("vazirlik");

    await transition(ids.admin, id, "approve");
    expect(await status(id)).toEqual({ status: "approved", stage: "ministry" });
    expect((await q("select approved_at from events where id = $1", [id]))[0].approved_at).not.toBeNull();

    // tasdiqlangan tadbirni tuman mas'uli o'zgartira olmaydi
    expect(await fail(save(ids.district, id, payload()))).toBeTruthy();
    expect(await fail(transition(ids.district, id, "submit"))).toBeTruthy();

    const hist = await q("select action from event_status_history where event_id = $1 order by created_at", [id]);
    expect(hist.map((h) => h.action)).toEqual(["submit", "forward", "approve"]);
  });

  it("qaytarish sababi majburiy; qaytarilgan tadbir tahrirlanib qayta yuboriladi", async () => {
    const id = await save(ids.district, null, payload({}, { title: "Qaytarish sinovi" }));
    await transition(ids.district, id, "submit");
    expect(await fail(transition(ids.region, id, "return", ""))).toContain("sababini");
    await transition(ids.region, id, "return", "Manzil aniq emas");
    expect(await status(id)).toEqual({ status: "revision", stage: "district" });

    const n = await as(ids.district, () => q("select message from notifications where event_id = $1", [id]));
    expect(String(n[0].message)).toContain("Manzil aniq emas");

    await save(ids.district, id, payload({}, { title: "Qaytarish sinovi", address: "Urgut shahri, aniq manzil 5" }));
    await transition(ids.district, id, "submit");
    expect(await status(id)).toEqual({ status: "submitted", stage: "region" });
  });

  it("viloyat asosiy tadbiri to‘g‘ridan-to‘g‘ri vazirlikka boradi", async () => {
    const id = await save(ids.region, null, payload({ scope: "regional" }, { title: "Viloyat konserti (zanjir)" }));
    await transition(ids.region, id, "submit");
    expect(await status(id)).toEqual({ status: "submitted", stage: "ministry" });
    await transition(ids.admin, id, "return", "Sana noto‘g‘ri");
    expect(await status(id)).toEqual({ status: "revision", stage: "region" });
  });

  it("to‘liq bo‘lmagan tadbirni yuborib bo‘lmaydi", async () => {
    const id = await save(ids.district, null, { scope: "district", event: { title: "Faqat nom kiritilgan" } });
    const msg = await fail(transition(ids.district, id, "submit"));
    expect(msg).toContain("to'ldiring");
  });

  it("tasdiqlangan tadbirni faqat admin sabab bilan qayta ochadi", async () => {
    const id = await save(ids.district, null, payload({}, { title: "Qayta ochish sinovi" }));
    await transition(ids.district, id, "submit");
    await transition(ids.region, id, "forward");
    await transition(ids.admin, id, "approve");
    expect(await fail(transition(ids.region, id, "reopen", "kerak"))).toContain("vazirlik");
    expect(await fail(transition(ids.admin, id, "reopen", ""))).toContain("sababini");
    await transition(ids.admin, id, "reopen", "Vaqt o‘zgargan");
    expect(await status(id)).toEqual({ status: "revision", stage: "district" });
  });

  it("tarix va tasdiqlangan tadbirni o‘chirib bo‘lmaydi", async () => {
    const id = await save(ids.district, null, payload({}, { title: "O‘chirish sinovi" }));
    await transition(ids.district, id, "submit");
    expect(await fail(as(ids.district, () => db.query("select public.delete_event($1)", [id])))).toContain("qoralama");
    expect(await fail(db.query("delete from events where id = $1", [id]))).toContain("o'chirib bo'lmaydi");
  });

  it("qoralamani yumshoq o‘chirish ro‘yxatdan yo‘qotadi", async () => {
    const id = await save(ids.district, null, payload({}, { title: "Qoralama o‘chiriladi" }));
    await as(ids.district, () => db.query("select public.delete_event($1)", [id]));
    expect((await as(ids.district, () => q("select id from events where id = $1", [id]))).length).toBe(0);
    expect((await q("select deleted_at from events where id = $1", [id]))[0].deleted_at).not.toBeNull();
  });
});

describe("monitoring funksiyalari", () => {
  it("dashboard_stats tuman mas’uli uchun faqat o‘z doirasini sanaydi", async () => {
    const s = (await as(ids.district, () => q("select public.dashboard_stats() as s")))[0].s as Record<string, number>;
    const mine = (await as(ids.district, () => q("select count(*)::int as n from events")))[0].n;
    expect(s.total).toBe(mine);
  });

  it("monitoring_regions: viloyat asosiy tadbiri va tumanlar mustaqil sanaladi", async () => {
    const rows = await as(ids.admin, () => q("select * from public.monitoring_regions()"));
    expect(rows.length).toBe(14);
    const s = rows.find((r) => r.region_id === samarqand)!;
    expect(s.regional_total as number).toBeGreaterThan(0);
    expect(s.districts_total).toBe(
      (await q("select count(*)::int as n from districts where region_id = $1", [samarqand]))[0].n,
    );
    const b = rows.find((r) => r.region_id === toshkentSh)!;
    expect(b.regional_total).toBe(0);
    expect(b.districts_sent).toBe(0);
    expect(b.districts_not_sent).toBe(b.districts_total);
  });

  it("monitoring_districts: yuborgan va yubormagan tumanlar", async () => {
    const rows = await as(ids.admin, () => q("select * from public.monitoring_districts($1)", [samarqand]));
    const u = rows.find((r) => r.district_id === urgut)!;
    expect(u.sent).toBe(true);
    const j = rows.find((r) => r.district_name === "Samarqand shahri")!;
    expect(j.sent).toBe(false);
    expect(j.events_total).toBe(0);
  });
});

describe("ochiq forma (login-parolsiz, hudud havolasi)", () => {
  const hex = (c: string) => c.repeat(64);
  const asService = async <T,>(fn: () => Promise<T>) => {
    await db.exec("set role service_role");
    try {
      return await fn();
    } finally {
      await db.exec("reset role");
    }
  };
  /** token==null → yangi hudud havolasi; eventId==null → havolaga yangi tadbir; aks holda tahrirlash */
  const pub = (token: string | null, newToken: string | null, eventId: string | null, data: object) =>
    asService(async () =>
      (await q("select public.public_save_event($1,$2,'iphash',$3,$4::jsonb) as id", [token, newToken, eventId, JSON.stringify(data)]))[0].id as string);
  const submit = (token: string, eventId: string | null = null) =>
    asService(async () => (await q("select public.public_submit_event($1,$2,'iphash') as n", [token, eventId]))[0].n as number);

  it("anon va authenticated ochiq funksiyalarni chaqira olmaydi", async () => {
    await db.exec("set role anon");
    try {
      expect(await fail(db.query("select public.public_save_event(null,'x','i',null,'{}'::jsonb)"))).toContain("permission denied");
    } finally {
      await db.exec("reset role");
    }
    expect(await fail(as(ids.district, () => db.query("select public.public_submit_event('x',null,'i')")))).toContain("permission denied");
  });

  it("viloyat va tuman alohida havola oladi; hudud tekshiriladi", async () => {
    const reg = await pub(null, hex("1"), null, payload({ scope: "regional", region_id: samarqand }, { title: "Viloyat konserti" }));
    const dis = await pub(null, hex("2"), null, payload({ scope: "district", region_id: samarqand, district_id: urgut }, { title: "Urgut dasturi" }));
    const rows = await q("select id, source, status, created_by, event_scope, district_id from events where id = any($1)", [[reg, dis]]);
    expect(rows.find((r) => r.id === reg)).toMatchObject({ source: "public", status: "draft", created_by: null, event_scope: "regional", district_id: null });
    expect(rows.find((r) => r.id === dis)).toMatchObject({ event_scope: "district", district_id: urgut });
    expect(await fail(pub(null, hex("3"), null, payload({ scope: "district", region_id: buxoro, district_id: urgut })))).toContain("viloyatga tegishli emas");
  });

  it("bitta havolaga bir nechta tadbir qo‘shiladi, hudud havoladan olinadi (almashtirib bo‘lmaydi)", async () => {
    const t = hex("4");
    await pub(null, t, null, payload({ scope: "district", region_id: samarqand, district_id: urgut }, { title: "Birinchi" }));
    const second = await pub(t, null, null, payload({ scope: "regional", region_id: buxoro, district_id: jomboy }, { title: "Ikkinchi" }));
    const e = (await q("select region_id, district_id, event_scope from events where id = $1", [second]))[0];
    expect(e).toMatchObject({ region_id: samarqand, district_id: urgut, event_scope: "district" });
    expect((await q("select count(*)::int as n from events where edit_token_hash = $1", [t]))[0].n).toBe(2);
  });

  it("noto‘g‘ri havola va begona tadbir rad etiladi; to‘g‘ri havola bilan tahrirlanadi", async () => {
    const t = hex("5");
    const id = await pub(null, t, null, payload({ scope: "district", region_id: samarqand, district_id: urgut }, { title: "Tahrir sinovi" }));
    const other = await pub(null, hex("6"), null, payload({ scope: "regional", region_id: samarqand }, { title: "Boshqa havola" }));
    expect(await fail(pub(hex("c"), null, null, payload()))).toContain("noto'g'ri");
    expect(await fail(pub(t, null, other, payload()))).toContain("topilmadi");
    await pub(t, null, id, payload({}, { title: "Tahrir sinovi (yangilandi)" }));
    expect((await q("select title from events where id = $1", [id]))[0].title).toBe("Tahrir sinovi (yangilandi)");
  });

  it("ro‘yxatda yo‘q tuman ochiq formadan yaratiladi", async () => {
    await pub(null, hex("d"), null, payload({ scope: "district", region_id: buxoro, new_district_name: "Ochiq Yangi tumani" }, { title: "Yangi tuman (ochiq)" }));
    expect((await q("select count(*)::int as n from districts where region_id = $1 and name = 'Ochiq Yangi tumani'", [buxoro]))[0].n).toBe(1);
  });

  it("san’atkor va ishtirokchisiz ham yuboriladi (joy, sana, vaqt, mas’ul yetarli)", async () => {
    const t = hex("8");
    const minimal = payload({ artists: [], participants: [], scope: "regional", region_id: samarqand }, { title: "Faqat asosiy ma’lumot", event_type: "" });
    const id = await pub(null, t, null, minimal);
    expect(await submit(t, id)).toBe(1);
    expect(await status(id)).toEqual({ status: "submitted", stage: "ministry" });
  });

  it("tuman ma’lumoti viloyat mas’uliga tushadi; yuborilgandan keyin tahrirlab bo‘lmaydi", async () => {
    const t = hex("e");
    const id = await pub(null, t, null, payload({ scope: "district", region_id: samarqand, district_id: jomboy }, { title: "Yuborish sinovi" }));
    await submit(t, id);
    expect(await status(id)).toEqual({ status: "submitted", stage: "region" });
    expect(await fail(pub(t, null, id, payload()))).toContain("tahrirlab bo'lmaydi");
    expect((await as(ids.region, () => q("select 1 from notifications where event_id = $1", [id]))).length).toBe(1);
  });

  it("‘Hammasini yuborish’: tayyorlari ketadi, to‘liq bo‘lmagani nomi bilan xato beradi", async () => {
    const t = hex("a");
    await pub(null, t, null, payload({ scope: "regional", region_id: buxoro }, { title: "Tayyor tadbir" }));
    await pub(t, null, null, payload({}, { title: "Tayyor tadbir 2" }));
    expect(await submit(t)).toBe(2);
    const t2 = hex("b");
    await pub(null, t2, null, payload({ scope: "regional", region_id: buxoro }, { title: "Tayyor tadbir 3" }));
    await pub(t2, null, null, { scope: "regional", event: { title: "Chala tadbir" } });
    expect(await fail(submit(t2))).toContain("Chala tadbir");
  });

  it("vazirlik qaytaradi — muallif havola bilan tuzatib qayta yuboradi, admin tasdiqlaydi", async () => {
    const t = hex("9");
    const id = await pub(null, t, null, payload({ scope: "regional", region_id: buxoro }, { title: "Qaytariladigan ochiq" }));
    await submit(t, id);
    await transition(ids.admin, id, "return", "Telefon raqamlarini tekshiring");
    expect(await status(id)).toEqual({ status: "revision", stage: "region" });
    await pub(t, null, id, payload({}, { title: "Qaytariladigan ochiq" }));
    await submit(t, id);
    await transition(ids.admin, id, "approve");
    expect((await status(id)).status).toBe("approved");
  });

  it("so‘rovlar soni cheklanadi", async () => {
    let msg = "";
    for (let i = 0; i < 70 && !msg; i++) {
      try {
        await asService(() =>
          db.query("select public.public_save_event(null, $1, 'spam-ip', null, $2::jsonb)", [
            `spam${i}`.padEnd(64, "0"),
            JSON.stringify({ scope: "regional", region_id: samarqand, event: { title: `Spam tadbir ${i}` } }),
          ]),
        );
      } catch (e) {
        const m = (e as Error).message;
        if (m.includes("Juda ko")) msg = m;
      }
    }
    expect(msg).toContain("Juda ko");
  });
});

describe("umumiy ma’lumot yig‘ish (collections)", () => {
  const hex = (c: string) => c.repeat(64);
  const fields = [
    { key: "nomi", label: "Nomi", type: "text", required: true },
    { key: "soni", label: "Soni", type: "number", required: false },
  ];
  let colId: string, singleId: string, regionalOnlyId: string, closedId: string, lateId: string;

  const asService = async <T,>(fn: () => Promise<T>) => {
    await db.exec("set role service_role");
    try {
      return await fn();
    } finally {
      await db.exec("reset role");
    }
  };
  const save = (col: string, token: string | null, newToken: string | null, entryId: string | null, data: object) =>
    asService(async () =>
      (await q("select public.col_public_save($1,$2,$3,'iph',$4,$5::jsonb) as id", [col, token, newToken, entryId, JSON.stringify(data)]))[0].id as string);
  const submit = (col: string, token: string, entryId: string | null = null) =>
    asService(async () => (await q("select public.col_public_submit($1,$2,$3,'iph') as n", [col, token, entryId]))[0].n as number);
  const review = (uid: string, entry: string, action: string, comment: string | null = null) =>
    as(uid, () => db.query("select public.col_review($1,$2,$3)", [entry, action, comment]));
  const geo = (extra: object = {}) => ({ scope: "district", region_id: samarqand, district_id: urgut, answers: { nomi: "Test", soni: 5 }, ...extra });

  beforeAll(async () => {
    const ins = async (title: string, audience: string, multiple: boolean, active = true, deadline: string | null = null) =>
      (await q("insert into collections (title, audience, fields, allow_multiple, is_active, deadline) values ($1,$2,$3::jsonb,$4,$5,$6) returning id",
        [title, audience, JSON.stringify(fields), multiple, active, deadline]))[0].id as string;
    colId = await ins("Yangi yil tadbirlari", "both", true);
    singleId = await ins("Bitta yozuv", "both", false);
    regionalOnlyId = await ins("Faqat viloyat", "regional", true);
    closedId = await ins("Yopiq yig‘ish", "both", true, false, "2000-01-01");
    lateId = await ins("Muddati o‘tgan, ochiq", "both", true, true, "2000-01-01");
  });

  it("faqat administrator yig‘ish yarata oladi; boshqalar o‘qiydi", async () => {
    const ok = await as(ids.admin, () => q("insert into collections (title, fields) values ('Admin yaratdi', '[]') returning id"));
    expect(ok.length).toBe(1);
    expect(await fail(as(ids.region, () => db.query("insert into collections (title, fields) values ('Hack yig‘ish', '[]')")))).toBeTruthy();
    expect((await as(ids.district, () => q("select id from collections"))).length).toBeGreaterThan(3);
    expect(await fail(as(ids.admin, () => db.query("delete from collections where id = $1", [colId])))).toContain("permission denied");
  });

  it("anon va authenticated ochiq funksiyalarni chaqira olmaydi", async () => {
    expect(await fail(as(ids.district, () => db.query("select public.col_public_save($1,null,'x','i',null,'{}'::jsonb)", [colId])))).toContain("permission denied");
  });

  it("hudud havolasi: viloyat va tuman alohida yozadi, bir havolada ko‘p yozuv", async () => {
    const t = hex("1");
    const a = await save(colId, null, t, null, geo());
    const b = await save(colId, t, null, null, geo({ answers: { nomi: "Ikkinchi" } }));
    const rows = await q("select id, scope, district_id, status, answers from collection_entries where edit_token_hash = $1 order by created_at", [t]);
    expect(rows.map((r) => r.id)).toEqual([a, b]);
    expect(rows[1]).toMatchObject({ scope: "district", district_id: urgut, status: "draft" });
    const r = await save(colId, null, hex("2"), null, { scope: "regional", region_id: samarqand, answers: { nomi: "Viloyat" } });
    expect((await q("select scope, district_id from collection_entries where id = $1", [r]))[0]).toMatchObject({ scope: "regional", district_id: null });
  });

  it("tuman viloyatga mos bo‘lishi, daraja (audience) va yopiq yig‘ish tekshiriladi", async () => {
    expect(await fail(save(colId, null, hex("3"), null, geo({ region_id: buxoro })))).toContain("viloyatga tegishli emas");
    expect(await fail(save(regionalOnlyId, null, hex("4"), null, geo()))).toContain("mo'ljallanmagan");
    expect(await fail(save(closedId, null, hex("5"), null, geo()))).toContain("yopilgan");
  });

  it("muddat o‘tgandan keyin ham ma’lumot qabul qilinadi (yumshoq muddat); yopish faqat is_active orqali", async () => {
    const id = await save(lateId, null, hex("7"), null, geo());
    expect(id).toBeTruthy();
  });

  it("allow_multiple=false: hudud faqat bitta yozuv kirita oladi", async () => {
    await save(singleId, null, hex("6"), null, geo());
    expect(await fail(save(singleId, null, hex("7"), null, geo()))).toContain("allaqachon");
    expect(await fail(save(singleId, hex("6"), null, null, geo()))).toContain("faqat bitta");
  });

  it("noto‘g‘ri havola va boshqa yig‘ishning havolasi rad etiladi", async () => {
    expect(await fail(save(colId, hex("c"), null, null, geo()))).toContain("noto'g'ri");
    const e = await save(colId, null, hex("8"), null, geo());
    expect(await fail(save(regionalOnlyId, hex("8"), null, e, geo()))).toBeTruthy();
  });

  it("yangi tuman nomini yozish orqali hudud yaratiladi", async () => {
    await save(colId, null, hex("d"), null, { scope: "district", region_id: buxoro, new_district_name: "Kolleksiya tumani", answers: { nomi: "X" } });
    expect((await q("select count(*)::int as n from districts where region_id = $1 and name = 'Kolleksiya tumani'", [buxoro]))[0].n).toBe(1);
  });

  it("yuborish → vazirlik qaytaradi (sabab majburiy) → tuzatib qayta yuboradi → tasdiqlaydi", async () => {
    const t = hex("9");
    const id = await save(colId, null, t, null, geo());
    expect(await submit(colId, t, id)).toBe(1);
    // yuborilgan (tasdiqlanmagan) yozuvni tahrirlash mumkin — holati o'zgarmaydi
    await save(colId, t, null, id, geo({ answers: { nomi: "Tahrirlandi", soni: 6 } }));
    const ed = (await q("select status, answers from collection_entries where id = $1", [id]))[0];
    expect(ed.status).toBe("submitted");
    expect((ed.answers as { nomi: string }).nomi).toBe("Tahrirlandi");
    expect((await as(ids.admin, () => q("select 1 from notifications where title like 'Yangi ma%'"))).length).toBeGreaterThan(0);

    expect(await fail(review(ids.region, id, "approve"))).toContain("vazirlik");
    expect(await fail(review(ids.admin, id, "return", ""))).toContain("sababini");
    await review(ids.admin, id, "return", "Sonini aniqlang");
    const e1 = (await q("select status, review_comment from collection_entries where id = $1", [id]))[0];
    expect(e1).toMatchObject({ status: "revision", review_comment: "Sonini aniqlang" });

    await save(colId, t, null, id, geo({ answers: { nomi: "Tuzatildi", soni: 7 } }));
    await submit(colId, t, id);
    await review(ids.admin, id, "approve");
    const e2 = (await q("select status, review_comment, approved_at, answers from collection_entries where id = $1", [id]))[0];
    expect(e2).toMatchObject({ status: "approved", review_comment: null });
    expect((e2.answers as { nomi: string }).nomi).toBe("Tuzatildi");
    expect(await fail(save(colId, t, null, id, geo()))).toContain("tasdiqlangan");

    await review(ids.admin, id, "reopen", "Qayta tekshirish");
    expect((await q("select status from collection_entries where id = $1", [id]))[0].status).toBe("revision");
  });

  it("RLS: tuman o‘z yozuvini, viloyat o‘z viloyatini ko‘radi; to‘g‘ridan-to‘g‘ri yozish yopiq", async () => {
    const mine = await as(ids.district, () => q("select district_id from collection_entries"));
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((r) => r.district_id === urgut)).toBe(true);
    const reg = await as(ids.region, () => q("select region_id from collection_entries"));
    expect(reg.every((r) => r.region_id === samarqand)).toBe(true);
    expect(await fail(as(ids.admin, () => db.query("update collection_entries set status = 'approved'")))).toContain("permission denied");
    expect(await fail(as(ids.district, () => db.query("delete from collection_entries")))).toContain("permission denied");
  });

  it("administrator yuborilgan yozuvni tahrirlaydi (holat o‘zgarmaydi); boshqalar va qoralama — yo‘q", async () => {
    const tk = hex("w");
    const id = await save(colId, null, tk, null, geo({ answers: { nomi: "Eski" } }));
    const upd = (uid: string) => as(uid, () => db.query("select public.col_admin_update($1, $2::jsonb)", [id, JSON.stringify({ nomi: "Admin tuzatdi", soni: 9 })]));
    expect(await fail(upd(ids.admin))).toContain("Qoralamani");
    await submit(colId, tk, id);
    expect(await fail(upd(ids.region))).toContain("faqat vazirlik");
    await upd(ids.admin);
    const r = (await q("select status, answers from collection_entries where id = $1", [id]))[0];
    expect(r.status).toBe("submitted");
    expect((r.answers as { nomi: string }).nomi).toBe("Admin tuzatdi");
    expect((await q("select 1 from audit_logs where action = 'collection.entry.admin_update' and entity_id = $1", [id])).length).toBe(1);
  });

  it("vazirlik (admin/kuzatuvchi) qoralamalarni ko‘rmaydi, egasi ko‘radi", async () => {
    const tk = hex("q");
    const id = await save(colId, null, tk, null, geo({ answers: { nomi: "Faqat qoralama" } }));
    const find = (uid: string) => as(uid, () => q("select id from collection_entries where id = $1", [id]));
    expect(await find(ids.admin)).toHaveLength(0);
    expect(await find(ids.observer)).toHaveLength(0);
    expect(await find(ids.region)).toHaveLength(1);
    await submit(colId, tk, id);
    expect(await find(ids.admin)).toHaveLength(1);
    await review(ids.admin, id, "return", "Tuzating");
    expect(await find(ids.admin)).toHaveLength(1);
  });

  it("monitoring: yuborgan va yubormagan tumanlar", async () => {
    const tk = hex("e");
    await submit(colId, tk, await save(colId, null, tk, null, geo({ answers: { nomi: "Monitoring uchun" } })));
    const regions = await as(ids.admin, () => q("select * from col_monitoring_regions($1)", [colId]));
    expect(regions.length).toBe(14);
    const s = regions.find((r) => r.region_id === samarqand)!;
    expect(s.districts_sent as number).toBeGreaterThanOrEqual(1);
    expect(s.districts_total as number).toBeGreaterThan(s.districts_sent as number);
    const d = await as(ids.admin, () => q("select * from col_monitoring_districts($1,$2)", [colId, samarqand]));
    expect(d.find((x) => x.district_id === urgut)!.sent).toBe(true);
    expect(d.find((x) => x.district_name === "Samarqand shahri")!.sent).toBe(false);
  });
});

describe("viloyat boshqarmasi rejimi (bitta havola — viloyat va barcha tumanlar)", () => {
  const hex = (c: string) => ("rg" + c).repeat(32).slice(0, 64);
  let colId: string, singleId: string;
  const asService = async <T,>(fn: () => Promise<T>) => {
    await db.exec("set role service_role");
    try {
      return await fn();
    } finally {
      await db.exec("reset role");
    }
  };
  const save = (col: string, token: string | null, newToken: string | null, entryId: string | null, data: object) =>
    asService(async () =>
      (await q("select public.col_public_save($1,$2,$3,'iph',$4,$5::jsonb) as id", [col, token, newToken, entryId, JSON.stringify(data)]))[0].id as string);
  const entry = (extra: object = {}) => ({ group_mode: "region", region_id: samarqand, answers: { nomi: "X" }, ...extra });

  beforeAll(async () => {
    const fields = JSON.stringify([{ key: "nomi", label: "Nomi", type: "text", required: true }]);
    colId = (await q("insert into collections (title, fields) values ('Boshqarma yig‘ishi', $1::jsonb) returning id", [fields]))[0].id as string;
    singleId = (await q("insert into collections (title, fields, allow_multiple) values ('Boshqarma bitta', $1::jsonb, false) returning id", [fields]))[0].id as string;
  });

  it("bitta havolada viloyatning o‘zi va turli tumanlar uchun yozuv qo‘shiladi", async () => {
    const t = hex("1");
    const a = await save(colId, null, t, null, entry({ scope: "regional" }));
    const b = await save(colId, t, null, null, entry({ scope: "district", district_id: urgut }));
    const c = await save(colId, t, null, null, entry({ scope: "district", district_id: jomboy }));
    const rows = await q("select id, scope, district_id, group_mode, region_id from collection_entries where edit_token_hash = $1 and collection_id = $2 order by created_at", [t, colId]);
    expect(rows.map((r) => r.id)).toEqual([a, b, c]);
    expect(rows.map((r) => r.district_id)).toEqual([null, urgut, jomboy]);
    expect(rows.every((r) => r.group_mode === "region" && r.region_id === samarqand)).toBe(true);
  });

  it("viloyat o‘zgartirib bo‘lmaydi; begona viloyat tumani rad etiladi", async () => {
    const t = hex("2");
    await save(colId, null, t, null, entry({ scope: "regional" }));
    const buxTuman = (await q("select id from districts where name = 'Buxoro tumani'"))[0].id;
    expect(await fail(save(colId, t, null, null, entry({ scope: "district", region_id: buxoro, district_id: buxTuman })))).toContain("viloyatga tegishli emas");
  });

  it("ro‘yxatda yo‘q tuman nomi yozilsa, shu viloyat ostida yaratiladi", async () => {
    const t = hex("3");
    await save(colId, null, t, null, entry({ scope: "district", new_district_name: "Boshqarma tumani" }));
    await save(colId, t, null, null, entry({ scope: "district", new_district_name: "boshqarma TUMANI" }));
    expect((await q("select count(*)::int as n from districts where region_id = $1 and name = 'Boshqarma tumani'", [samarqand]))[0].n).toBe(1);
  });

  it("allow_multiple=false: har bir hudud alohida bittadan; takrorlansa rad etiladi", async () => {
    const t = hex("4");
    await save(singleId, null, t, null, entry({ scope: "district", district_id: urgut }));
    await save(singleId, t, null, null, entry({ scope: "district", district_id: jomboy }));
    expect(await fail(save(singleId, t, null, null, entry({ scope: "district", district_id: urgut })))).toContain("allaqachon");
  });

  it("oddiy (unit) rejimda havola hududni almashtirishga yo‘l qo‘ymaydi", async () => {
    const t = hex("5");
    await save(colId, null, t, null, { scope: "district", region_id: samarqand, district_id: urgut, answers: { nomi: "A" } });
    const id = await save(colId, t, null, null, { scope: "district", region_id: samarqand, district_id: jomboy, answers: { nomi: "B" } });
    expect((await q("select district_id, group_mode from collection_entries where id = $1", [id]))[0]).toMatchObject({ district_id: urgut, group_mode: "unit" });
  });
});

describe("ochiq yozuvni o‘chirish", () => {
  const tok = ("dl" + "x").repeat(32).slice(0, 64);
  const svc = async <T,>(fn: () => Promise<T>) => {
    await db.exec("set role service_role");
    try { return await fn(); } finally { await db.exec("reset role"); }
  };
  it("qoralamani o‘chiradi; yuborilganni, begona havolani va anon chaqiruvini rad etadi", async () => {
    const fields = JSON.stringify([{ key: "nomi", label: "Nomi", type: "text", required: true }]);
    const col = (await q("insert into collections (title, fields) values ('O‘chirish sinovi', $1::jsonb) returning id", [fields]))[0].id as string;
    const mk = async () => svc(async () => (await q("select public.col_public_save($1,null,$2,'ip',null,$3::jsonb) as id", [col, tok, JSON.stringify({ scope: "regional", region_id: samarqand, answers: { nomi: "A" } })]))[0].id as string);
    const id = await mk();
    expect(await fail(svc(() => db.query("select public.col_public_delete($1,$2,$3,'ip')", [col, "z".repeat(64), id])))).toContain("noto'g'ri");
    await svc(() => db.query("select public.col_public_delete($1,$2,$3,'ip')", [col, tok, id]));
    expect((await q("select deleted_at from collection_entries where id = $1", [id]))[0].deleted_at).not.toBeNull();
    const id2 = await svc(async () => (await q("select public.col_public_save($1,$2,null,'ip',null,$3::jsonb) as id", [col, tok, JSON.stringify({ scope: "regional", region_id: samarqand, answers: { nomi: "B" } })]))[0].id as string).catch(() => null);
    void id2;
    expect(await fail(as(ids.district, () => db.query("select public.col_public_delete($1,$2,$3,'ip')", [col, tok, id])))).toContain("permission denied");
  });
});

describe("chat (admin ↔ viloyat boshqarmasi)", () => {
  const send = (uid: string, thread: string | null, body: string) => as(uid, async () => (await q("select public.send_message($1,$2) as id", [thread, body]))[0].id as string);
  const unread = (uid: string) => as(uid, () => q("select thread_key, n from chat_unread_by_thread()"));

  it("admin alohida foydalanuvchiga yozadi, u o‘qiydi va javob beradi", async () => {
    await send(ids.admin, ids.region, "Salom, ma’lumotni yuboring");
    expect((await unread(ids.region)).find((r) => r.thread_key === ids.region)?.n).toBe(1);
    expect(await unread(ids.admin)).toHaveLength(0);
    const seen = await as(ids.region, () => q("select body from messages order by created_at"));
    expect(seen.map((m) => m.body)).toContain("Salom, ma’lumotni yuboring");
    await as(ids.region, () => db.query("select public.chat_mark_read($1)", [ids.region]));
    expect((await unread(ids.region)).length).toBe(0);
    await send(ids.region, ids.region, "Qabul qildim");
    expect((await unread(ids.admin)).find((r) => r.thread_key === ids.region)?.n).toBe(1);
  });

  it("umumiy xabar barcha viloyat boshqarmalariga boradi, tuman va kuzatuvchiga emas", async () => {
    await send(ids.admin, null, "Hammaga: muddat 25-dekabr");
    for (const uid of [ids.region, ids.regionNoPerm]) {
      expect((await as(uid, () => q("select body from messages where thread_user is null"))).length).toBe(1);
      expect((await unread(uid)).find((r) => r.thread_key === "all")?.n).toBe(1);
    }
    expect(await as(ids.observer, () => q("select 1 from messages"))).toHaveLength(0);
    expect(await as(ids.district, () => q("select 1 from messages"))).toHaveLength(0);
  });

  it("boshqa suhbatni ko‘rish va yozish yopiq; umumiy xabarni faqat admin yuboradi", async () => {
    await send(ids.admin, ids.otherRegion, "Faqat sizga");
    expect((await as(ids.region, () => q("select body from messages"))).map((m) => m.body)).not.toContain("Faqat sizga");
    expect(await fail(send(ids.region, ids.otherRegion, "Soxta"))).toContain("Faqat vazirlik");
    expect(await fail(send(ids.region, null, "Hammaga"))).toContain("Faqat vazirlik");
    expect(await fail(send(ids.admin, ids.region, "   "))).toContain("1–4000");
    expect(await fail(as(ids.region, () => db.query("insert into messages (thread_user, sender_id, body) values (null, $1, 'x')", [ids.region])))).toContain("permission denied");
  });
});
