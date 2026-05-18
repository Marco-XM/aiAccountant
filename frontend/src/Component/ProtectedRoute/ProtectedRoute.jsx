import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../../Context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { token, authReady } = useContext(AuthContext);

  if (!authReady) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="rounded-2xl border border-white/10 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-600 shadow-lg backdrop-blur">
          Restoring session...
        </div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
