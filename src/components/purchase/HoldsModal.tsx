// src/components/purchase/HoldsModal.tsx
"use client";
import { useEffect, useState } from "react";
import { X, Play, Trash2, Edit3, Clock } from "lucide-react";
import PromptModal from "@/components/ui/PromptModal";

interface HoldSummary {
  id: string;
  holdNo: number;
  title?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface HoldsModalProps {
  isOpen: boolean;
  onClose: () => void;
  licenseId: string;
  onResume: (holdId: string) => void;
}

export default function HoldsModal({
  isOpen,
  onClose,
  licenseId,
  onResume,
}: HoldsModalProps) {
  const [holds, setHolds] = useState<HoldSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDefault, setRenameDefault] = useState<string>("");

  async function refresh() {
    setLoading(true);
    try {
      const res = await (window as any).electronAPI.listPurchaseHolds(
        licenseId,
        { page: 1, pageSize: 200 },
      );
      setHolds(res.holds || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen]);

  async function handleDelete(id: string) {
    const ok = confirm("Delete this hold?");
    if (!ok) return;
    await (window as any).electronAPI.deletePurchaseHold(id);
    refresh();
  }

  function openRename(id: string, currentTitle?: string | null) {
    setRenameId(id);
    setRenameDefault(currentTitle || "");
  }

  async function confirmRename(newTitle: string) {
    if (!renameId) return;
    await (window as any).electronAPI.savePurchaseHold({
      id: renameId,
      title: newTitle || null,
    });
    setRenameId(null);
    refresh();
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: "rgba(4,8,20,0.72)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl"
        style={{
          background: "#fff",
          border: "1px solid rgba(93,135,201,0.22)",
          boxShadow:
            "0 0 0 1px rgba(32,183,255,0.08), 0 32px 64px rgba(4,8,20,0.5), 0 8px 24px rgba(32,183,255,0.1)",
        }}
      >
        {/* ── Dark header bar ── */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{
            background: "linear-gradient(135deg, #0e172a 0%, #13203a 100%)",
            borderBottom: "1px solid rgba(93,135,201,0.18)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(32,183,255,0.18), rgba(176,38,255,0.14))",
                border: "1px solid rgba(93,135,201,0.28)",
              }}
            >
              <Clock className="w-4 h-4" style={{ color: "#20b7ff" }} />
            </div>
            <div>
              <div
                className="text-sm font-semibold tracking-wide"
                style={{ color: "#f8fafc" }}
              >
                Purchase Holds
              </div>
              <div className="text-xs" style={{ color: "#8ea3c7" }}>
                Manage your saved purchase states
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "#8ea3c7" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.08)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Content ── */}
        <div
          className="flex-1 overflow-hidden px-6 py-5"
          style={{ minHeight: 0 }}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg
                className="animate-spin w-7 h-7"
                viewBox="0 0 24 24"
                style={{ color: "#20b7ff" }}
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              <span className="text-sm" style={{ color: "#8ea3c7" }}>
                Loading holds…
              </span>
            </div>
          ) : holds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1"
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e8edf5",
                }}
              >
                <Clock className="w-7 h-7" style={{ color: "#8ea3c7" }} />
              </div>
              <span
                className="text-sm font-medium"
                style={{ color: "#1e2d4a" }}
              >
                No holds yet
              </span>
              <span
                className="text-xs text-center max-w-xs"
                style={{ color: "#8ea3c7" }}
              >
                Create holds to save your purchase progress and resume later
              </span>
            </div>
          ) : (
            <div className="space-y-2.5 overflow-y-auto max-h-[52vh] no-scrollbar">
              {holds.map((h) => (
                <div
                  key={h.id}
                  className="group flex items-center justify-between rounded-xl px-4 py-3 transition-all"
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e8edf5",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(32,183,255,0.04)";
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "rgba(32,183,255,0.22)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "#f8fafc";
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "#e8edf5";
                  }}
                >
                  {/* Left — number badge + info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold font-mono shrink-0"
                      style={{
                        background:
                          "linear-gradient(135deg, #0e172a 0%, #182745 100%)",
                        color: "#20b7ff",
                        border: "1px solid rgba(32,183,255,0.22)",
                      }}
                    >
                      #{h.holdNo}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: "#1e2d4a" }}
                        >
                          Hold #{h.holdNo}
                        </span>
                        {h.title && (
                          <span
                            className="text-xs truncate"
                            style={{ color: "#8ea3c7" }}
                          >
                            · {h.title}
                          </span>
                        )}
                      </div>
                      <p
                        className="text-xs flex items-center gap-1"
                        style={{ color: "#8ea3c7" }}
                      >
                        <Clock className="w-3 h-3 shrink-0" />
                        {new Date(
                          h.updatedAt || h.createdAt || "",
                        ).toLocaleDateString()}{" "}
                        at{" "}
                        {new Date(
                          h.updatedAt || h.createdAt || "",
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Right — action buttons (always visible) */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    {/* Resume */}
                    <button
                      onClick={() => onResume(h.id)}
                      className="h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-all"
                      style={{
                        background: "rgba(34,197,94,0.08)",
                        color: "#15803d",
                        border: "1px solid rgba(34,197,94,0.22)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(34,197,94,0.15)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(34,197,94,0.08)")
                      }
                      title="Resume this hold"
                    >
                      <Play className="w-3 h-3" /> Resume
                    </button>

                    {/* Rename */}
                    <button
                      onClick={() => openRename(h.id, h.title)}
                      className="h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-all"
                      style={{
                        background: "rgba(32,183,255,0.08)",
                        color: "#0369a1",
                        border: "1px solid rgba(32,183,255,0.22)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(32,183,255,0.15)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(32,183,255,0.08)")
                      }
                      title="Rename this hold"
                    >
                      <Edit3 className="w-3 h-3" /> Rename
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(h.id)}
                      className="h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-all"
                      style={{
                        background: "rgba(239,68,68,0.06)",
                        color: "#dc2626",
                        border: "1px solid rgba(239,68,68,0.2)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(239,68,68,0.12)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(239,68,68,0.06)")
                      }
                      title="Delete this hold"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Dark footer bar ── */}
        <div
          className="px-6 py-3 shrink-0 flex items-center justify-between"
          style={{
            background: "linear-gradient(135deg, #0e172a 0%, #13203a 100%)",
            borderTop: "1px solid rgba(93,135,201,0.18)",
          }}
        >
          <span className="text-xs" style={{ color: "#8ea3c7" }}>
            {holds.length > 0
              ? `${holds.length} hold${holds.length === 1 ? "" : "s"}`
              : ""}
          </span>
          <button
            onClick={onClose}
            className="h-7 px-3 rounded-md text-xs font-medium transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(93,135,201,0.28)",
              color: "#dbe7ff",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.06)")
            }
          >
            Close
          </button>
        </div>
      </div>

      {/* Rename modal */}
      <PromptModal
        isOpen={Boolean(renameId)}
        title="Rename Hold"
        label="Title"
        placeholder="Optional title for this hold"
        defaultValue={renameDefault}
        confirmText="Save"
        onCancel={() => setRenameId(null)}
        onConfirm={(val) => confirmRename(val.trim())}
      />
    </div>
  );
}
