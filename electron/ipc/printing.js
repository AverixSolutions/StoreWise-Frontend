// electron/ipc/printing.js
const { ipcMain, BrowserWindow } = require("electron");

function registerPrintingHandlers() {
  // ── List installed printers ───────────────────────────────────────────────
  ipcMain.handle("print:get-printers", async () => {
    try {
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) return [];
      const printers = await win.webContents.getPrintersAsync();
      return printers.map((p) => ({
        name: p.name,
        displayName: p.displayName || p.name,
        description: p.description || "",
        isDefault: p.isDefault ?? false,
        status: p.status ?? 0,
      }));
    } catch (err) {
      console.error("[printing] get-printers failed:", err);
      return [];
    }
  });

  // ── Print HTML ────────────────────────────────────────────────────────────
  ipcMain.handle("print:html", async (_event, html, options = {}) => {
    const showPreview = options.preview === true;
    const printerName = options.printerName || options.deviceName || "";
    const pageSize = options.pageSize || "A4";
    const title = options.title || "KynFlow Print";

    if (showPreview) {
      return openPreviewWindow(html, title, printerName, pageSize);
    } else {
      return silentPrint(html, printerName, pageSize);
    }
  });
}

// ── Preview: load HTML directly — no iframe, one set of buttons ──────────────
async function openPreviewWindow(html, title, printerName, pageSize) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 1100,
      height: 860,
      show: false,
      autoHideMenuBar: true,
      title,
      webPreferences: {
        sandbox: false,
        webSecurity: false, // allows R2/external images from data: origin
        contextIsolation: false,
      },
    });

    // Inject a silent-print helper so the invoice's Print button can call it
    // instead of window.print() → OS dialog
    win.webContents.on("did-finish-load", () => {
      // Override window.print to use Electron's native print (silent to
      // configured printer). The invoice HTML's Print button calls window.print().
      win.webContents
        .executeJavaScript(
          `
        window.print = function() {
          // Trigger Electron native print — goes to configured printer silently
          window._electronSilentPrint && window._electronSilentPrint();
        };
      `,
        )
        .catch(() => {});

      win.show();
      win.focus();
    });

    // Allow the print window to message back via console tricks or just
    // handle the toolbar button click by listening for the close/print actions
    // injected into the page
    win.webContents.on("did-finish-load", () => {
      // Patch the Print button in the invoice to do silent Electron print
      win.webContents
        .executeJavaScript(
          `
        (function() {
          // Find the print button(s) and rewire them
          document.querySelectorAll('.btn-print-electron, button[onclick*="print"]').forEach(function(btn) {
            btn.onclick = function() {
              // Use IPC-free approach: trigger webContents.print from main
              // by sending a custom event the main process can listen to
              document.title = '__KYNFLOW_PRINT__';
            };
          });
        })();
      `,
        )
        .catch(() => {});
    });

    // Watch for the title-change trick to trigger silent print
    win.webContents.on("page-title-updated", async (e, newTitle) => {
      if (newTitle === "__KYNFLOW_PRINT__") {
        e.preventDefault();
        try {
          await new Promise((res2) => {
            win.webContents.print(
              {
                silent: true,
                printBackground: true,
                deviceName: printerName,
                margins: { marginType: "none" },
                pageSize,
              },
              (success, reason) => res2({ success, reason }),
            );
          });
        } catch {}
        // Restore title
        win.webContents
          .executeJavaScript(
            `document.title = ${JSON.stringify(win.getTitle())}`,
          )
          .catch(() => {});
      }
    });

    win.on("closed", () => resolve({ success: true, preview: true }));
    win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  });
}

// ── Silent print: hidden window, no UI, returns success/error ────────────────
async function silentPrint(html, printerName, pageSize) {
  let win = null;
  try {
    win = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      skipTaskbar: true,
      webPreferences: {
        sandbox: false,
        webSecurity: false,
      },
    });

    await new Promise((resolve, reject) => {
      win.webContents.once("did-finish-load", resolve);
      win.webContents.once("did-fail-load", (_, code, desc) =>
        reject(new Error(desc || "Load failed")),
      );
      win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    });

    // Small delay so images (logo) can render before printing
    await new Promise((r) => setTimeout(r, 600));

    const result = await new Promise((resolve) => {
      win.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: printerName,
          margins: { marginType: "none" },
          pageSize,
        },
        (success, failureReason) => resolve({ success, failureReason }),
      );
    });

    if (!win.isDestroyed()) win.close();

    return result.success
      ? { success: true }
      : { success: false, error: result.failureReason || "Print failed" };
  } catch (err) {
    if (win && !win.isDestroyed()) win.close();
    return { success: false, error: String(err?.message || err) };
  }
}

module.exports = { registerPrintingHandlers };
