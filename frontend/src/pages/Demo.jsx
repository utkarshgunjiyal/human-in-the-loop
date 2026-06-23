import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import StatusBadge from "@/components/StatusBadge";
import AuditTimeline from "@/components/AuditTimeline";
import LoadingSpinner from "@/components/LoadingSpinner";
import { API } from "@/lib/api";
import { ScanLine, ArrowRight, Sparkles, FileText, Gauge, ExternalLink } from "lucide-react";

// Public, unauthenticated client (no Authorization header attached)
const publicApi = axios.create({ baseURL: API });

export default function Demo() {
  const [invoices, setInvoices] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await publicApi.get("/demo/invoices");
        setInvoices(data.items || []);
        if (data.items?.length) setSelectedId(data.items[0].id);
      } catch (e) {
        setError(e.response?.data?.detail || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setAuditLoading(true);
    publicApi
      .get(`/demo/audit/${selectedId}`)
      .then(({ data }) => setAudit(data.items || []))
      .finally(() => setAuditLoading(false));
  }, [selectedId]);

  const selected = useMemo(
    () => invoices.find((i) => i.id === selectedId),
    [invoices, selectedId]
  );

  return (
    <div className="min-h-screen bg-[#F3F4F6]" data-testid="demo-page">
      {/* Public top bar */}
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" data-testid="demo-logo-link">
            <div className="w-9 h-9 bg-cobalt text-white flex items-center justify-center">
              <ScanLine size={18} />
            </div>
            <div>
              <div className="font-heading font-black text-[15px] tracking-tight leading-none">INVOICE.AI</div>
              <div className="data-label mt-1">Public Demo</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              data-testid="demo-signin-link"
              className="text-sm font-semibold text-gray-700 hover:text-cobalt"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              data-testid="demo-signup-link"
              className="inline-flex items-center gap-1.5 bg-gray-900 hover:bg-cobalt text-white px-3 py-2 text-sm font-semibold transition-colors"
            >
              Create account <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 lg:px-8 pt-10 pb-6">
        <div className="data-label mb-3 inline-flex items-center gap-2">
          <Sparkles size={12} className="text-cobalt" /> Read-only walkthrough
        </div>
        <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tight max-w-3xl">
          Three invoices. Three different decisions. Same audit trail.
        </h1>
        <p className="mt-4 text-gray-700 max-w-2xl text-[15px] leading-relaxed">
          See how the rules + decision engine routes invoices automatically — auto-approve when
          everything checks out, reject duplicates, escalate high-value documents to a human reviewer.
          Every step is captured in an immutable audit log.
        </p>
      </section>

      {loading ? (
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12"><LoadingSpinner /></div>
      ) : error ? (
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12 text-red-700 text-sm">{String(error)}</div>
      ) : (
        <section className="max-w-6xl mx-auto px-6 lg:px-8 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cards */}
          <div className="lg:col-span-5 space-y-4" data-testid="demo-invoice-list">
            {invoices.map((inv) => {
              const active = inv.id === selectedId;
              return (
                <button
                  key={inv.id}
                  onClick={() => setSelectedId(inv.id)}
                  data-testid={`demo-invoice-card-${inv.status.toLowerCase()}`}
                  className={`text-left w-full bg-white border p-5 transition-all ${
                    active ? "border-cobalt -translate-y-[1px] shadow-[2px_2px_0_0_rgba(0,47,167,1)]" : "border-[#E5E7EB] hover:border-gray-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <StatusBadge status={inv.status} />
                    <span className="text-xs font-mono text-gray-500">{inv.filename}</span>
                  </div>
                  <div className="font-heading text-lg font-bold">{inv.vendor}</div>
                  <div className="text-xs font-mono text-gray-500 mt-0.5">{inv.invoice_number}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-mono text-sm tabular text-gray-900">
                      ${Number(inv.amount).toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-500">{inv.invoice_date}</span>
                  </div>
                  <p className="mt-3 text-xs text-gray-600 leading-relaxed line-clamp-2">{inv.decision_reason}</p>
                </button>
              );
            })}
          </div>

          {/* Detail */}
          <div className="lg:col-span-7 space-y-4">
            {selected && (
              <>
                <div className="bg-white border border-[#E5E7EB]">
                  <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center gap-2">
                    <FileText size={14} className="text-cobalt" />
                    <span className="data-label">{selected.filename}</span>
                    <StatusBadge status={selected.status} size="lg" />
                    <span className="ml-auto text-xs font-mono text-gray-500 inline-flex items-center gap-1">
                      <Gauge size={12} /> conf {Math.round((selected.confidence_score || 0) * 100)}%
                    </span>
                  </div>
                  <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <Field label="Vendor" value={selected.vendor} />
                    <Field label="Invoice #" value={selected.invoice_number} mono />
                    <Field label="Date" value={selected.invoice_date} mono />
                    <Field label="Amount" value={`$${Number(selected.amount).toLocaleString()}`} mono />
                    <Field label="Method" value={selected.extraction_method} mono />
                    <Field label="Decision" value={selected.status.replace("_", " ")} />
                  </div>
                  <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="data-label mb-1">Passed Rules</div>
                      <ul className="text-sm text-[#166534] list-disc list-inside space-y-1">
                        {(selected.passed_rules || []).map((r) => <li key={r}>{r}</li>)}
                        {!selected.passed_rules?.length && <li className="text-gray-400 italic list-none">None</li>}
                      </ul>
                    </div>
                    <div>
                      <div className="data-label mb-1">Failed Rules</div>
                      <ul className="text-sm text-[#991B1B] list-disc list-inside space-y-1">
                        {(selected.failed_rules || []).map((r) => <li key={r}>{r}</li>)}
                        {!selected.failed_rules?.length && <li className="text-gray-400 italic list-none">None</li>}
                      </ul>
                    </div>
                  </div>
                  <div className="px-5 pb-5">
                    <div className="data-label mb-1">Decision Reason</div>
                    <p className="text-sm text-gray-900">{selected.decision_reason}</p>
                  </div>
                </div>

                <div className="bg-white border border-[#E5E7EB]">
                  <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
                    <span className="data-label">Audit Timeline</span>
                    {auditLoading && <span className="text-xs text-gray-500">loading…</span>}
                  </div>
                  <div className="p-5" data-testid="demo-audit-timeline">
                    <AuditTimeline events={audit} />
                  </div>
                </div>

                <div className="bg-[#0A0A0A] text-white p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                  <div>
                    <div className="data-label text-gray-400 mb-1">Like what you see?</div>
                    <div className="font-heading text-xl font-bold">Process your own invoices</div>
                    <p className="text-sm text-gray-300 mt-1">Sign in as admin to upload PDFs and TXTs.</p>
                  </div>
                  <Link
                    to="/login"
                    data-testid="demo-cta-signin"
                    className="inline-flex items-center gap-2 bg-cobalt hover:bg-cobalt-hover px-4 py-2.5 text-sm font-semibold"
                  >
                    Open the console <ExternalLink size={14} />
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div>
      <div className="data-label mb-1">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : ""} ${value ? "text-gray-900" : "text-gray-400 italic"}`}>
        {value ?? "—"}
      </div>
    </div>
  );
}
