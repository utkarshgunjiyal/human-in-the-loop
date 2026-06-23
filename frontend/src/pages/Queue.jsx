import React, { useEffect, useState, useMemo } from "react";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { Search, ArrowDownUp, FilePlus2 } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "HUMAN_REVIEW", label: "Human Review" },
];

export default function Queue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("-created_at");

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (status) params.status = status;
      if (sort) params.sort = sort;
      const { data } = await api.get("/invoices", { params });
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [status, sort]);

  const onSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  const empty = !loading && !items.length;

  return (
    <AppShell title="Invoice Queue">
      <div className="bg-white border border-[#E5E7EB]" data-testid="queue-page">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex flex-wrap items-center gap-3">
          <form onSubmit={onSearchSubmit} className="flex items-center border border-[#E5E7EB] focus-within:border-cobalt flex-1 min-w-[240px] max-w-md">
            <Search size={14} className="ml-3 text-gray-500" />
            <input
              data-testid="queue-search-input"
              type="text"
              placeholder="Search vendor, invoice #, description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 text-sm outline-none"
            />
            <button type="submit" className="px-3 py-2 text-xs font-semibold uppercase tracking-wider border-l border-[#E5E7EB] hover:bg-gray-100" data-testid="queue-search-btn">
              Search
            </button>
          </form>

          <select
            data-testid="queue-status-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-[#E5E7EB] px-3 py-2 text-sm focus:border-cobalt outline-none"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <button
            data-testid="queue-sort-toggle"
            onClick={() => setSort((s) => (s === "-created_at" ? "created_at" : "-created_at"))}
            className="inline-flex items-center gap-2 border border-[#E5E7EB] px-3 py-2 text-sm hover:bg-gray-100"
          >
            <ArrowDownUp size={14} /> Date {sort === "-created_at" ? "↓" : "↑"}
          </button>

          <Link
            to="/upload"
            data-testid="queue-upload-link"
            className="ml-auto inline-flex items-center gap-2 bg-gray-900 hover:bg-cobalt text-white px-3 py-2 text-sm font-semibold transition-colors"
          >
            <FilePlus2 size={14} /> New invoice
          </Link>
        </div>

        {loading ? (
          <div className="p-6"><LoadingSpinner /></div>
        ) : empty ? (
          <EmptyState
            title="No invoices yet"
            description="Upload a PDF or TXT to start processing."
            action={<Link to="/upload" className="bg-cobalt hover:bg-cobalt-hover text-white px-4 py-2 text-sm font-semibold" data-testid="queue-empty-cta">Upload invoice</Link>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" data-testid="invoice-table">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-600">
                <tr>
                  <th className="text-left font-semibold px-5 py-3">Invoice #</th>
                  <th className="text-left font-semibold px-5 py-3">Vendor</th>
                  <th className="text-left font-semibold px-5 py-3">Date</th>
                  <th className="text-right font-semibold px-5 py-3">Amount</th>
                  <th className="text-left font-semibold px-5 py-3">Status</th>
                  <th className="text-right font-semibold px-5 py-3">Confidence</th>
                  <th className="text-left font-semibold px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {items.map((inv) => (
                  <InvoiceRow key={inv.id} inv={inv} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function InvoiceRow({ inv }) {
  return (
    <tr className="border-b border-[#E5E7EB] hover:bg-gray-50" data-testid={`invoice-row-${inv.id}`}>
      <td className="px-5 py-3 font-mono">
        <Link to={`/invoice/${inv.id}`} className="text-cobalt hover:underline font-semibold">
          {inv.invoice_number || "—"}
        </Link>
      </td>
      <td className="px-5 py-3">{inv.vendor || <span className="text-gray-400 italic">No vendor</span>}</td>
      <td className="px-5 py-3 font-mono text-gray-700">{inv.invoice_date || "—"}</td>
      <td className="px-5 py-3 font-mono text-right tabular">
        {inv.amount != null ? `$${Number(inv.amount).toLocaleString()}` : "—"}
      </td>
      <td className="px-5 py-3"><StatusBadge status={inv.status} /></td>
      <td className="px-5 py-3 font-mono text-right">{Math.round((inv.confidence_score || 0) * 100)}%</td>
      <td className="px-5 py-3 font-mono text-xs text-gray-500">
        {new Date(inv.created_at).toLocaleString()}
      </td>
    </tr>
  );
}
