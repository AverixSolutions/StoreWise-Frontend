// // src/components/DebugPanel.tsx - Fixed TypeScript error
// import React, { useState, useEffect } from "react";
// import { debugSupplierSync } from "@/sync/suppliersSync";

// export function DebugPanel() {
//   const [syncInfo, setSyncInfo] = useState<any>({});
//   const [isVisible, setIsVisible] = useState(false);

//   const runFullDebug = async () => {
//     const licenseId = localStorage.getItem("licenseId");
//     if (!licenseId) return;

//     try {
//       // Get sync state
//       const syncState = await (window as any).electronAPI.getSyncState(
//         "suppliers"
//       );

//       // Get dirty suppliers
//       const dirtySuppliers = await (
//         window as any
//       ).electronAPI.getDirtySuppliers(licenseId, 10);

//       // Get total count
//       const totalCount = await (window as any).electronAPI.getSupplierCount(
//         licenseId
//       );

//       // Get some suppliers to verify data
//       const supplierList = await (window as any).electronAPI.listSuppliers(
//         licenseId,
//         { page: 1, pageSize: 5 }
//       );

//       setSyncInfo({
//         syncState,
//         dirtyCount: dirtySuppliers.length,
//         dirtySuppliers: dirtySuppliers.slice(0, 3), // Show first 3
//         totalCount,
//         sampleSuppliers: supplierList.suppliers.slice(0, 2),
//       });
//     } catch (error) {
//       console.error("Debug failed:", error);
//       // Fixed: Proper error handling with type checking
//       setSyncInfo({
//         error:
//           error instanceof Error ? error.message : "Unknown error occurred",
//       });
//     }
//   };

//   if (!isVisible) {
//     return (
//       <button
//         onClick={() => setIsVisible(true)}
//         style={{
//           position: "fixed",
//           bottom: 20,
//           right: 20,
//           zIndex: 9999,
//           padding: "10px",
//           backgroundColor: "#28a745",
//           color: "white",
//           border: "none",
//           borderRadius: "4px",
//         }}
//       >
//         Debug Sync
//       </button>
//     );
//   }

//   return (
//     <div
//       style={{
//         position: "fixed",
//         bottom: 20,
//         right: 20,
//         width: "400px",
//         maxHeight: "500px",
//         backgroundColor: "white",
//         border: "1px solid #ccc",
//         borderRadius: "8px",
//         padding: "15px",
//         zIndex: 9999,
//         overflow: "auto",
//         fontSize: "12px",
//       }}
//     >
//       <div
//         style={{
//           display: "flex",
//           justifyContent: "space-between",
//           marginBottom: "10px",
//         }}
//       >
//         <h3>Supplier Sync Debug</h3>
//         <button onClick={() => setIsVisible(false)}>×</button>
//       </div>

//       <button
//         onClick={runFullDebug}
//         style={{ marginBottom: "10px", padding: "5px 10px" }}
//       >
//         Run Debug
//       </button>

//       <button
//         onClick={debugSupplierSync}
//         style={{ marginBottom: "10px", marginLeft: "5px", padding: "5px 10px" }}
//       >
//         Console Log
//       </button>

//       {syncInfo.error && (
//         <div style={{ color: "red", marginBottom: "10px" }}>
//           Error: {syncInfo.error}
//         </div>
//       )}

//       {syncInfo.syncState && (
//         <div style={{ marginBottom: "10px" }}>
//           <strong>Sync State:</strong>
//           <pre
//             style={{
//               backgroundColor: "#f5f5f5",
//               padding: "5px",
//               fontSize: "10px",
//             }}
//           >
//             {JSON.stringify(syncInfo.syncState, null, 2)}
//           </pre>
//         </div>
//       )}

//       {syncInfo.totalCount !== undefined && (
//         <div style={{ marginBottom: "10px" }}>
//           <strong>Total Suppliers:</strong> {syncInfo.totalCount.count || 0}
//         </div>
//       )}

//       {syncInfo.dirtyCount !== undefined && (
//         <div style={{ marginBottom: "10px" }}>
//           <strong>Dirty Suppliers:</strong> {syncInfo.dirtyCount}
//           {syncInfo.dirtySuppliers && syncInfo.dirtySuppliers.length > 0 && (
//             <div style={{ marginTop: "5px", fontSize: "10px" }}>
//               {syncInfo.dirtySuppliers.map((s: any, i: number) => (
//                 <div key={i}>
//                   • {s.name} (ID: {s.id.substr(0, 8)}...)
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>
//       )}

//       {syncInfo.sampleSuppliers && (
//         <div>
//           <strong>Sample Suppliers:</strong>
//           <div style={{ fontSize: "10px", marginTop: "5px" }}>
//             {syncInfo.sampleSuppliers.map((s: any, i: number) => (
//               <div key={i}>
//                 • {s.name} ({s.code || "No code"})
//               </div>
//             ))}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
