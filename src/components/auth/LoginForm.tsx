// src/components/auth/LoginForm.tsx
import { useState } from "react";
import RoleDropdown from "@/components/ui/RoleDropdown";
import { login } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginForm() {
  const [role, setRole] = useState<"admin" | "supervisor" | "user" | null>(
    null
  );
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!role) {
      setError("Please select a role before logging in.");
      return;
    }
    try {
      await login(
        userId,
        password,
        role.toUpperCase() as "ADMIN" | "SUPERVISOR" | "USER"
      );
      router.push("/dashboard");
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Invalid credentials, please try again."
      );
    }
  };

  return (
    <form className="space-y-6 animate-fadeIn" onSubmit={handleSubmit}>
      <RoleDropdown value={role} onChange={setRole} />

      {/* Input fields */}
      <div className="space-y-4">
        <input
          type="text"
          placeholder="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 shadow-sm focus:ring-2 focus:ring-averix-red-light outline-none transition"
        />

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 shadow-sm focus:ring-2 focus:ring-averix-red-light outline-none transition pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-2 mt-2">
          <AlertCircle size={16} className="mr-2" />
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        className="w-full bg-gradient-to-r from-averix-red-dark to-averix-red-vivid hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg text-white rounded-xl py-3 font-semibold shadow-md transition transform cursor-pointer"
      >
        {role
          ? `Login as ${role.charAt(0).toUpperCase() + role.slice(1)}`
          : "Login"}
      </button>
    </form>
  );
}
