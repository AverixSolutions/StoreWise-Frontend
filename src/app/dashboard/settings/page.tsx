// src/app/dashboard/settings/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Printer, LogOut, ArrowRight, Monitor, Globe } from "lucide-react";
import { platform } from "@/platform";
import { logout } from "@/hooks/useAuth";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PrintSettingsSection from "@/components/settings/sections/PrintSettingsSection";

// ── Types ─────────────────────────────────────────────────────────────────────

type SettingsSection = "dashboard" | "printSettings";

type SectionDef = {
  id: SettingsSection;
  title: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  accentText: string;
  border: string;
  hoverBg: string;
  tag?: string;
};

// ── Section registry — add new settings sections here ────────────────────────

const settingsSections: SectionDef[] = [
  {
    id: "printSettings",
    title: "Print Settings",
    description: "Assign printers per task — purchase, sales, returns",
    icon: Printer,
    accent: "bg-sky-100",
    accentText: "text-sky-600",
    border: "border-sky-200",
    hoverBg: "hover:bg-sky-50/70",
  },
  // ── Add future sections here, e.g.:
  // { id: "notifications", title: "Notifications", ... }
  // { id: "security",      title: "Security & Access", ... }
  // { id: "appearance",    title: "Appearance", ... }
];

// ── Settings tile ─────────────────────────────────────────────────────────────

function SettingsTile({
  section,
  onOpen,
}: {
  section: SectionDef;
  onOpen: () => void;
}) {
  const Icon = section.icon;
  return (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.984 }}
      onClick={onOpen}
      className={`group w-full rounded-[20px] border bg-white p-4 text-left shadow-[0_2px_10px_rgba(15,23,42,0.05)] transition-all duration-200 cursor-pointer ${section.border} ${section.hoverBg} hover:shadow-[0_8px_24px_rgba(15,23,42,0.09)]`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${section.accent} ${section.accentText}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <ArrowRight
          className={`mt-1 h-4 w-4 shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:${section.accentText}`}
        />
      </div>
      <div className="mt-3.5">
        <h3 className="text-sm font-semibold tracking-[-0.02em] text-slate-900">
          {section.title}
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {section.description}
        </p>
      </div>
    </motion.button>
  );
}

// ── Dashboard view ────────────────────────────────────────────────────────────

function SettingsDashboard({
  onOpen,
  onLogout,
}: {
  onOpen: (s: SettingsSection) => void;
  onLogout: () => void;
}) {
  const runtime = platform.getRuntimeInfo();

  return (
    <div className="flex flex-col gap-4">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#0a1324_0%,#101a31_58%,#16213d_100%)] px-5 py-5 text-white shadow-[0_8px_20px_rgba(7,12,24,0.10)] md:px-6">
        <div className="pointer-events-none absolute -left-10 top-0 h-28 w-28 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative">
          <div className="kyn-brand-pill mb-3 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
            KYNFLOW • SETTINGS
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white md:text-[28px]">
            App settings & <span className="kyn-brand-text">preferences.</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Printers, appearance, security and more.
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
            {runtime.runtime === "desktop" ? (
              <>
                <Monitor className="h-3.5 w-3.5" /> Desktop app
              </>
            ) : (
              <>
                <Globe className="h-3.5 w-3.5" /> Web browser
              </>
            )}
          </div>
        </div>
      </section>

      {/* Tiles */}
      <section className="rounded-[26px] border border-slate-200 bg-slate-50/70 p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] md:p-5">
        <div className="mb-4">
          <div className="mb-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            All Settings
          </div>
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
            Select a category
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {settingsSections.map((s) => (
            <SettingsTile key={s.id} section={s} onOpen={() => onOpen(s.id)} />
          ))}
        </div>
      </section>

      {/* Account / Danger zone */}
      <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Account
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-800">Sign out</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Ends your current session on this device
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 hover:border-red-300 cursor-pointer w-fit"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const [currentSection, setCurrentSection] =
    useState<SettingsSection>("dashboard");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      router.push("/login");
    } catch (e) {
      console.error("Logout failed:", e);
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  const renderSection = () => {
    switch (currentSection) {
      case "printSettings":
        return (
          <PrintSettingsSection onBack={() => setCurrentSection("dashboard")} />
        );
      default:
        return (
          <SettingsDashboard
            onOpen={setCurrentSection}
            onLogout={() => setShowLogoutConfirm(true)}
          />
        );
    }
  };

  return (
    <main className="pb-10 md:pb-0">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSection}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          {renderSection()}
        </motion.div>
      </AnimatePresence>

      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Log out of KYNFLOW?"
        message={
          loggingOut
            ? "Syncing your data before logging out…"
            : "Any unsynced changes will be pushed to the server before you are logged out."
        }
        confirmText={loggingOut ? "Logging out…" : "Log out"}
        cancelText="Stay here"
        onConfirm={handleLogout}
        onCancel={() => {
          if (!loggingOut) setShowLogoutConfirm(false);
        }}
      />
    </main>
  );
}
