// electron/ipcHandlers.js
const { registerProductHandlers } = require("./ipc/products");

function registerAllHandlers() {
  registerProductHandlers();
}

module.exports = { registerAllHandlers };
