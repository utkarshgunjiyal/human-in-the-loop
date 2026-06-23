import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Upload, ListChecks, ScanLine, ShieldCheck } from "lucide-react";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "sidebar-nav-dashboard" },
  { to: "/upload", label: "Upload Invoice", icon: Upload, testid: "sidebar-nav-upload" },
  { to: "/queue", label: "Invoice Queue", icon: ListChecks, testid: "sidebar-nav-queue" },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  return (
    <aside
      data-testid="app-sidebar"
      className="hidden md:flex md:flex-col w-64 shrink-0 bg-white border-r border-[#E5E7EB] h-screen sticky top-0"
    >
      <div className="px-6 py-6 border-b border-[#E5E7EB] flex items-center gap-3">
        <div className="w-9 h-9 bg-cobalt text-white flex items-center justify-center">
          <ScanLine size={18} strokeWidth={2.4} />
        </div>
        <div>
          <div className="font-heading font-black text-[15px] tracking-tight leading-none">INVOICE.AI</div>
          <div className="data-label mt-1">Audit Console</div>
        </div>
      </div>
      <nav className="flex-1 py-4">
        {links.map(({ to, label, icon: Icon, testid }) => {
          const active = pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
          return (
            <NavLink
              key={to}
              to={to}
              data-testid={testid}
              className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors border-l-2 ${
                active
                  ? "bg-gray-100 border-cobalt text-cobalt font-semibold"
                  : "border-transparent text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Icon size={16} strokeWidth={2} />
              {label}
            </NavLink>
          );
        })}
      </nav>
      <div className="px-6 py-4 border-t border-[#E5E7EB] flex items-center gap-2 text-xs text-gray-500">
        <ShieldCheck size={14} className="text-cobalt" />
        <span className="font-mono">v1.0 · HITL Audit</span>
      </div>
    </aside>
  );
}
