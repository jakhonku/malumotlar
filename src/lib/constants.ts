export type Role = "super_admin" | "region_manager" | "district_manager" | "observer";
export type EventStatus = "draft" | "submitted" | "revision" | "approved";
export type EventScope = "regional" | "district";
export type Stage = "district" | "region" | "ministry";

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Vazirlik administratori",
  region_manager: "Hudud boshqarmasi mas’uli",
  district_manager: "Tuman/shahar mas’uli",
  observer: "Kuzatuvchi",
};

export const STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Qoralama",
  submitted: "Yuborilgan",
  revision: "Qayta ishlashga qaytarilgan",
  approved: "Tasdiqlangan",
};

export const STAGE_LABELS: Record<Stage, string> = {
  district: "Tuman/shahar mas’uli",
  region: "Hudud boshqarmasi mas’uli",
  ministry: "Vazirlik",
};

export const SCOPE_LABELS: Record<EventScope, string> = {
  regional: "Hududning asosiy tadbiri",
  district: "Tuman/shahar tadbiri",
};

export const EVENT_TYPES = [
  "Bayram konserti",
  "Yangi yil bayram dasturi",
  "Yolka tadbiri",
  "Bolalar tadbiri",
  "Teatrlashtirilgan dastur",
  "Ko‘cha bayram tadbiri",
  "Festival",
  "Karnaval",
  "Ko‘rgazma / yarmarka",
  "Boshqa",
] as const;

export const PARTICIPANT_CATEGORIES = [
  "Bolalar",
  "Yoshlar",
  "Ayollar",
  "Keksalar va faxriylar",
  "Ijtimoiy himoyaga muhtoj shaxslar",
  "Ta’lim muassasalari",
  "Madaniyat muassasalari",
  "Davlat tashkilotlari",
  "Mahalla fuqarolar yig‘ini",
  "Tadbirkorlar",
  "Boshqa",
] as const;

export const ARTIST_TYPE_LABELS = { artist: "San’atkor", group: "Ijodiy jamoa" } as const;

export const PAGE_SIZE = 20;

export const ACTION_LABELS: Record<string, string> = {
  submit: "Yuborildi",
  forward: "Vazirlikka yuborildi",
  return: "Qayta ishlashga qaytarildi",
  approve: "Tasdiqlandi",
  reopen: "Qayta ochildi",
};

/** Foydalanuvchi logini Supabase Auth uchun login@yangiyil.local ko‘rinishidagi email ga aylantiriladi. */
export const LOGIN_DOMAIN = "yangiyil.local";
export const SIGNED_BUCKET = "signed-docs";
