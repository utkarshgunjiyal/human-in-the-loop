import React from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

export default function AppShell({ title, children }) {
  return (
    <div className="min-h-screen flex bg-[#F3F4F6]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar title={title} />
        <main className="flex-1 px-6 lg:px-8 py-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
