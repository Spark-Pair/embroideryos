import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { fetchMyReferenceData, fetchMyRuleData } from "../api/business";
import { hasAccessForRole } from "../utils/accessConfig";

export default function RoleRoute({ allow, accessKey, children }) {
  const { user, loading } = useAuth();
  const [referenceData, setReferenceData] = useState({});
  const [ruleData, setRuleData] = useState({});
  const [accessLoading, setAccessLoading] = useState(Boolean(accessKey));

  useEffect(() => {
    if (!accessKey || !user || user.role === "developer") {
      setAccessLoading(false);
      return;
    }
    let isMounted = true;

    const loadAccessData = async () => {
      try {
        setAccessLoading(true);
        const [referenceRes, ruleRes] = await Promise.all([
          fetchMyReferenceData().catch(() => ({ reference_data: {} })),
          fetchMyRuleData().catch(() => ({ rule_data: {} })),
        ]);
        if (!isMounted) return;
        setReferenceData(referenceRes?.reference_data || {});
        setRuleData(ruleRes?.rule_data || {});
      } finally {
        if (isMounted) setAccessLoading(false);
      }
    };

    loadAccessData();
    return () => {
      isMounted = false;
    };
  }, [user, accessKey]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (Array.isArray(allow) && allow.includes(user.role)) return children;
  if (!accessKey && !Array.isArray(allow)) return children;
  if (accessKey && user.role !== "developer") {
    if (accessLoading) return children;
    if (hasAccessForRole(ruleData, referenceData, accessKey, user.role)) return children;
  }
  if (!accessKey && Array.isArray(allow) && !allow.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}
