import React, { useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import { api, formatApiError } from "@/lib/api";
import { Link } from "react-router-dom";
import { UploadCloud, FileCheck2, Loader2, AlertTriangle, FileText, ArrowUpRight } from "lucide-react";

export default function Upload() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const pickFile = (f) => {
    if (!f) return;
    const ok = /\.(pdf|txt)$/i.test(f.name);
    if (!ok) {
      setError("Only PDF or TXT files are supported.");
      return;
    }
    setError("");
    setResult(null);
    setFile(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) pickFile(e.dataTransfer.files[0]);
  };

  const process = async () => {
    if (!file) return;
    setProcessing(true);
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/process", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setResult(data);
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AppShell title="Upload Invoice">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" data-testid="upload-page">
        <div className="lg:col-span-7 space-y-4">
          <div
            data-testid="upload-dropzone"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed p-10 text-center transition-colors bg-white ${
              dragOver ? "border-cobalt bg-cobalt/5" : "border-gray-300 hover:border-gray-500"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.txt"
              className="hidden"
              data-testid="upload-file-input"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <UploadCloud size={28} className="mx-auto text-cobalt mb-3" />
            <div className="font-heading text-lg font-bold">Drop your invoice here</div>
            <p className="text-sm text-gray-600 mt-1">or click to browse files</p>
            <div className="data-label mt-4">Supported · <span className="font-mono">.pdf · .txt</span></div>
          </div>

          {file && (
            <div className="bg-white border border-[#E5E7EB] p-4 flex items-center gap-4" data-testid="upload-file-preview">
              <FileText size={18} className="text-cobalt shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{file.name}</div>
                <div className="text-xs font-mono text-gray-500">{(file.size / 1024).toFixed(1)} KB</div>
              </div>
              <button
                data-testid="upload-process-btn"
                onClick={process}
                disabled={processing}
                className="bg-cobalt hover:bg-cobalt-hover text-white text-sm font-semibold px-4 py-2.5 inline-flex items-center gap-2 disabled:opacity-60"
              >
                {processing ? <Loader2 size={14} className="animate-spin" /> : <FileCheck2 size={14} />}
                {processing ? "Processing…" : "Process Invoice"}
              </button>
            </div>
          )}

          {error && (
            <div
              data-testid="upload-error"
              className="bg-[#FEE2E2] border border-[#EF4444] text-[#991B1B] px-4 py-3 text-sm flex items-center gap-2"
            >
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <div className="bg-white border border-[#E5E7EB] p-5 sticky top-24" data-testid="upload-result-panel">
            <div className="data-label mb-3">Extraction Result</div>
            {!result ? (
              <div className="text-sm text-gray-500">
                Upload an invoice to see extracted fields, validation results, and the assigned decision.
              </div>
            ) : (
              <ResultView result={result} />
            )}
          </div>
        </div>
      </div>

      {/* Sample reference */}
      <div className="mt-8 bg-white border border-[#E5E7EB] p-5">
        <div className="data-label mb-2">Sample TXT format the parser understands</div>
        <pre className="font-mono text-xs whitespace-pre-wrap text-gray-700 bg-gray-50 p-3 border border-[#E5E7EB]">
{`Vendor: ABC Traders
Invoice Number: INV-001
Date: 2026-06-23
Amount: 45000
Description: Cloud infrastructure services`}
        </pre>
      </div>
    </AppShell>
  );
}

function ResultView({ result }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StatusBadge status={result.status} size="lg" />
        <span className="text-xs font-mono text-gray-500">
          conf {Math.round((result.confidence_score || 0) * 100)}%
        </span>
      </div>

      <FieldRow label="Vendor" value={result.vendor} />
      <FieldRow label="Invoice #" value={result.invoice_number} mono />
      <FieldRow label="Date" value={result.invoice_date} mono />
      <FieldRow label="Amount" value={result.amount != null ? `$${Number(result.amount).toLocaleString()}` : null} mono />
      <FieldRow label="Description" value={result.description} />

      <div>
        <div className="data-label mb-1">Decision Reason</div>
        <p className="text-sm text-gray-800">{result.decision_reason || "—"}</p>
      </div>

      {(result.failed_rules?.length || 0) > 0 && (
        <div>
          <div className="data-label mb-1">Failed Rules</div>
          <ul className="text-sm list-disc list-inside text-[#991B1B]">
            {result.failed_rules.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      )}

      <Link
        to={`/invoice/${result.id}`}
        data-testid="upload-result-open-detail"
        className="inline-flex items-center justify-between gap-2 w-full bg-gray-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-cobalt transition-colors"
      >
        Open in Review <ArrowUpRight size={14} />
      </Link>
    </div>
  );
}

function FieldRow({ label, value, mono }) {
  return (
    <div className="border-b border-[#E5E7EB] pb-2">
      <div className="data-label">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : ""} ${value ? "text-gray-900" : "text-gray-400 italic"}`}>
        {value ?? "Not detected"}
      </div>
    </div>
  );
}
