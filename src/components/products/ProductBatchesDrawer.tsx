// src/components/products/ProductBatchesDrawer.tsx
"use client";
import { useEffect, useState } from "react";

type Batch = {
  id: string;
  barcode?: string | null;
  mrp?: number | null;
  salePrice?: number | null;
  costPrice?: number | null;
  batchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  receivedAt?: string | null;
  stock: number;
  deletedAt?: string | null;
};

// Type-safe API cast
function getApi() {
  return (window as any).electronAPI as {
    listBatchesForProduct: (
      productId: string,
      includeDeleted?: boolean,
    ) => Promise<{ success: boolean; rows: Batch[]; totalStock: number }>;
    saveBatch: (payload: {
      licenseId: string;
      productId: string;
      barcode?: string | null;
      mrp?: number | null;
      salePrice?: number | null;
      costPrice?: number | null;
      batchNo?: string | null;
      mfgDate?: string | null;
      expiryDate?: string | null;
      receivedAt?: string;
      deltaQty?: number;
    }) => Promise<{ success: boolean; batch: Batch }>;
    deleteBatch: (
      batchId: string,
    ) => Promise<{ success: boolean; deletedAt: string }>;
    rebuildProductStock: (
      productId: string,
    ) => Promise<{ success: boolean; stock: number }>;
  };
}

export default function ProductBatchesDrawer({
  open,
  onClose,
  productId,
  licenseId,
  productName,
}: {
  open: boolean;
  onClose: () => void;
  productId: string | null;
  licenseId: string;
  productName?: string;
}) {
  const [rows, setRows] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    if (!productId) return;
    const api = getApi();
    const res = await api.listBatchesForProduct(productId, false);
    if (res?.success) {
      setRows(res.rows);
      setTotal(res.totalStock ?? 0);
    }
  }

  useEffect(() => {
    if (open && productId) refresh();
  }, [open, productId]);

  async function addOrAdjust(form: FormData) {
    if (!productId) return;
    const api = getApi();
    setSaving(true);
    try {
      const payload = {
        licenseId,
        productId,
        barcode: form.get("barcode")?.toString() || null,
        mrp: form.get("mrp") ? Number(form.get("mrp")) : null,
        salePrice: form.get("salePrice") ? Number(form.get("salePrice")) : null,
        costPrice: form.get("costPrice") ? Number(form.get("costPrice")) : null,
        batchNo: form.get("batchNo")?.toString() || null,
        mfgDate: form.get("mfgDate")?.toString() || null,
        expiryDate: form.get("expiryDate")?.toString() || null,
        receivedAt: form.get("receivedAt")?.toString() || undefined,
        deltaQty: form.get("deltaQty") ? Number(form.get("deltaQty")) : 0,
      };
      await api.saveBatch(payload);

      await api.rebuildProductStock(productId);

      await refresh();
      (document.getElementById("batch-form") as HTMLFormElement)?.reset();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this batch? Stock will be removed from totals."))
      return;
    const api = getApi();
    await api.deleteBatch(id);

    if (productId) await api.rebuildProductStock(productId);

    await refresh();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Product Batches
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {productName || productId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Close"
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
          {/* Total Stock Card */}
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-averix-red-vivid to-averix-red-dark text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total Stock</p>
                <p className="text-3xl font-bold mt-1">{total}</p>
              </div>
              <div className="bg-white/20 rounded-full p-3">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Add/Adjust Form */}
          <form
            id="batch-form"
            className="mb-6 border-2 border-gray-200 rounded-xl p-5 bg-gray-50"
            onSubmit={(e) => {
              e.preventDefault();
              addOrAdjust(new FormData(e.currentTarget));
            }}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add / Adjust Batch
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Batch Barcode
                </label>
                <input
                  name="barcode"
                  placeholder="Enter barcode"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-averix-red-vivid focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Batch Number
                </label>
                <input
                  name="batchNo"
                  placeholder="Enter batch no."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-averix-red-vivid focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  MRP (₹)
                </label>
                <input
                  name="mrp"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-averix-red-vivid focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Sale Price (₹)
                </label>
                <input
                  name="salePrice"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-averix-red-vivid focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Cost Price (₹)
                </label>
                <input
                  name="costPrice"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-averix-red-vivid focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Manufacturing Date
                </label>
                <input
                  name="mfgDate"
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-averix-red-vivid focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Expiry Date
                </label>
                <input
                  name="expiryDate"
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-averix-red-vivid focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Received At
                </label>
                <input
                  name="receivedAt"
                  type="datetime-local"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-averix-red-vivid focus:border-transparent outline-none transition-all"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Quantity Change{" "}
                  <span className="text-gray-500">(+ to add, - to reduce)</span>
                </label>
                <input
                  name="deltaQty"
                  type="number"
                  step="1"
                  placeholder="e.g., +100 or -50"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-averix-red-vivid focus:border-transparent outline-none transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-5 w-full bg-gradient-to-r from-averix-red-vivid to-averix-red-dark text-white rounded-lg px-6 py-3 font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                "Save Batch"
              )}
            </button>
          </form>

          {/* Batches List */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Existing Batches
            </h3>

            {rows.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <svg
                  className="w-16 h-16 mx-auto text-gray-400 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p className="text-gray-600 font-medium">No batches found</p>
                <p className="text-sm text-gray-500 mt-1">
                  Add your first batch using the form above
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow bg-white"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-gray-900">
                            {r.batchNo || "No Batch #"}
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                            {r.barcode || "No barcode"}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
                          <div>
                            <span className="text-gray-500">MRP:</span>{" "}
                            <span className="font-medium text-gray-900">
                              ₹{r.mrp ?? "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Sale:</span>{" "}
                            <span className="font-medium text-gray-900">
                              ₹{r.salePrice ?? "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Cost:</span>{" "}
                            <span className="font-medium text-gray-900">
                              ₹{r.costPrice ?? "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Mfg:</span>{" "}
                            <span className="font-medium text-gray-900">
                              {r.mfgDate || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Exp:</span>{" "}
                            <span className="font-medium text-gray-900">
                              {r.expiryDate || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Received:</span>{" "}
                            <span className="font-medium text-gray-900">
                              {r.receivedAt
                                ? new Date(r.receivedAt).toLocaleDateString()
                                : "—"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-center px-4 py-2 bg-averix-red-vivid/10 rounded-lg">
                          <div className="text-xs text-gray-600">Stock</div>
                          <div className="text-xl font-bold text-averix-red-dark">
                            {r.stock}
                          </div>
                        </div>
                        <button
                          onClick={() => onDelete(r.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete batch"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
