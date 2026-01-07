// src/pages/Sessions.jsx
import { useState, useEffect } from 'react';
import { getUserSessions, revokeSession, logoutAllDevices } from '../api/auth.api';
import { useToast } from '../context/ToastContext';
import useAuth from '../hooks/useAuth';
import Card from '../components/Card';
import Button from '../components/Button';

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const { logout } = useAuth();

  const fetchSessions = async () => {
    try {
      const data = await getUserSessions();
      setSessions(data.sessions || []);
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

  if (loading) return <div>Loading sessions...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Active Sessions</h1>
        <Button variant="danger" onClick={handleLogoutAll}>
          Logout All Devices
        </Button>
      </div>

      <div className="grid gap-4">
        {sessions.length === 0 ? (
          <Card>
            <p className="text-gray-500">No active sessions found</p>
          </Card>
        ) : (
          sessions.map((session) => (
            <Card key={session.sessionId}>
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-lg">
                      {session.device} - {session.browser}
                    </span>
                    {session.sessionId === localStorage.getItem('sessionId') && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        Current
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>OS: {session.os}</p>
                    <p>IP: {session.ipAddress}</p>
                    <p>Last active: {new Date(session.lastActivity).toLocaleString()}</p>
                    <p>Created: {new Date(session.createdAt).toLocaleString()}</p>
                  </div>
                </div>

                {session.sessionId !== localStorage.getItem('sessionId') && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleRevokeSession(session.sessionId)}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}