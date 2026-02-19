// src/pages/Sessions.jsx
import { useState, useEffect } from 'react';
import { getUserSessions, revokeSession, logoutAllDevices } from '../api/auth.api';
import { useToast } from '../context/ToastContext';
import useAuth from '../hooks/useAuth';
import Card from '../components/Card';
import Button from '../components/Button';
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  Globe, 
  MapPin, 
  Clock, 
  Calendar,
  CheckCircle2,
  AlertCircle,
  LogOut
} from 'lucide-react';

const getRelativeTime = (date) => {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString();
};

const getDeviceIcon = (device) => {
  switch(device.toLowerCase()) {
    case 'mobile': 
      return <Smartphone className="w-5 h-5" />;
    case 'tablet': 
      return <Tablet className="w-5 h-5" />;
    default: 
      return <Monitor className="w-5 h-5" />;
  }
};

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const { logout } = useAuth();

  const fetchSessions = async () => {
    try {
      const data = await getUserSessions();
      setSessions(data.sessions || []);
      setCurrentSessionId(data.currentSessionId);
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to load sessions',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRevokeSession = async (sessionId) => {
    try {
      await revokeSession(sessionId);
      showToast({
        type: 'success',
        message: 'Session revoked successfully',
      });
      fetchSessions();
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to revoke session',
      });
    }
  };

  const handleLogoutAll = async () => {
    if (!confirm('This will log you out from all devices. Continue?')) return;

    try {
      await logoutAllDevices();
      showToast({
        type: 'success',
        message: 'Logged out from all devices',
      });
      logout();
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to logout from all devices',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500">Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sessions</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage and monitor your active sessions across devices
          </p>
        </div>
        {sessions.length > 1 && (
          <Button 
            variant="danger" 
            onClick={handleLogoutAll}
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout All Devices
          </Button>
        )}
      </div>

      {/* Sessions Grid */}
      <div className="grid gap-4">
        {sessions.length === 0 ? (
          <Card className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No Active Sessions</h3>
            <p className="text-sm text-gray-500">You don't have any active sessions at the moment</p>
          </Card>
        ) : (
          sessions.map((session) => {
            const isCurrent = session.isCurrent || session.sessionId === currentSessionId;
            
            return (
              <Card 
                key={session.sessionId}
                className={`transition-all duration-200 hover:shadow-lg ${
                  isCurrent 
                    ? 'border-l-4 border-l-green-500 bg-green-50/30' 
                    : 'hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-6">
                  {/* Left: Device Icon */}
                  <div className={`
                    flex-shrink-0 p-3 rounded-xl
                    ${isCurrent 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-600'
                    }
                  `}>
                    {getDeviceIcon(session.device)}
                  </div>

                  {/* Middle: Session Details */}
                  <div className="flex-1 min-w-0">
                    {/* Title Row */}
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-base font-semibold text-gray-900">
                        {session.browser} · {session.os}
                      </h3>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          Current Session
                        </span>
                      )}
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{session.device}</span>
                      </div>

                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{session.ipAddress}</span>
                      </div>

                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span>Active {getRelativeTime(session.lastActivity)}</span>
                      </div>

                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span>Signed in {new Date(session.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Action Button */}
                  {!isCurrent && (
                    <div className="flex-shrink-0">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleRevokeSession(session.sessionId)}
                        className="whitespace-nowrap"
                      >
                        Revoke
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Footer Stats */}
      {sessions.length > 0 && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 pt-2 border-t">
          <CheckCircle2 className="w-4 h-4" />
          <span>
            {sessions.length} active {sessions.length === 1 ? 'session' : 'sessions'}
          </span>
        </div>
      )}
    </div>
  );
}