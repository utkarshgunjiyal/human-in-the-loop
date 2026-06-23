import React from "react";

const STYLES = {
  APPROVED: "bg-[#DCFCE7] text-[#166534] border-[#22C55E]",
  REJECTED: "bg-[#FEE2E2] text-[#991B1B] border-[#EF4444]",
  HUMAN_REVIEW: "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]",
};

const LABELS = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  HUMAN_REVIEW: "Human Review",
};

export default function StatusBadge({ status, size = "sm" }) {
  const cls = STYLES[status] || "bg-gray-100 text-gray-700 border-gray-300";
  const label = LABELS[status] || status;
  const pad = size === "lg" ? "px-3 py-1.5 text-xs" : "px-2 py-0.5 text-[10px]";
  return (
    <span
      data-testid={`status-badge-${(status || "unknown").toLowerCase()}`}
      className={`inline-flex items-center border ${cls} ${pad} font-bold uppercase tracking-wider`}
    >
      {label}
    </span>
  );
}
