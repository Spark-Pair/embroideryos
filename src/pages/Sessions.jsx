import { useEffect, useMemo, useState } from "react";
import { getUserSessions, revokeSession, logoutAllDevices } from "../api/auth.api";
import { useToast } from "../context/ToastContext";
import useAuth from "../hooks/useAuth";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import Button from "../components/Button";
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  MapPin,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  ShieldCheck,
} from "lucide-react";

const getRelativeTime = (date) => {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString();
};

const getDeviceIcon = (device) => {
  const value = String(device || "").toLowerCase();
  switch (value) {
    case "mobile":
      return Smartphone;
    case "tablet":
      return Tablet;
    default:
      return Monitor;
  }
};

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busySessionId, setBusySessionId] = useState("");
  const { showToast } = useToast();
  const { logout } = useAuth();

  const fetchSessions = async () => {
    try {
      const data = await getUserSessions();
      setSessions(data.sessions || []);
      setCurrentSessionId(data.currentSessionId);
    } catch {
      showToast({ type: "error", message: "Failed to load sessions" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRevokeSession = async (sessionId) => {
    try {
      setBusySessionId(sessionId);
      await revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      showToast({ type: "success", message: "Session revoked successfully" });
      fetchSessions();
    } catch (err) {
      showToast({ type: "error", message: err.response?.data?.message || "Failed to revoke session" });
    } finally {
      setBusySessionId("");
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm("This will log you out from all devices. Continue?")) return;

    try {
      await logoutAllDevices();
      showToast({ type: "success", message: "Logged out from all devices" });
      logout();
    } catch {
      showToast({ type: "error", message: "Failed to logout from all devices" });
    }
  };

  const stats = useMemo(() => {
    const total = sessions.length;
    const current = sessions.filter((s) => s.isCurrent || s.sessionId === currentSessionId).length;
    const other = Math.max(total - current, 0);
    return { total, current, other };
  }, [sessions, currentSessionId]);

  if (loading) {
    return (
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader title="Sessions" subtitle="Manage and monitor active sessions across devices." />
        <div className="rounded-3xl border border-gray-300 bg-white p-10 text-sm text-gray-500">
          Loading sessions...
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
      <PageHeader
        title="Sessions"
        subtitle="Manage and monitor active sessions across devices."
        actionLabel={sessions.length > 1 ? "Logout All Devices" : undefined}
        actionIcon={LogOut}
        onAction={sessions.length > 1 ? handleLogoutAll : undefined}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Active Sessions" value={stats.total} icon={ShieldCheck} />
        <StatCard label="Current Session" value={stats.current} icon={CheckCircle2} variant="success" />
        <StatCard label="Other Devices" value={stats.other} icon={AlertTriangle} variant={stats.other > 0 ? "warning" : "normal"} />
      </div>

      <div className="rounded-3xl border border-gray-300 bg-white overflow-hidden flex-1 flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <p className="text-sm font-semibold text-gray-800">Session List</p>
          <p className="text-xs text-gray-500">Review devices and revoke unknown sessions.</p>
        </div>

        <div className="flex-1 overflow-auto divide-y divide-gray-200">
          {sessions.length === 0 ? (
            <div className="px-8 py-16 text-center">
              <AlertTriangle className="w-10 h-10 mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-600">No active sessions found.</p>
            </div>
          ) : (
            sessions.map((session) => {
              const isCurrent = session.isCurrent || session.sessionId === currentSessionId;
              const DeviceIcon = getDeviceIcon(session.device);
              const rowTone = isCurrent ? "bg-emerald-50/50" : "bg-white";

              return (
                <div key={session.sessionId} className={`px-6 py-4 ${rowTone}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl ${
                          isCurrent ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <DeviceIcon className="w-5 h-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{session.browser} - {session.os}</p>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              <CheckCircle2 className="w-3 h-3" />
                              Current
                            </span>
                          )}
                        </div>

                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-1.5 text-xs text-gray-600">
                          <p className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-gray-400" />{session.device || "-"}</p>
                          <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" />{session.ipAddress || "-"}</p>
                          <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gray-400" />Active {getRelativeTime(session.lastActivity)}</p>
                          <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-gray-400" />Signed in {new Date(session.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>

                    {!isCurrent && (
                      <Button
                        variant="danger"
                        size="sm"
                        className="whitespace-nowrap"
                        loading={busySessionId === session.sessionId}
                        onClick={() => handleRevokeSession(session.sessionId)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
