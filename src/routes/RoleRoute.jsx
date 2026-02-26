import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

export default function RoleRoute({ allow, children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!Array.isArray(allow) || allow.includes(user.role)) return children;

  return <Navigate to="/dashboard" replace />;
}

