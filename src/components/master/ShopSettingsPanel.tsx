// src/components/master/ShopSettingsPanel.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  MapPin,
  Phone,
  ArrowLeft,
  LayoutDashboard,
  Image as ImageIcon,
  Save,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  User,
  X,
  Receipt,
  Upload,
  Loader2,
} from "lucide-react";
import { platform } from "@/platform";
import {
  getActiveLicenseId,
  getActiveToken,
} from "@/lib/session/runtimeSession";
import { uploadProductImage } from "@/lib/uploadImage";

// ── Types ────────────────────────────────────────────────────────────────────

type FormState = {
  shopName: string;
  /** Runtime-only preview URL — either a blob: URL (new file picked) or the
   *  existing R2 public URL loaded from settings. Never persisted to IDB. */
  logoPreviewUrl: string | null;
  /** The committed R2 public URL — what we actually save to IDB / server. */
  logoUrl: string | null;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  mobile: string;
  email: string;
  gstin: string;
  footerNote: string;
  authorizedSignatory: string;
};

type SyncInfo = {
  syncStatus?: string;
  lastSyncedAt?: string | null;
  warning?: string;
};

type ToastState = {
  type: "success" | "error" | "warning";
  message: string;
} | null;

type LogoUploadState =
  | { status: "idle" }
  | { status: "uploading"; progress?: number }
  | { status: "done"; url: string }
  | { status: "error"; message: string };

const initialState: FormState = {
  shopName: "",
  logoPreviewUrl: null,
  logoUrl: null,
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  mobile: "",
  email: "",
  gstin: "",
  footerNote: "",
  authorizedSignatory: "Authorized Signature",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function isDesktopRuntime(): boolean {
  return typeof window !== "undefined" && !!(window as any).electronAPI;
}

function syncStatusConfig(status?: string) {
  switch (status) {
    case "SYNCED":
      return {
        icon: CheckCircle2,
        label: "Synced to cloud",
        className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        dot: "bg-emerald-400",
      };
    case "PENDING":
      return {
        icon: RefreshCw,
        label: "Sync pending",
        className: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        dot: "bg-amber-400",
      };
    case "SYNC_FAILED":
      return {
        icon: AlertTriangle,
        label: "Sync failed",
        className: "text-rose-400 bg-rose-500/10 border-rose-500/20",
        dot: "bg-rose-400",
      };
    case "LOCAL_ONLY":
    default:
      return {
        icon: Clock,
        label: "Saved locally",
        className: "text-slate-400 bg-slate-500/10 border-slate-500/20",
        dot: "bg-slate-400",
      };
  }
}

// ── SectionCard ───────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  iconColor = "text-cyan-300",
  children,
}: {
  icon: React.ElementType;
  title: string;
  iconColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(3,10,24,0.06)] overflow-hidden">
      <div className="flex items-center gap-3 bg-[#1e3a5f] px-5 py-3">
        <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
          {title}
        </span>
      </div>
      <div className="bg-slate-50/60 p-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        {label}
        {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/15 focus:shadow-[0_1px_8px_rgba(32,183,255,0.12)]";

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({
  toast,
  onClose,
}: {
  toast: NonNullable<ToastState>;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const configs = {
    success: {
      icon: CheckCircle2,
      cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
    },
    error: {
      icon: AlertTriangle,
      cls: "border-rose-500/30 bg-rose-500/15 text-rose-300",
    },
    warning: {
      icon: AlertTriangle,
      cls: "border-amber-500/30 bg-amber-500/15 text-amber-300",
    },
  };

  const { icon: Icon, cls } = configs[toast.type];

  return (
    <div
      className={`fixed bottom-6 right-6 z-[80] flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-[0_12px_40px_rgba(3,10,24,0.4)] backdrop-blur-md ${cls} animate-in slide-in-from-bottom-3 fade-in duration-300`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-sm font-medium">{toast.message}</span>
      <button
        onClick={onClose}
        className="ml-1 opacity-60 hover:opacity-100 transition"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── LogoSection ───────────────────────────────────────────────────────────────
// Handles both desktop (base64 FileReader) and web (R2 presign + upload).
// On web: uploads immediately on file pick so the user gets instant feedback
// and the URL is ready when they hit Save.

function LogoSection({
  isDesktop,
  logoPreviewUrl,
  logoUpload,
  onDesktopFilePick,
  onWebFilePick,
  onRemove,
}: {
  isDesktop: boolean;
  logoPreviewUrl: string | null;
  logoUpload: LogoUploadState;
  onDesktopFilePick: (file: File) => void;
  onWebFilePick: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-picked if needed
    e.target.value = "";
    if (isDesktop) {
      onDesktopFilePick(file);
    } else {
      onWebFilePick(file);
    }
  }

  const isUploading = logoUpload.status === "uploading";

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
      {/* Logo preview */}
      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-[0_1px_6px_rgba(0,0,0,0.08)] overflow-hidden">
        {isUploading ? (
          <div className="flex flex-col items-center justify-center gap-1">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
            <span className="text-[9px] text-slate-400">Uploading…</span>
          </div>
        ) : logoPreviewUrl ? (
          <>
            <img
              src={logoPreviewUrl}
              alt="Shop Logo"
              className="h-full w-full object-contain p-2"
            />
            <button
              type="button"
              onClick={onRemove}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700/80 text-slate-200 hover:bg-rose-500 hover:text-white transition"
              title="Remove logo"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <ImageIcon className="h-8 w-8 text-slate-300" />
        )}
      </div>

      {/* Upload zone */}
      <div className="flex-1">
        {logoUpload.status === "error" && (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-rose-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {logoUpload.message} — try again.
          </p>
        )}
        <label
          className={`group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-6 text-center shadow-[0_1px_4px_rgba(0,0,0,0.05)] transition
            ${
              isUploading
                ? "border-cyan-300 bg-cyan-50/40 cursor-not-allowed"
                : "border-slate-300 bg-white hover:border-cyan-400 hover:bg-cyan-50/60"
            }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="sr-only"
            disabled={isUploading}
            onChange={handleChange}
          />
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl border bg-slate-50 transition
              ${
                isUploading
                  ? "border-cyan-300 text-cyan-400"
                  : "border-slate-200 text-slate-400 group-hover:border-cyan-400/60 group-hover:text-cyan-500"
              }`}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </div>
          <div>
            <p
              className={`text-sm font-medium transition
                ${isUploading ? "text-cyan-600" : "text-slate-600 group-hover:text-cyan-600"}`}
            >
              {isUploading ? "Uploading to cloud…" : "Click to upload logo"}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {isDesktop
                ? "PNG, JPG, WEBP — stored locally. Shown on invoice header."
                : "PNG, JPG, WEBP — uploaded to cloud. Shown on invoice header."}
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ShopSettingsPanel({ onBack }: { onBack?: () => void }) {
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncInfo, setSyncInfo] = useState<SyncInfo>({});
  const [toast, setToast] = useState<ToastState>(null);
  const [logoUpload, setLogoUpload] = useState<LogoUploadState>({
    status: "idle",
  });

  const router = useRouter();
  const licenseId = useMemo(() => getActiveLicenseId(), []);
  const isDesktop = useMemo(() => isDesktopRuntime(), []);

  // Load settings on mount
  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      setLoading(true);
      try {
        const res = await platform.getShopSettings(licenseId);
        if (!cancelled && res?.success && res.settings) {
          const s = res.settings;
          setForm({
            shopName: s.shopName || "",
            // On desktop logoDataUrl is the base64; on web logoUrl is the R2 URL
            logoPreviewUrl: isDesktop
              ? s.logoDataUrl || null
              : s.logoUrl || null,
            logoUrl: s.logoUrl || null,
            addressLine1: s.addressLine1 || "",
            addressLine2: s.addressLine2 || "",
            city: s.city || "",
            state: s.state || "",
            pincode: s.pincode || "",
            mobile: s.mobile || "",
            email: s.email || "",
            gstin: s.gstin || "",
            footerNote: s.footerNote || "",
            authorizedSignatory:
              s.authorizedSignatory || "Authorized Signature",
          });
          setSyncInfo({
            syncStatus: s.syncStatus,
            lastSyncedAt: s.lastSyncedAt,
          });
        }
      } catch (err) {
        console.error("Failed to load shop settings", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadSettings();
    return () => {
      cancelled = true;
    };
  }, [licenseId, isDesktop]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Desktop logo: FileReader → base64 preview (no upload) ─────────────────

  function handleDesktopFilePick(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setField("logoPreviewUrl", String(reader.result || ""));
      // logoUrl stays null on desktop — we use logoDataUrl path
    };
    reader.readAsDataURL(file);
  }

  // ── Web logo: upload immediately to R2, store the public URL ──────────────

  async function handleWebFilePick(file: File) {
    const token = getActiveToken();
    if (!token) {
      setToast({
        type: "error",
        message: "Not authenticated. Please log in again.",
      });
      return;
    }

    // Show a local blob preview instantly while upload is in-flight
    const blobUrl = URL.createObjectURL(file);
    setField("logoPreviewUrl", blobUrl);
    setLogoUpload({ status: "uploading" });

    try {
      const { publicUrl } = await uploadProductImage(file, licenseId, token);

      // Commit the R2 URL into form state — this is what gets saved
      setField("logoUrl", publicUrl);
      setLogoUpload({ status: "done", url: publicUrl });

      // Revoke the temporary blob URL to free memory
      URL.revokeObjectURL(blobUrl);
      // Switch preview to the permanent R2 URL
      setField("logoPreviewUrl", publicUrl);
    } catch (err: any) {
      setLogoUpload({
        status: "error",
        message: err?.message || "Upload failed",
      });
      // Keep showing the local preview so the user can see what they picked
    }
  }

  function handleLogoRemove() {
    setField("logoPreviewUrl", null);
    setField("logoUrl", null);
    setLogoUpload({ status: "idle" });
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!licenseId) {
      setToast({
        type: "error",
        message: "Active license not found. Please log in again.",
      });
      return;
    }
    if (!form.shopName.trim()) {
      setToast({ type: "error", message: "Shop name is required." });
      return;
    }
    if (logoUpload.status === "uploading") {
      setToast({
        type: "warning",
        message: "Logo is still uploading. Please wait.",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = isDesktop
        ? {
            licenseId,
            shopName: form.shopName,
            // Desktop: pass base64 preview as logoDataUrl; logoUrl unused
            logoDataUrl: form.logoPreviewUrl,
            logoUrl: null,
            addressLine1: form.addressLine1,
            addressLine2: form.addressLine2,
            city: form.city,
            state: form.state,
            pincode: form.pincode,
            mobile: form.mobile,
            email: form.email,
            gstin: form.gstin,
            footerNote: form.footerNote,
            authorizedSignatory: form.authorizedSignatory,
          }
        : {
            licenseId,
            shopName: form.shopName,
            // Web: never pass base64; only the committed R2 URL
            logoDataUrl: null,
            logoUrl: form.logoUrl,
            addressLine1: form.addressLine1,
            addressLine2: form.addressLine2,
            city: form.city,
            state: form.state,
            pincode: form.pincode,
            mobile: form.mobile,
            email: form.email,
            gstin: form.gstin,
            footerNote: form.footerNote,
            authorizedSignatory: form.authorizedSignatory,
          };

      const res = await platform.saveShopSettings(payload);

      if (res?.success) {
        setSyncInfo({
          syncStatus: res.settings?.syncStatus,
          lastSyncedAt: res.settings?.lastSyncedAt,
          warning: res.warning,
        });
        setToast({
          type: res.warning ? "warning" : "success",
          message: res.warning || "Shop settings saved successfully.",
        });
        setLogoUpload({ status: "idle" });
      } else {
        setToast({
          type: "error",
          message: res?.error || "Failed to save shop settings.",
        });
      }
    } catch (err: any) {
      setToast({
        type: "error",
        message: String(err?.message || err || "Failed to save"),
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-[28px] border border-white/10 bg-kyn-surface h-32 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200/80 bg-white h-40 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const syncCfg = syncStatusConfig(syncInfo.syncStatus);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      <div className="space-y-4 pb-10 md:pb-4">
        {/* ── Hero Banner ── */}
        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#091120_0%,#0f1a31_58%,#16213d_100%)] px-5 py-5 text-white shadow-[0_22px_50px_rgba(5,10,20,0.18)] md:px-6 md:py-6">
          <div className="pointer-events-none absolute -left-10 top-0 h-32 w-32 rounded-full bg-orange-400/10 blur-3xl" />
          <div className="pointer-events-none absolute right-0 bottom-0 h-36 w-36 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-orange-400/25 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold text-orange-300">
                <Building2 className="h-3 w-3" />
                Business Identity
              </div>
              <h1 className="text-[26px] font-semibold tracking-[-0.04em] text-white md:text-[30px]">
                Shop <span className="kyn-brand-text">Settings</span>
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                Business profile, address, GST &amp; print details.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {onBack && (
                <button
                  onClick={onBack}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Master
                </button>
              )}
              <button
                onClick={() => router.push("/dashboard")}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_10px_24px_rgba(255,255,255,0.10)] transition hover:bg-slate-50 cursor-pointer"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </button>
            </div>
          </div>
        </section>

        {/* ── Business Identity ── */}
        <SectionCard
          icon={Building2}
          title="Business Identity"
          iconColor="text-orange-300"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Shop Name" required className="md:col-span-2">
              <input
                type="text"
                value={form.shopName}
                onChange={(e) => setField("shopName", e.target.value)}
                className={inputCls}
                placeholder="e.g. Kynstack Retail Store"
              />
            </Field>
            <Field label="GSTIN" className="md:col-span-1">
              <input
                type="text"
                value={form.gstin}
                onChange={(e) =>
                  setField("gstin", e.target.value.toUpperCase())
                }
                className={`${inputCls} font-mono tracking-wider`}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
              />
            </Field>
            <Field label="Authorized Signatory Label" className="md:col-span-1">
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={form.authorizedSignatory}
                  onChange={(e) =>
                    setField("authorizedSignatory", e.target.value)
                  }
                  className={`${inputCls} pl-9`}
                  placeholder="Authorized Signature"
                />
              </div>
            </Field>
          </div>
        </SectionCard>

        {/* ── Address ── */}
        <SectionCard icon={MapPin} title="Address" iconColor="text-cyan-300">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            <Field
              label="Address Line 1"
              className="sm:col-span-2 md:col-span-3"
            >
              <input
                type="text"
                value={form.addressLine1}
                onChange={(e) => setField("addressLine1", e.target.value)}
                className={inputCls}
                placeholder="Street / Building / Shop No."
              />
            </Field>
            <Field
              label="Address Line 2"
              className="sm:col-span-2 md:col-span-3"
            >
              <input
                type="text"
                value={form.addressLine2}
                onChange={(e) => setField("addressLine2", e.target.value)}
                className={inputCls}
                placeholder="Landmark / Area (optional)"
              />
            </Field>
            <Field label="City">
              <input
                type="text"
                value={form.city}
                onChange={(e) => setField("city", e.target.value)}
                className={inputCls}
                placeholder="City"
              />
            </Field>
            <Field label="State">
              <input
                type="text"
                value={form.state}
                onChange={(e) => setField("state", e.target.value)}
                className={inputCls}
                placeholder="State"
              />
            </Field>
            <Field label="Pincode">
              <input
                type="text"
                value={form.pincode}
                onChange={(e) => setField("pincode", e.target.value)}
                className={`${inputCls} font-mono`}
                placeholder="000000"
                maxLength={6}
              />
            </Field>
          </div>
        </SectionCard>

        {/* ── Contact ── */}
        <SectionCard icon={Phone} title="Contact" iconColor="text-emerald-300">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Mobile">
              <input
                type="tel"
                value={form.mobile}
                onChange={(e) => setField("mobile", e.target.value)}
                className={inputCls}
                placeholder="+91 00000 00000"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className={inputCls}
                placeholder="shop@example.com"
              />
            </Field>
          </div>
        </SectionCard>

        {/* ── Print & Invoice ── */}
        <SectionCard
          icon={Receipt}
          title="Print & Invoice"
          iconColor="text-purple-300"
        >
          <Field label="Invoice Footer / Terms">
            <textarea
              value={form.footerNote}
              onChange={(e) => setField("footerNote", e.target.value)}
              className={`${inputCls} min-h-[90px] resize-none`}
              placeholder="Thank you for your business! Goods once sold will not be returned."
            />
          </Field>
        </SectionCard>

        {/* ── Shop Logo ── */}
        <SectionCard
          icon={ImageIcon}
          title="Shop Logo"
          iconColor="text-fuchsia-300"
        >
          <LogoSection
            isDesktop={isDesktop}
            logoPreviewUrl={form.logoPreviewUrl}
            logoUpload={logoUpload}
            onDesktopFilePick={handleDesktopFilePick}
            onWebFilePick={handleWebFilePick}
            onRemove={handleLogoRemove}
          />
        </SectionCard>

        {/* ── Save Bar ── */}
        <div className="sticky bottom-0 z-10 -mx-1">
          <div className="rounded-2xl border border-slate-700/60 bg-kyn-surface/90 px-5 py-4 shadow-[0_-8px_32px_rgba(3,10,24,0.4)] backdrop-blur-md">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-[12px] text-slate-400">
                <span className={`h-1.5 w-1.5 rounded-full ${syncCfg.dot}`} />
                {syncInfo.warning ? (
                  <span className="text-amber-400">{syncInfo.warning}</span>
                ) : (
                  <span>{syncCfg.label}</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || logoUpload.status === "uploading"}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#20b7ff] to-[#b026ff] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(32,183,255,0.25)] transition hover:shadow-[0_6px_28px_rgba(32,183,255,0.38)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving…
                  </>
                ) : logoUpload.status === "uploading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading logo…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
