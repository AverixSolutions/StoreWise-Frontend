function PurchaseSummary({ subtotal, discount, finalTotal }: any) {
  return (
    <div className="bg-gray-100 p-4 rounded-xl shadow flex justify-between font-medium">
      <span>Subtotal: {subtotal.toFixed(2)}</span>
      <span>Discount: {discount}</span>
      <span>Final Total: {finalTotal.toFixed(2)}</span>
    </div>
  );
}

export default PurchaseSummary;
