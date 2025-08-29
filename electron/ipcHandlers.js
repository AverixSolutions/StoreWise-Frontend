// electron/ipcHandlers.js
const { registerProductHandlers } = require("./ipc/products");
const { registerProductSyncHandlers } = require("./ipc/productSync");
const { registerMaintenanceHandlers } = require("./ipc/maintenance");

function registerAllHandlers() {
  registerProductHandlers();
  registerProductSyncHandlers();
  registerMaintenanceHandlers();
}

module.exports = { registerAllHandlers };
