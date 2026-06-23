import React from "react";
import { Loader2 } from "lucide-react";

export default function LoadingSpinner({ label = "Loading…", className = "" }) {
  return (
    <div className={`flex items-center gap-2 text-gray-600 text-sm ${className}`} data-testid="loading-spinner">
      <Loader2 className="animate-spin" size={16} />
      <span>{label}</span>
    </div>
  );
}
