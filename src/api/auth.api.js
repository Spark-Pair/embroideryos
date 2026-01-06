import { apiClient } from "./apiClient";

export const loginUser = async (data) => {
  const res = await apiClient.post("/auth/login", data);
  // Save token automatically if login successful
  if (res.data.token) localStorage.setItem("token", res.data.token);
  return res;
};

export const getMe = async () => {
  const res = await apiClient.get("/auth/me");
  return res.data;
};
