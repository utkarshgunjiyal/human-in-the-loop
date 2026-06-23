import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function ProtectedRoute({ children }) {
  const { user, bootstrapping } = useAuth();
  const location = useLocation();

  if (bootstrapping || user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner label="Authenticating…" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}
