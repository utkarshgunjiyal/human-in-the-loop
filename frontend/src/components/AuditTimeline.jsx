import React from "react";
import StatusBadge from "@/components/StatusBadge";
import { CheckCircle2, XCircle, UserCog, FileUp, Cog, Pencil, ListChecks } from "lucide-react";

const ICON_MAP = {
  invoice_uploaded: FileUp,
  fields_extracted: Cog,
  rules_evaluated: ListChecks,
  auto_approved: CheckCircle2,
  auto_rejected: XCircle,
  sent_to_human_review: UserCog,
  edited_by_reviewer: Pencil,
  approved_by_reviewer: CheckCircle2,
  rejected_by_reviewer: XCircle,
};

function prettifyAction(a) {
  return a?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AuditTimeline({ events = [] }) {
  if (!events.length) {
    return <p className="text-sm text-gray-500">No audit events yet.</p>;
  }
  return (
    <ol className="relative border-l border-gray-300 ml-2" data-testid="audit-timeline">
      {events.map((e, idx) => {
        const Icon = ICON_MAP[e.action] || Cog;
        return (
          <li key={e.id || idx} className="ml-6 pb-6 last:pb-0" data-testid={`audit-item-${e.action}`}>
            <span className="absolute -left-[7px] mt-1 w-3.5 h-3.5 bg-white border-2 border-cobalt"></span>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Icon size={14} className="text-cobalt" />
              <span className="text-sm font-semibold text-gray-900">{prettifyAction(e.action)}</span>
              {e.new_status && <StatusBadge status={e.new_status} />}
            </div>
            <div className="text-xs text-gray-500 font-mono">
              {new Date(e.created_at).toLocaleString()} · by {e.actor_name || e.actor || "system"}
            </div>
            {e.notes && <p className="text-sm text-gray-700 mt-1 break-words">{e.notes}</p>}
          </li>
        );
      })}
    </ol>
  );
}
