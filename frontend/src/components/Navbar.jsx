import React from "react";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";

export default function Navbar({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header data-testid="app-navbar" className="bg-white border-b border-[#E5E7EB] sticky top-0 z-10">
      <div className="px-6 lg:px-8 h-16 flex items-center justify-between">
        <div>
          <div className="data-label">Workspace</div>
          <h1 className="font-heading text-xl tracking-tight font-bold text-gray-900" data-testid="page-title">
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-semibold text-gray-900" data-testid="navbar-username">{user.username}</span>
              <span className="text-[11px] tracking-[0.18em] uppercase text-cobalt font-semibold" data-testid="navbar-role">
                {user.role}
              </span>
            </div>
          )}
          <div className="w-9 h-9 bg-gray-100 border border-[#E5E7EB] flex items-center justify-center">
            <User size={16} className="text-gray-700" />
          </div>
          <button
            data-testid="navbar-logout-button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold border border-[#E5E7EB] hover:border-gray-900 hover:bg-gray-900 hover:text-white transition-colors"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
