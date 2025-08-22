import { useState } from "react";
import RoleDropdown from "@/components/ui/RoleDropdown";

export default function LoginForm() {
  const [role, setRole] = useState<"admin" | "supervisor" | "user" | null>(
    null
  );
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      alert("Please select a role before logging in.");
      return;
    }
    console.log("Logging in as:", role, { userId, password });
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
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 shadow-sm focus:ring-2 focus:ring-averix-red-light outline-none transition"
        />
      </div>

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
