import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { formatApiError } from "@/lib/api";
import { ScanLine } from "lucide-react";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: "", email: "", password: "", role: "REVIEWER" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signup(form);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6] p-6" data-testid="signup-page">
      <form onSubmit={submit} className="w-full max-w-md bg-white border border-[#E5E7EB] p-8" data-testid="signup-form">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 bg-cobalt text-white flex items-center justify-center">
            <ScanLine size={18} />
          </div>
          <div>
            <div className="font-heading font-black tracking-tight">INVOICE.AI</div>
            <div className="data-label">Audit Console</div>
          </div>
        </div>
        <h1 className="font-heading text-2xl font-bold mb-6">Create account</h1>

        {error && (
          <div className="mb-4 px-3 py-2 bg-[#FEE2E2] border border-[#EF4444] text-[#991B1B] text-sm" data-testid="signup-error">
            {error}
          </div>
        )}

        <label className="block mb-3">
          <span className="data-label block mb-2">Username</span>
          <input
            data-testid="signup-username-input"
            type="text"
            value={form.username}
            onChange={(e) => set("username", e.target.value)}
            required
            className="w-full border border-[#E5E7EB] px-3 py-2.5 text-sm focus:border-cobalt focus:outline-none focus:ring-1 focus:ring-cobalt"
          />
        </label>

        <label className="block mb-3">
          <span className="data-label block mb-2">Email</span>
          <input
            data-testid="signup-email-input"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            required
            className="w-full border border-[#E5E7EB] px-3 py-2.5 text-sm focus:border-cobalt focus:outline-none focus:ring-1 focus:ring-cobalt"
          />
        </label>

        <label className="block mb-3">
          <span className="data-label block mb-2">Password</span>
          <input
            data-testid="signup-password-input"
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            required
            minLength={6}
            className="w-full border border-[#E5E7EB] px-3 py-2.5 text-sm focus:border-cobalt focus:outline-none focus:ring-1 focus:ring-cobalt"
          />
        </label>

        <label className="block mb-6">
          <span className="data-label block mb-2">Role</span>
          <select
            data-testid="signup-role-select"
            value={form.role}
            onChange={(e) => set("role", e.target.value)}
            className="w-full border border-[#E5E7EB] px-3 py-2.5 text-sm focus:border-cobalt focus:outline-none"
          >
            <option value="REVIEWER">Reviewer</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={submitting}
          data-testid="signup-submit-button"
          className="w-full bg-cobalt hover:bg-cobalt-hover text-white font-semibold text-sm py-3 transition-colors disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create account"}
        </button>

        <div className="mt-6 text-sm text-gray-600">
          Already have an account?{" "}
          <Link to="/login" className="text-cobalt font-semibold hover:underline" data-testid="signup-goto-login">
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
