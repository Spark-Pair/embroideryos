// src/pages/Login.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "../context/ToastContext";
import { loginUser, forceLoginUser } from '../api/auth.api';
import useAuth from '../hooks/useAuth';

import Input from '../components/Input';
import Button from '../components/Button';
import Card from '../components/Card';

export default function Login() {
  const { login, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const [sessionConflict, setSessionConflict] = useState(null);

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    
    if (!form.username || !form.password) {
      showToast({
        type: "error",
        message: "Please enter username and password",
      });
      return;
    }

    setLoading(true);
    setSessionConflict(null);

    try {
      const res = await loginUser(form);

      if (res.data.accessToken) {
        const loginResult = await login(res.data);
        
        if (loginResult.success) {
          navigate("/dashboard");
        }
      }

    } catch (err) {
      const errorData = err.response?.data;
      
      // Handle session conflict
      if (err.response?.status === 409 && errorData?.code === 'ALREADY_LOGGED_IN') {
        setSessionConflict(errorData);
        showToast({
          type: "warning",
          message: "You are already logged in from another device",
        });
      } else {
        showToast({
          type: "error",
          message: errorData?.message || "Login failed. Please try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForceLogin = async () => {
    setLoading(true);

    try {
      const res = await forceLoginUser(form);

      if (res.data.accessToken) {
        const loginResult = await login(res.data);
        
        if (loginResult.success) {
          showToast({
            type: "success",
            message: "Previous session terminated. You're now logged in.",
          });
          navigate("/dashboard");
        }
      }

    } catch (err) {
      showToast({
        type: "error",
        message: err.response?.data?.message || "Force login failed",
      });
    } finally {
      setLoading(false);
      setSessionConflict(null);
    }
  };

  const handleCancelForceLogin = () => {
    setSessionConflict(null);
    setForm({ username: '', password: '' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-green-100 flex items-center justify-center p-6">
      <Card
        title="Login"
        subtitle={sessionConflict ? "Active Session Detected" : "Login with your username"}
        className="w-full max-w-md"
      >
        {sessionConflict ? (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                You are already logged in from another device or browser.
              </p>
              <p className="text-xs text-yellow-600 mt-2">
                Session created: {new Date(sessionConflict.sessionInfo?.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={handleCancelForceLogin}
                className="flex-1"
              >
                Cancel
              </Button>
              
              <Button
                variant="danger"
                onClick={handleForceLogin}
                loading={loading}
                className="flex-1"
              >
                Login Anyway
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Logging in anyway will end your previous session
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className='grid gap-4'>
            <Input
              label="Username"
              name="username"
              placeholder="Enter your username"
              value={form.username}
              onChange={handleChange}
              required
            />

            <Input
              label="Password"
              name="password"
              type="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              required
            />

            <Button
              type="submit"
              loading={loading}
              className="w-full mt-2"
            >
              Login
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}