import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import LoadingSpinner from "@/components/LoadingSpinner";
import AuditTimeline from "@/components/AuditTimeline";
import { api, formatApiError } from "@/lib/api";
import { ArrowLeft, Save, CheckCircle2, XCircle, AlertTriangle, FileText, Gauge } from "lucide-react";

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState("");
  const [edits, setEdits] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: inv }, { data: aud }] = await Promise.all([
        api.get(`/invoice/${id}`),
        api.get(`/audit/${id}`),
      ]);
      setInvoice(inv);
      setAudit(aud.items || []);
      setEdits({
        vendor: inv.vendor || "",
        invoice_number: inv.invoice_number || "",
        invoice_date: inv.invoice_date || "",
        amount: inv.amount ?? "",
        description: inv.description || "",
      });
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const setEdit = (k, v) => setEdits((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...edits,
        amount: edits.amount === "" ? null : Number(edits.amount),
      };
      const { data } = await api.put(`/invoice/${id}`, payload);
      setInvoice(data);
      const { data: aud } = await api.get(`/audit/${id}`);
      setAudit(aud.items || []);
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setSaving(false);
    }
  };

  const act = async (verb) => {
    setActing(verb);
    setError("");
    try {
      const { data } = await api.post(`/${verb}/${id}`);
      setInvoice(data);
      const { data: aud } = await api.get(`/audit/${id}`);
      setAudit(aud.items || []);
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setActing("");
    }
  };

  return (
    <AppShell title="Invoice Review">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-cobalt"
          data-testid="detail-back-button"
        >
          <ArrowLeft size={14} /> Back
        </button>
        {invoice && <StatusBadge status={invoice.status} size="lg" />}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="bg-[#FEE2E2] border border-[#EF4444] text-[#991B1B] px-4 py-3 text-sm" data-testid="detail-error">{error}</div>
      ) : !invoice ? (
        <div>Invoice not found.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" data-testid="invoice-detail">
          {/* Left: extracted text + rules */}
          <section className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-[#E5E7EB]">
              <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center gap-2">
                <FileText size={14} className="text-cobalt" />
                <span className="data-label">Source Text</span>
                <span className="ml-auto font-mono text-xs text-gray-500">{invoice.filename || "—"}</span>
              </div>
              <pre className="p-5 text-xs font-mono whitespace-pre-wrap text-gray-800 max-h-72 overflow-auto">
                {invoice.raw_text || "(No raw text available)"}
              </pre>
            </div>

            <div className="bg-white border border-[#E5E7EB]">
              <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center gap-2">
                <Gauge size={14} className="text-cobalt" />
                <span className="data-label">Decision Engine</span>
                <span className="ml-auto font-mono text-xs text-gray-500">
                  conf {Math.round((invoice.confidence_score || 0) * 100)}% · {invoice.extraction_method}
                </span>
              </div>
              <div className="p-5 space-y-4 text-sm">
                <div>
                  <div className="data-label mb-1">Decision Reason</div>
                  <p className="text-gray-900">{invoice.decision_reason || "—"}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="data-label mb-1">Passed Rules</div>
                    <ul className="text-sm text-[#166534] list-disc list-inside space-y-1">
                      {(invoice.passed_rules || []).map((r) => <li key={r}>{r}</li>)}
                      {!invoice.passed_rules?.length && <li className="text-gray-400 italic list-none">None</li>}
                    </ul>
                  </div>
                  <div>
                    <div className="data-label mb-1">Failed Rules</div>
                    <ul className="text-sm text-[#991B1B] list-disc list-inside space-y-1">
                      {(invoice.failed_rules || []).map((r) => <li key={r}>{r}</li>)}
                      {!invoice.failed_rules?.length && <li className="text-gray-400 italic list-none">None</li>}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#E5E7EB]">
              <div className="px-5 py-3 border-b border-[#E5E7EB]">
                <span className="data-label">Audit Timeline</span>
              </div>
              <div className="p-5">
                <AuditTimeline events={audit} />
              </div>
            </div>
          </section>

          {/* Right: editable fields + actions */}
          <section className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-[#E5E7EB]">
              <div className="px-5 py-3 border-b border-[#E5E7EB]">
                <span className="data-label">Extracted Fields</span>
              </div>
              <div className="p-5 space-y-3" data-testid="invoice-fields-form">
                <FieldInput label="Vendor" value={edits.vendor} onChange={(v) => setEdit("vendor", v)} testid="field-vendor" />
                <FieldInput label="Invoice #" value={edits.invoice_number} onChange={(v) => setEdit("invoice_number", v)} testid="field-invoice-number" mono />
                <FieldInput label="Date" value={edits.invoice_date} onChange={(v) => setEdit("invoice_date", v)} testid="field-invoice-date" placeholder="YYYY-MM-DD" mono />
                <FieldInput label="Amount" type="number" value={edits.amount} onChange={(v) => setEdit("amount", v)} testid="field-amount" mono />
                <FieldInput label="Description" value={edits.description} onChange={(v) => setEdit("description", v)} testid="field-description" textarea />

                <button
                  onClick={save}
                  disabled={saving}
                  data-testid="detail-save-button"
                  className="w-full inline-flex items-center justify-center gap-2 border border-gray-900 hover:bg-gray-900 hover:text-white px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  <Save size={14} /> {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>

            <div className="bg-white border border-[#E5E7EB] p-5">
              <div className="data-label mb-3">Reviewer actions</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => act("approve")}
                  disabled={!!acting}
                  data-testid="detail-approve-button"
                  className="inline-flex items-center justify-center gap-2 bg-[#166534] hover:bg-[#0f4424] text-white text-sm font-semibold py-2.5 disabled:opacity-60"
                >
                  <CheckCircle2 size={14} /> {acting === "approve" ? "Approving…" : "Approve"}
                </button>
                <button
                  onClick={() => act("reject")}
                  disabled={!!acting}
                  data-testid="detail-reject-button"
                  className="inline-flex items-center justify-center gap-2 bg-[#991B1B] hover:bg-[#7f1414] text-white text-sm font-semibold py-2.5 disabled:opacity-60"
                >
                  <XCircle size={14} /> {acting === "reject" ? "Rejecting…" : "Reject"}
                </button>
              </div>
              {invoice.status === "HUMAN_REVIEW" && (
                <div className="mt-4 flex items-center gap-2 text-xs text-[#92400E] bg-[#FEF3C7] border border-[#F59E0B] px-3 py-2">
                  <AlertTriangle size={12} /> Awaiting human decision
                </div>
              )}
            </div>

            <div className="bg-white border border-[#E5E7EB] p-5 text-xs font-mono text-gray-600">
              <div className="data-label mb-2">Metadata</div>
              <div>id: {invoice.id}</div>
              <div>created: {new Date(invoice.created_at).toLocaleString()}</div>
              <div>updated: {new Date(invoice.updated_at).toLocaleString()}</div>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function FieldInput({ label, value, onChange, type = "text", mono, textarea, placeholder, testid }) {
  return (
    <label className="block">
      <span className="data-label block mb-1.5">{label}</span>
      {textarea ? (
        <textarea
          data-testid={testid}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`w-full border border-[#E5E7EB] px-3 py-2 text-sm focus:border-cobalt outline-none ${mono ? "font-mono" : ""}`}
        />
      ) : (
        <input
          data-testid={testid}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full border border-[#E5E7EB] px-3 py-2 text-sm focus:border-cobalt outline-none ${mono ? "font-mono" : ""}`}
        />
      )}
    </label>
  );
}
