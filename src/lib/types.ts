import type { EventScope, EventStatus, Role, Stage } from "./constants";

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  region_id: string | null;
  district_id: string | null;
  phone: string | null;
  can_edit_districts: boolean;
  is_active: boolean;
}

export interface Region { id: string; code: string; name: string; region_type: string; sort_order: number; is_active: boolean }
export interface District { id: string; region_id: string; name: string; district_type: "tuman" | "shahar"; is_active: boolean }

export interface Artist { id?: string; artist_name: string; artist_type: "artist" | "group"; performance_type?: string | null; role_description?: string | null; notes?: string | null; sort_order?: number }
export interface Participant { id?: string; participant_name: string; participant_category?: string | null; participant_count?: number | null; participation_role?: string | null; notes?: string | null; sort_order?: number }
export interface Responsible { id?: string; full_name: string; position: string; organization?: string | null; phone: string; is_primary: boolean; notes?: string | null; sort_order?: number }

export interface EventRow {
  id: string;
  region_id: string;
  district_id: string | null;
  event_scope: EventScope;
  title: string;
  event_type: string | null;
  description: string | null;
  venue_name: string | null;
  address: string | null;
  location_note: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  organization_name: string | null;
  notes: string | null;
  status: EventStatus;
  stage: Stage;
  created_by: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  region?: { name: string } | null;
  district?: { name: string } | null;
  artists?: Artist[];
  participants?: Participant[];
  responsibles?: Responsible[];
}

export interface HistoryRow {
  id: string;
  action: string;
  old_status: EventStatus | null;
  new_status: EventStatus;
  comment: string | null;
  created_at: string;
  changed_by: string | null;
  actor?: { full_name: string } | null;
}
