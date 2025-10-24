// src/app/payment/page.tsx
"use client";

import { useState } from "react";
import {
  CalendarClock,
  UserRound,
  IndianRupee,
  FileText,
  Landmark,
  Building2,
  CheckSquare,
  Printer,
  Save,
  PlusSquare,
  FileSignature,
} from "lucide-react";

export default function PaymentPage() {
  const [payDate, setPayDate] = useState<string>(() =>
    new Date().toISOString()
  );
  const [amount, setAmount] = useState<number>(0);

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col">
      {/* Header bar */}
      <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-averix-red-dark" />
          <h1 className="text-base font-semibold text-gray-900">Payment</h1>
        </div>

        <button
          className="px-3 h-8 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-sm hover:bg-amber-100"
          title="Discount"
        >
          Discount
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 grid grid-rows-[auto_1fr_auto]">
        {/* Top form */}
        <section className="bg-white">
          <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-4 p-4">
            {/* Left compact form card */}
            <div className="border border-gray-200 rounded-md p-3 space-y-2">
              {/* Pay No & Date */}
              <Row>
                <Label>Pay No &amp; Date</Label>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    className={inputBase + " text-xs"}
                    placeholder="—"
                    readOnly
                  />
                  <div className="relative">
                    <div className="absolute inset-y-0 left-2 flex items-center text-gray-500 pointer-events-none">
                      <CalendarClock className="w-4 h-4" />
                    </div>
                    <input
                      type="datetime-local"
                      value={new Date(payDate).toISOString().slice(0, 16)}
                      onChange={(e) =>
                        setPayDate(new Date(e.target.value).toISOString())
                      }
                      className={inputBase + " pl-8 text-xs w-[165px]"}
                    />
                  </div>
                </div>
              </Row>

              {/* Supplier */}
              <Row>
                <Label>
                  <UserRound className="w-3.5 h-3.5" />
                  Supplier
                </Label>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input className={inputBase} placeholder="Select supplier…" />
                  <button
                    className="px-3 rounded-md bg-averix-red-dark text-white hover:bg-averix-red-accent"
                    title="Browse"
                  >
                    …
                  </button>
                </div>
              </Row>

              {/* Amount */}
              <Row>
                <Label>
                  <IndianRupee className="w-3.5 h-3.5" />
                  Amount
                </Label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount || ""}
                  onChange={(e) => setAmount(Number(e.target.value || 0))}
                  className={inputBase}
                  placeholder="0.00"
                />
              </Row>

              {/* Narration */}
              <Row>
                <Label>
                  <FileText className="w-3.5 h-3.5" />
                  Narration
                </Label>
                <input className={inputBase} placeholder="Optional note" />
              </Row>

              {/* Credit to */}
              <Row>
                <Label>Credit to</Label>
                <select className={inputBase}>
                  <option>CASH ON HAND</option>
                  <option>BANK – CURRENT</option>
                </select>
              </Row>

              {/* Manual Entry No */}
              <Row>
                <Label>Manual Entry No</Label>
                <input className={inputBase} placeholder="—" />
              </Row>

              {/* Cheque / DD details in a 2-col grid */}
              <div className="grid grid-cols-2 gap-2">
                <Row>
                  <Label>DD Cheque No, Dt.</Label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input className={inputBase} placeholder="Cheque No" />
                    <input type="date" className={inputBase + " w-[140px]"} />
                  </div>
                </Row>
                <Row>
                  <Label>Clearing Details</Label>
                  <select className={inputBase}>
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </Row>
              </div>

              {/* Department / Division */}
              <div className="grid grid-cols-2 gap-2">
                <Row>
                  <Label>
                    <Building2 className="w-3.5 h-3.5" />
                    Department/Division
                  </Label>
                  <input className={inputBase} defaultValue="MAIN" />
                </Row>
                <Row>
                  <Label>
                    <Landmark className="w-3.5 h-3.5" />
                    Account
                  </Label>
                  <input className={inputBase} placeholder="—" />
                </Row>
              </div>

              {/* Remarks */}
              <Row>
                <Label>Remarks</Label>
                <input className={inputBase} placeholder="—" />
              </Row>

              {/* Timestamp */}
              <div className="text-xs text-gray-500 pt-1">
                {new Date().toLocaleString()}
              </div>
            </div>

            {/* Right side blank panel to match screenshot */}
            <div className="border border-dashed border-gray-200 rounded-md bg-white"></div>
          </div>
        </section>

        {/* Bills Payable Tabs + Table */}
        <section className="px-4">
          <div className="bg-white border border-gray-200 rounded-md">
            {/* Faux tabs */}
            <div className="flex items-center gap-4 px-3 py-2 border-b text-sm">
              <button className="px-2 py-1 rounded-md bg-averix-red-dark text-white">
                Bills Payable
              </button>
              <button className="px-2 py-1 rounded-md hover:bg-gray-100">
                Account Details
              </button>
              <button className="px-2 py-1 rounded-md hover:bg-gray-100">
                Claims
              </button>
              <button className="ml-auto px-2 py-1 rounded-md text-emerald-700 bg-emerald-50 border border-emerald-200">
                QuickSet
              </button>
            </div>

            {/* Table */}
            <div className="overflow-auto no-scrollbar">
              <table className="min-w-[1200px] w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-600 uppercase">
                    {[
                      "Sl",
                      "Entry No",
                      "Bill No",
                      "Bill Total",
                      "Paid",
                      "Balance",
                      "PDC",
                      "Balance-PDC",
                      "Payment",
                      "Blnc-After",
                      "Verified",
                      "Date",
                      "Days",
                      "Priority",
                      "Narration",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Empty mock row */}
                  <tr>
                    {new Array(15).fill(0).map((_, i) => (
                      <td key={i} className="px-3 py-3 text-gray-400">
                        —
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Totals bar */}
            <div className="flex items-center justify-end gap-6 px-4 py-3 border-t text-sm">
              <Total label="0.00" />
              <Total label="0.00" />
              <Total label="0.00" />
              <Total label="0.00" />
              <Total label="0.00" highlight />
              <Total label="0.00" highlight />
              <div className="w-16" />
            </div>
          </div>

          {/* Payment details subheading */}
          <div className="mt-4 text-averix-red-dark font-semibold">
            Payment Details
          </div>
        </section>

        {/* Footer actions */}
        <section className="px-4 py-3 bg-white border-t flex items-center gap-3">
          <button className="px-4 h-9 rounded-md border bg-white hover:bg-gray-50 inline-flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Cheque Print
          </button>

          <div className="ml-auto flex items-center gap-3">
            <button className="px-4 h-9 rounded-md border bg-white hover:bg-gray-50 inline-flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              Modify
            </button>
            <button
              disabled
              className="px-4 h-9 rounded-md border bg-white text-gray-400 inline-flex items-center gap-2 cursor-not-allowed"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button className="px-4 h-9 rounded-md border bg-white hover:bg-gray-50 inline-flex items-center gap-2">
              <PlusSquare className="w-4 h-4" />
              New
            </button>
            <button className="px-4 h-9 rounded-md bg-averix-red-dark text-white hover:bg-averix-red-accent inline-flex items-center gap-2">
              <Save className="w-4 h-4" />
              Save
            </button>
            <button className="px-4 h-9 rounded-md border bg-white hover:bg-gray-50">
              Close
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------- tiny helpers & styles ---------- */

const inputBase =
  "h-8 px-2 rounded-md border border-gray-300 bg-white outline-none focus:border-averix-red-dark focus:ring-2 focus:ring-averix-red-light/30 transition";

function Row({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1">{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs text-gray-600 font-medium mb-0.5 flex items-center gap-1">
      {children}
    </div>
  );
}

function Total({
  label,
  highlight = false,
}: {
  label: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "min-w-[72px] text-center px-2 py-1 rounded " +
        (highlight ? "bg-yellow-200 font-semibold" : "bg-gray-100")
      }
    >
      {label}
    </div>
  );
}
