// src/components/auth/LoginForm.tsx
"use client";

import { useState } from "react";
import { login } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginForm() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ADMIN");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(userId, password, role);
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Invalid credentials, please try again.",
      );
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <div>
        <label
          htmlFor="userId"
          className="mb-1.5 block text-sm font-medium text-white/90"
        >
          User ID
        </label>
        <input
          id="userId"
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Enter user ID"
          autoComplete="username"
          className="w-full rounded-xl border border-white/10 bg-[#0a1222] px-4 py-3 text-sm sm:text-base text-white outline-none placeholder:text-[#8ea3c7] transition focus:border-[#20b7ff]/60 focus:ring-4 focus:ring-[#20b7ff]/10"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-sm font-medium text-white/90"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
            className="w-full rounded-xl border border-white/10 bg-[#0a1222] px-4 py-3 pr-12 text-sm sm:text-base text-white outline-none placeholder:text-[#8ea3c7] transition focus:border-[#20b7ff]/60 focus:ring-4 focus:ring-[#20b7ff]/10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute inset-y-0 right-3 flex items-center text-[#8ea3c7] transition hover:text-white"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="role"
          className="mb-1.5 block text-sm font-medium text-white/90"
        >
          Role
        </label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-[#0a1222] px-4 py-3 text-sm sm:text-base text-white outline-none transition focus:border-[#20b7ff]/60 focus:ring-4 focus:ring-[#20b7ff]/10"
        >
          <option value="ADMIN">Owner</option>
          <option value="SUPERVISOR">Shop Manager</option>
          <option value="USER">Staff</option>
        </select>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-200">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-gradient-to-r from-[#20b7ff] to-[#b026ff] py-3 text-sm sm:text-base font-semibold text-white shadow-[0_10px_30px_rgba(32,183,255,0.22)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
