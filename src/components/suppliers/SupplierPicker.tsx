// src/components/suppliers/SupplierPicker.tsx
"use client";
import { useEffect, useState } from "react";
import SupplierFormModal from "./SupplierFormModal";
import { platform } from "@/platform";

export default function SupplierPicker({
  value,
  onChange,
}: {
  value?: { id: string; name: string } | null;
  onChange: (v: { id: string; name: string } | null) => void;
}) {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState<Array<{ id: string; name: string }>>([]);
  const [openModal, setOpenModal] = useState(false);

  useEffect(() => {
    const licenseId = localStorage.getItem("licenseId") || "demo-license";
    (async () => {
      const res = await platform.listSuppliers?.(licenseId, {
        q,
        page: 1,
        pageSize: 20,
      });
      const suppliers = res?.suppliers ?? [];
      setOpts(suppliers.map((s: any) => ({ id: s.id, name: s.name })));
    })();
  }, [q, openModal]);

  return (
    <div className="flex gap-2">
      {/* Search input + dropdown */}
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search supplier..."
          className="w-64 px-3 py-2 text-sm rounded-md outline-none transition-all duration-150"
          style={{
            background: "var(--kyn-surface-3)",
            border: "1px solid var(--kyn-border)",
            color: "var(--kyn-text)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--kyn-primary)";
            e.currentTarget.style.boxShadow =
              "0 0 0 1px var(--kyn-glow-primary)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--kyn-border)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />

        {/* Results dropdown */}
        {q && (
          <div
            className="absolute z-20 mt-1 w-full rounded-md overflow-hidden overflow-y-auto max-h-56"
            style={{
              background: "var(--kyn-surface-2)",
              border: "1px solid var(--kyn-border)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px var(--kyn-glow-primary)",
            }}
          >
            {opts.length === 0 ? (
              <div
                className="px-3 py-2 text-sm"
                style={{ color: "var(--kyn-text-muted)" }}
              >
                No results
              </div>
            ) : (
              opts.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o);
                    setQ(o.name);
                  }}
                  className="block w-full text-left px-3 py-2 text-sm transition-colors duration-100"
                  style={{ color: "var(--kyn-text-soft)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--kyn-surface-3)";
                    e.currentTarget.style.color = "var(--kyn-text)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--kyn-text-soft)";
                  }}
                >
                  {o.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* + New button */}
      <button
        type="button"
        onClick={() => setOpenModal(true)}
        className="px-3 py-2 text-sm font-medium rounded-md transition-all duration-150"
        style={{
          background:
            "linear-gradient(135deg, var(--kyn-primary), var(--kyn-secondary))",
          color: "var(--kyn-white)",
          boxShadow: "0 0 12px var(--kyn-glow-primary)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow =
            "0 0 20px var(--kyn-glow-primary), 0 0 8px var(--kyn-glow-secondary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "0 0 12px var(--kyn-glow-primary)";
        }}
      >
        + New
      </button>

      {openModal && (
        <SupplierFormModal
          isOpen={openModal}
          onClose={() => setOpenModal(false)}
          onSuccess={async () => {
            const licenseId =
              localStorage.getItem("licenseId") || "demo-license";
            const res = await platform.listSuppliers?.(licenseId, {
              q: "",
              page: 1,
              pageSize: 50,
            });
            setOpts(
              (res?.suppliers ?? []).map((s: any) => ({
                id: s.id,
                name: s.name,
              })),
            );
          }}
        />
      )}
    </div>
  );
}
