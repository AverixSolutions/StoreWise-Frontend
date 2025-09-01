// src/components/purchase/PurchaseHeader.tsx
function PurchaseHeader({ header, setHeader }: any) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl shadow">
      <div>
        <label className="text-sm text-gray-600">Bill No</label>
        <input
          type="text"
          value={header.billNo}
          onChange={(e) => setHeader({ ...header, billNo: e.target.value })}
          className="border p-2 rounded w-full"
        />
      </div>
      <div>
        <label className="text-sm text-gray-600">Supplier</label>
        <input
          type="text"
          value={header.supplierName}
          onChange={(e) =>
            setHeader({ ...header, supplierName: e.target.value })
          }
          className="border p-2 rounded w-full"
        />
      </div>
      <div>
        <label className="text-sm text-gray-600">Department</label>
        <input
          type="text"
          value={header.department}
          onChange={(e) => setHeader({ ...header, department: e.target.value })}
          className="border p-2 rounded w-full"
        />
      </div>
    </div>
  );
}

export default PurchaseHeader;
