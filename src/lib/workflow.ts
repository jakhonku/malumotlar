import type { EventScope, EventStatus, Stage } from "./constants";
import type { Profile } from "./types";

export type WorkflowAction = "submit" | "forward" | "return" | "approve" | "reopen";

export interface WorkflowEvent {
  region_id: string;
  district_id: string | null;
  event_scope: EventScope;
  status: EventStatus;
  stage: Stage;
}

type Actor = Pick<Profile, "role" | "region_id" | "district_id" | "can_edit_districts">;

/**
 * Interfeys uchun ruxsat ko‘zgusi. Asl tekshiruv ma’lumotlar bazasida
 * (app_can_edit / transition_event, 0003_functions.sql) bajariladi — ikkalasi mos bo‘lishi shart.
 */
export function canEditEvent(e: WorkflowEvent, p: Actor): boolean {
  switch (p.role) {
    case "super_admin":
      return true;
    case "district_manager":
      return e.district_id === p.district_id && e.stage === "district" && (e.status === "draft" || e.status === "revision");
    case "region_manager":
      if (e.region_id !== p.region_id || e.status === "approved") return false;
      if (e.event_scope === "regional") return e.stage === "region" && (e.status === "draft" || e.status === "revision");
      return p.can_edit_districts && (e.stage === "region" || e.stage === "district");
    default:
      return false;
  }
}

export function availableActions(e: WorkflowEvent, p: Actor): WorkflowAction[] {
  const out: WorkflowAction[] = [];
  if (p.role === "observer") return out;

  if ((e.status === "draft" || e.status === "revision") && canEditEvent(e, p)) out.push("submit");

  const regionOwns = p.role === "region_manager" && p.region_id === e.region_id;
  if (e.status === "submitted") {
    if ((p.role === "super_admin" || regionOwns) && e.event_scope === "district" && e.stage === "region") out.push("forward");
    if (p.role === "super_admin" || (regionOwns && e.event_scope === "district" && e.stage === "region")) out.push("return");
    if (p.role === "super_admin") out.push("approve");
  }
  if (e.status === "approved" && p.role === "super_admin") out.push("reopen");
  return out;
}

export const ACTION_BUTTONS: Record<WorkflowAction, { label: string; needsComment: boolean; confirm: string }> = {
  submit: { label: "Yuborish", needsComment: false, confirm: "Ma’lumot keyingi bosqichga yuboriladi. Davom etasizmi?" },
  forward: { label: "Vazirlikka yuborish", needsComment: false, confirm: "Tuman ma’lumoti vazirlik tasdig‘iga yuboriladi." },
  return: { label: "Qayta ishlashga qaytarish", needsComment: true, confirm: "Qaytarish sababini yozing." },
  approve: { label: "Tasdiqlash", needsComment: false, confirm: "Tadbir ma’lumotlari tasdiqlanadi." },
  reopen: { label: "Qayta ochish", needsComment: true, confirm: "Tasdiqlangan tadbirni qayta ochish sababini yozing." },
};
