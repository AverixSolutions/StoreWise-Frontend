// electron/ipc/printing.js
const { ipcMain, BrowserWindow } = require("electron");

function registerPrintingHandlers() {
  ipcMain.handle("print:html", async (_event, html, options = {}) => {
    let printWindow = null;

    try {
      printWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        show: true, // IMPORTANT: must be visible for print dialog
        autoHideMenuBar: true,
        webPreferences: {
          sandbox: false,
        },
      });

      // optional: don't flash too much before content loads
      printWindow.once("ready-to-show", () => {
        printWindow.show();
        printWindow.focus();
      });

      await printWindow.loadURL(
        "data:text/html;charset=utf-8," + encodeURIComponent(html),
      );

      await new Promise((resolve) => {
        printWindow.webContents.once("did-finish-load", () => {
          setTimeout(resolve, 500);
        });
      });

      printWindow.focus();

      const result = await new Promise((resolve) => {
        printWindow.webContents.print(
          {
            silent: false, // show system print dialog
            printBackground: true,
            deviceName: options.deviceName || "",
            margins: {
              marginType: "none",
            },
            landscape: !!options.landscape,
            pageSize: options.pageSize || "A4",
          },
          (success, failureReason) => {
            resolve({ success, failureReason });
          },
        );
      });

      if (printWindow && !printWindow.isDestroyed()) {
        printWindow.close();
      }

      if (!result.success) {
        return {
          success: false,
          error: result.failureReason || "Print failed",
        };
      }

      return { success: true };
    } catch (error) {
      if (printWindow && !printWindow.isDestroyed()) {
        printWindow.close();
      }

      return {
        success: false,
        error: String(error?.message || error),
      };
    }
  });
}

module.exports = { registerPrintingHandlers };
