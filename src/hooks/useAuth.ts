// src/hooks/useAuth.ts
import api from "@/lib/axios";

interface LoginResponse {
  token: string;
  sessionId: string;
  user: {
    id: string;
    userId: string;
    role: string;
    licenseId?: string;
    licenseName?: string;
    [key: string]: any;
  };
}

export async function login(userId: string, password: string, role: string) {
  const res = await api.post<LoginResponse>("/auth/login", {
    userId,
    password,
    role,
    deviceInfo: navigator.userAgent,
  });

  const data = res.data;

  localStorage.setItem("token", data.token);
  localStorage.setItem("sessionId", data.sessionId);
  localStorage.setItem("role", data.user.role);
  localStorage.setItem("userName", data.user.userId);
  if (data.user.licenseName) {
    localStorage.setItem("licenseName", data.user.licenseName);
  }

  return data.user;
}

export function logout() {
  const sessionId = localStorage.getItem("sessionId");
  localStorage.clear();
  return api.post("/auth/logout", { sessionId });
}

export function getCurrentUser() {
  return {
    token: localStorage.getItem("token"),
    role: localStorage.getItem("role"),
    licenseName: localStorage.getItem("licenseName"),
    userName: localStorage.getItem("userName"),
  };
}
