// src/lib/axios.ts
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3003",
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
