// src/components/purchase/PurchaseItemForm.tsx
import FormField from "./FormField";

function PurchaseItemForm({ products, item, setItem, onSelect }: any) {
  return (
    <div className="bg-white p-4 rounded-xl shadow space-y-4">
      <div>
        <label className="text-sm text-gray-600">Product</label>
        <select
          value={item.productId}
          onChange={(e) => onSelect(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="">Select Product</option>
          {products.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.code} - {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FormField
          label="Quantity"
          value={item.quantity}
          onChange={(v: any) => setItem({ ...item, quantity: v })}
        />
        <FormField
          label="Rate"
          value={item.rate}
          onChange={(v: any) => setItem({ ...item, rate: v })}
        />
        <FormField
          label="Profit %"
          value={item.profitPercent}
          onChange={(v: any) => setItem({ ...item, profitPercent: v })}
        />
        <FormField
          label="Discount"
          value={item.discount}
          onChange={(v: any) => setItem({ ...item, discount: v })}
        />
      </div>

      <div className="flex justify-between text-sm text-gray-700">
        <span>Sale Price: {item.salePrice?.toFixed(2)}</span>
        <span>Profit: {item.profit?.toFixed(2)}</span>
        <span>Billed Value: {item.billedValue?.toFixed(2)}</span>
      </div>
    </div>
  );
}

export default PurchaseItemForm;
