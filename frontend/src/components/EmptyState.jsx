import React from "react";
import { Inbox } from "lucide-react";

export default function EmptyState({ title = "Nothing here yet", description = "", action, icon: Icon = Inbox }) {
  return (
    <div className="text-center py-16 px-6 border border-dashed border-[#E5E7EB] bg-white" data-testid="empty-state">
      <div className="mx-auto w-12 h-12 bg-gray-100 flex items-center justify-center mb-4">
        <Icon size={20} className="text-gray-500" />
      </div>
      <div className="font-heading text-lg font-bold text-gray-900">{title}</div>
      {description && <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
