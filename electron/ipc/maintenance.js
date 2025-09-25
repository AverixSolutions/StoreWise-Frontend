// elctron/ipc/maintenance.js
const { ipcMain } = require("electron");
const db = require("../db");

function registerMaintenanceHandlers() {
  ipcMain.handle("wipe-local-data", () => {
    const trx = db.transaction(() => {
      db.prepare(`DELETE FROM purchase_items`).run();
      db.prepare(`DELETE FROM purchases`).run();

      db.prepare(`DELETE FROM supplier_transactions`).run();

      db.prepare(`DELETE FROM products`).run();
      db.prepare(`DELETE FROM code_sequence`).run();
      db.prepare(`DELETE FROM sync_state`).run();

      db.prepare(`DELETE FROM suppliers`).run();
      db.prepare(`DELETE FROM supplier_sequence`).run();
    });
    trx();
    return { success: true };
  });
}

module.exports = { registerMaintenanceHandlers };
