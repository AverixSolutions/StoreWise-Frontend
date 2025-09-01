function FormField({ label, value, onChange }: any) {
  return (
    <div>
      <label className="text-sm text-gray-600">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="border p-2 rounded w-full"
      />
    </div>
  );
}

export default FormField;
