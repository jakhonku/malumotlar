import { Badge } from "./primitives";
import { SCOPE_LABELS, STATUS_LABELS, type EventScope, type EventStatus } from "@/lib/constants";

const tone = { draft: "slate", submitted: "blue", revision: "amber", approved: "green" } as const;

export function StatusBadge({ status }: { status: EventStatus }) {
  return <Badge tone={tone[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function ScopeBadge({ scope }: { scope: EventScope }) {
  return <Badge tone={scope === "regional" ? "blue" : "slate"}>{SCOPE_LABELS[scope]}</Badge>;
}
