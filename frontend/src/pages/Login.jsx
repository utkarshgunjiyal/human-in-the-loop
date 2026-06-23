import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { formatApiError } from "@/lib/api";
import { ScanLine } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/dashboard";

  const [email, setEmail] = useState("admin@invoiceai.com");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" data-testid="login-page">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0A0A0A] text-white p-12 flex-col justify-between relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MTN8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMG1pbmltYWwlMjBnZW9tZXRyaWMlMjBiYWNrZ3JvdW5kJTIwbGlnaHR8ZW58MHx8fHwxNzgyMTc3MTEzfDA&ixlib=rb-4.1.0&q=85)",
            backgroundSize: "cover",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-cobalt flex items-center justify-center">
              <ScanLine size={20} strokeWidth={2.4} />
            </div>
            <div>
              <div className="font-heading font-black tracking-tight text-lg leading-none">INVOICE.AI</div>
              <div className="text-[11px] tracking-[0.2em] uppercase text-gray-400 mt-1">Audit Console</div>
            </div>
          </div>
          <h2 className="font-heading text-4xl lg:text-5xl font-black tracking-tight leading-[1.05] max-w-md">
            Authority. Clarity. Truth.
          </h2>
          <p className="mt-6 text-gray-300 max-w-md leading-relaxed">
            Automated invoice review with a deterministic rules engine and humans firmly in the loop.
            Every action traceable, every decision explainable.
          </p>
        </div>
        <div className="relative font-mono text-[11px] text-gray-400 tracking-tight">
          v1.0 · React · FastAPI · MongoDB · JWT
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
          <div className="data-label mb-2">Sign In</div>
          <h1 className="font-heading text-3xl font-bold tracking-tight mb-8">Reviewer Access</h1>

          {error && (
            <div className="mb-4 px-3 py-2 bg-[#FEE2E2] border border-[#EF4444] text-[#991B1B] text-sm" data-testid="login-error">
              {error}
            </div>
          )}

          <label className="block mb-4">
            <span className="data-label block mb-2">Email</span>
            <input
              data-testid="login-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-[#E5E7EB] px-3 py-2.5 text-sm focus:border-cobalt focus:outline-none focus:ring-1 focus:ring-cobalt"
            />
          </label>

          <label className="block mb-6">
            <span className="data-label block mb-2">Password</span>
            <input
              data-testid="login-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-[#E5E7EB] px-3 py-2.5 text-sm focus:border-cobalt focus:outline-none focus:ring-1 focus:ring-cobalt"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            data-testid="login-submit-button"
            className="w-full bg-cobalt hover:bg-cobalt-hover text-white font-semibold text-sm py-3 transition-colors disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>

          <div className="mt-6 text-sm text-gray-600">
            New reviewer?{" "}
            <Link to="/signup" className="text-cobalt font-semibold hover:underline" data-testid="login-goto-signup">
              Create an account
            </Link>
          </div>

          <div className="mt-8 border-t border-[#E5E7EB] pt-4 text-[11px] font-mono text-gray-500 leading-relaxed">
            <div className="data-label mb-1">Demo credentials</div>
            admin@invoiceai.com / Admin@123<br />
            reviewer@invoiceai.com / Reviewer@123
          </div>
        </form>
      </div>
    </div>
  );
}
