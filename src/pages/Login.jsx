// src/pages/Login.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "../context/ToastContext";
import { loginUser } from '../api/auth.api';
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
      showToast({
        type: "error",
        message: errorData?.message || "Login failed. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-green-100 flex items-center justify-center p-6">
      <Card
        title="Login"
        subtitle="Login with your username"
        className="w-full max-w-md"
      >
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
      </Card>
    </div>
  );
}
