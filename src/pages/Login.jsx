import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from "../context/ToastContext";

import { loginUser } from '../api/auth.api';
import useAuth from '../hooks/useAuth';

import Input from '../components/input';
import Button from '../components/button';
import Card from '../components/Card';

export default function Login() {
  const { login, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '',
    password: '',
  });

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await loginUser(form);

      if (!res.data.token) {
        showToast({
          type: "error",
          message: res.message || res.data?.message || "Invalid credentials",
        });
        return;
      }

      await login(res.data.token);

      showToast({
        type: "success",
        message: "Login successful 🎉",
      });

      // navigate("/dashboard");

    } catch (err) {
      showToast({
        type: "error",
        message: err.message || "Login failed",
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
          />

          <Input
            label="Password"
            name="password"
            type="password"
            placeholder="Enter your password"
            value={form.password}
            onChange={handleChange}
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
