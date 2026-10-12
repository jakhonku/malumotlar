import type { Role } from "./constants";
import type { EventFormValues } from "./validators";

export interface FormContext {
  role: Role;
  regionId: string | null;
  districtId: string | null;
  canEditDistricts: boolean;
}

export const emptyValues = (ctx: FormContext): EventFormValues => ({
  scope: ctx.role === "district_manager" ? "district" : "regional",
  region_id: ctx.regionId ?? "",
  district_id: ctx.districtId ?? "",
  new_district_name: "",
  new_district_type: "tuman",
  title: "",
  event_type: "",
  description: "",
  organization_name: "",
  notes: "",
  address: "",
  location_note: "",
  event_date: "",
  artists: [],
  participants: [],
  responsibles: [{ full_name: "", position: "", organization: "", phone: "", is_primary: true, notes: "" }],
});
