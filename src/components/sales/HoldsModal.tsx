// src/components/sales/HoldsModal.tsx
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
      const res = await (window as any).electronAPI.listSaleHolds(licenseId, {
        page: 1,
        pageSize: 200,
      });
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
    await (window as any).electronAPI.deleteSaleHold(id);
    refresh();
  }

  function openRename(id: string, currentTitle?: string | null) {
    setRenameId(id);
    setRenameDefault(currentTitle || "");
  }

  async function confirmRename(newTitle: string) {
    if (!renameId) return;
    await (window as any).electronAPI.saveSaleHold({
      id: renameId,
      title: newTitle || null,
    });
    setRenameId(null);
    refresh();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-averix-red-vivid/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-averix-red-vivid" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Sales Holds
                </h3>
                <p className="text-sm text-gray-600">
                  Manage your saved sales states
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-500">
                <div className="w-5 h-5 border-2 border-averix-red-vivid/20 border-t-averix-red-vivid rounded-full animate-spin"></div>
                <span className="text-sm font-medium">Loading holds...</span>
              </div>
            </div>
          ) : holds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-gray-400" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                No holds yet
              </h4>
              <p className="text-sm text-gray-500 max-w-sm">
                Create holds to save your sales progress and resume later
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto no-scrollbar">
              {holds.map((h, index) => (
                <div
                  key={h.id}
                  className="group border border-gray-200 rounded-xl p-4 hover:border-averix-red-vivid/20 hover:shadow-md transition-all duration-200 bg-white hover:bg-gray-50/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-averix-red-vivid to-averix-red-accent text-white flex items-center justify-center text-sm font-semibold">
                        #{h.holdNo}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold text-gray-900 truncate">
                            Hold #{h.holdNo}
                          </h4>
                          {h.title && (
                            <span className="text-sm text-gray-600 truncate">
                              • {h.title}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Updated{" "}
                          {new Date(
                            h.updatedAt || h.createdAt || ""
                          ).toLocaleDateString()}{" "}
                          at{" "}
                          {new Date(
                            h.updatedAt || h.createdAt || ""
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={() => onResume(h.id)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-medium transition-colors"
                        title="Resume this hold"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Resume
                      </button>
                      <button
                        onClick={() => openRename(h.id, h.title)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-medium transition-colors"
                        title="Rename this hold"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Rename
                      </button>
                      <button
                        onClick={() => handleDelete(h.id)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 text-xs font-medium transition-colors"
                        title="Delete this hold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <p className="text-xs text-gray-500">
            {holds.length > 0 &&
              `${holds.length} hold${holds.length === 1 ? "" : "s"} found`}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-white hover:border-gray-300 transition-colors"
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
