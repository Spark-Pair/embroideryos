import axios from "axios";

const API = import.meta.env.VITE_API_URL;

export const apiClient = axios.create({
  baseURL: API,
  withCredentials: true, // cookie-based auth
  headers: { "Content-Type": "application/json" },
});

// 🔹 Request interceptor to attach token automatically
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token"); // token stored in localStorage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Optional: Response interceptor to handle auth errors globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // token expired or invalid
      localStorage.removeItem("token");
      window.location.href = "/login"; // redirect to login
    }
    return Promise.reject(error);
  }
);
