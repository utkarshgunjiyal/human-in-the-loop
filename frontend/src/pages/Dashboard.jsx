import React, { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, UserCog, FileText, DollarSign, Gauge, ArrowUpRight, Activity } from "lucide-react";

function StatCard({ label, value, hint, icon: Icon, testid, accent = "text-gray-900" }) {
  return (
    <div
      data-testid={testid}
      className="bg-white border border-[#E5E7EB] p-5 transition-all hover:-translate-y-[1px] hover:border-gray-400"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="data-label">{label}</span>
        <Icon size={16} className="text-cobalt" />
      </div>
      <div className={`font-heading font-black text-4xl tabular tracking-tight ${accent}`}>{value}</div>
      {hint && <div className="mt-2 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

function prettifyAction(a) {
  return a?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/stats");
        setStats(data);
      } catch (e) {
        setError(e.response?.data?.detail || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppShell title="Dashboard">
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="text-red-700 text-sm">{String(error)}</div>
      ) : !stats ? (
        <EmptyState title="No data yet" />
      ) : (
        <div className="space-y-6" data-testid="dashboard">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Invoices"
              value={stats.total_invoices}
              icon={FileText}
              testid="stat-total"
            />
            <StatCard
              label="Approved"
              value={stats.approved}
              icon={CheckCircle2}
              testid="stat-approved"
              accent="text-[#166534]"
            />
            <StatCard
              label="Rejected"
              value={stats.rejected}
              icon={XCircle}
              testid="stat-rejected"
              accent="text-[#991B1B]"
            />
            <StatCard
              label="Human Review"
              value={stats.human_review}
              icon={UserCog}
              testid="stat-human-review"
              accent="text-[#92400E]"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <StatCard
              label="Total Amount Processed"
              value={`$${Number(stats.total_amount_processed || 0).toLocaleString()}`}
              icon={DollarSign}
              testid="stat-amount"
            />
            <StatCard
              label="Avg Confidence Score"
              value={`${Math.round((stats.average_confidence_score || 0) * 100)}%`}
              hint="Across all processed invoices"
              icon={Gauge}
              testid="stat-confidence"
            />
            <div className="bg-white border border-[#E5E7EB] p-5 flex flex-col justify-between">
              <div>
                <div className="data-label mb-2">Quick action</div>
                <h3 className="font-heading text-lg font-bold mb-1">Process a new invoice</h3>
                <p className="text-sm text-gray-600">Upload a PDF or TXT and route it through the rules engine.</p>
              </div>
              <Link
                to="/upload"
                data-testid="dashboard-cta-upload"
                className="mt-4 inline-flex items-center justify-between bg-gray-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-cobalt transition-colors"
              >
                Upload Invoice <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>

          <div className="bg-white border border-[#E5E7EB]">
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
              <Activity size={14} className="text-cobalt" />
              <h3 className="font-heading font-bold text-sm tracking-tight">Recent Activity</h3>
            </div>
            <div className="divide-y divide-[#E5E7EB]" data-testid="recent-activity">
              {!stats.recent_activity?.length && (
                <div className="px-5 py-6 text-sm text-gray-500">No activity yet.</div>
              )}
              {stats.recent_activity?.map((e, i) => (
                <Link
                  key={e.id || i}
                  to={`/invoice/${e.invoice_id}`}
                  className="block px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">{prettifyAction(e.action)}</span>
                    {e.new_status && <StatusBadge status={e.new_status} />}
                    <span className="text-xs font-mono text-gray-500 ml-auto">
                      {new Date(e.created_at).toLocaleString()}
                    </span>
                  </div>
                  {e.notes && <p className="text-xs text-gray-600 mt-1 truncate">{e.notes}</p>}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
