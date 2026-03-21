// electron/ipc/printing.js
const { ipcMain, BrowserWindow } = require("electron");

function buildPreviewHtml(printableHtml, options = {}) {
  const title = options.title || "Print Preview";

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        height: 100%;
        font-family: Arial, sans-serif;
        background: #f3f4f6;
      }

      .app {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .toolbar {
        height: 60px;
        background: #111827;
        color: white;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        border-bottom: 1px solid #374151;
      }

      .toolbar-left {
        font-size: 16px;
        font-weight: 700;
      }

      .toolbar-right {
        display: flex;
        gap: 10px;
      }

      button {
        border: 0;
        border-radius: 8px;
        padding: 10px 14px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      }

      .btn-print {
        background: #2563eb;
        color: white;
      }

      .btn-print:hover {
        background: #1d4ed8;
      }

      .btn-close {
        background: #e5e7eb;
        color: #111827;
      }

      .btn-close:hover {
        background: #d1d5db;
      }

      .preview-wrap {
        flex: 1;
        overflow: auto;
        padding: 24px;
      }

      .paper {
        width: min(100%, 900px);
        margin: 0 auto;
        background: white;
        box-shadow: 0 10px 30px rgba(0,0,0,0.12);
        border-radius: 12px;
        overflow: hidden;
      }

      iframe {
        width: 100%;
        height: calc(100vh - 120px);
        border: 0;
        background: white;
      }
    </style>
  </head>
  <body>
    <div class="app">
      <div class="toolbar">
        <div class="toolbar-left">${title}</div>
        <div class="toolbar-right">
          <button class="btn-print" onclick="handlePrint()">Print</button>
          <button class="btn-close" onclick="window.close()">Close</button>
        </div>
      </div>

      <div class="preview-wrap">
        <div class="paper">
          <iframe id="previewFrame"></iframe>
        </div>
      </div>
    </div>

    <script>
      const printableHtml = ${JSON.stringify(printableHtml)};
      const frame = document.getElementById("previewFrame");
      const doc = frame.contentWindow.document;
      doc.open();
      doc.write(printableHtml);
      doc.close();

      function handlePrint() {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      }
    </script>
  </body>
  </html>
  `;
}

function registerPrintingHandlers() {
  ipcMain.handle("print:html", async (_event, html, options = {}) => {
    let printWindow = null;

    try {
      const showPreview = options.preview !== false;

      printWindow = new BrowserWindow({
        width: 1100,
        height: 800,
        show: false,
        autoHideMenuBar: true,
        frame: true,
        resizable: true,
        minimizable: true,
        maximizable: true,
        title: options.title || "Print Preview",
        webPreferences: {
          sandbox: false,
        },
      });

      const previewHtml = buildPreviewHtml(html, options);

      await printWindow.loadURL(
        "data:text/html;charset=utf-8," + encodeURIComponent(previewHtml),
      );

      if (showPreview) {
        printWindow.show();
        printWindow.focus();
        return { success: true, preview: true };
      }

      // silent/non-preview direct print flow
      const result = await new Promise((resolve) => {
        printWindow.webContents.print(
          {
            silent: options.silent ?? false,
            printBackground: true,
            deviceName: options.deviceName || "",
            margins: { marginType: "none" },
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
