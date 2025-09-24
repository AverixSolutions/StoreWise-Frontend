// src/components/suppliers/SupplierPicker.tsx
"use client";
import { useEffect, useState } from "react";
import SupplierFormModal from "./SupplierFormModal";

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
    const licenseId = localStorage.getItem("licenseId")!;
    (async () => {
      const { suppliers } = await (window as any).electronAPI.listSuppliers(
        licenseId,
        { q, page: 1, pageSize: 20 }
      );
      setOpts(suppliers.map((s: any) => ({ id: s.id, name: s.name })));
    })();
  }, [q, openModal]);

  return (
    <div className="flex gap-2">
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search supplier..."
          className="border rounded-lg px-3 py-2 w-64"
        />
        {q && (
          <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow max-h-56 overflow-y-auto">
            {opts.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No results</div>
            ) : (
              opts.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o);
                    setQ(o.name);
                  }}
                  className="block w-full text-left px-3 py-2 hover:bg-gray-100"
                >
                  {o.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpenModal(true)}
        className="px-3 py-2 rounded-lg bg-averix-red-dark text-white"
      >
        + New
      </button>

      {openModal && (
        <SupplierFormModal
          isOpen={openModal}
          onClose={() => setOpenModal(false)}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
