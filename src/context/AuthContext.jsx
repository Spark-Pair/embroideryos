import { createContext, useEffect, useState } from 'react';
import { getMe } from '../api/auth.api';
import { useToast } from "../context/ToastContext";

export const AuthContext = createContext();

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // 🔁 App load auth check
  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      setLoading(false);
      return;
    }

    getMe(token)
      .then((res) => {
        if (res?.error) {
          logout();
        } else {
          setUser(res);
        }
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, []);

  // ✅ LOGIN
  const login = async (token) => {
    setLoading(true);
    localStorage.setItem('token', token);

    try {
      const res = await getMe(token);
      if (res?.error) throw new Error();

      setUser(res);
      showToast({
        type: "success",
        message: `Welcome ${res.name || ''}`,
      });
      return true;
    } catch {
      logout();
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
