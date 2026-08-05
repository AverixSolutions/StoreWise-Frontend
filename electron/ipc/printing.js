// electron/ipc/printing.js
const { ipcMain, BrowserWindow } = require("electron");
const path = require("path");

const PREVIEW_PRINT_COMMAND = "__KYNFLOW_PREVIEW_PRINT__";
const PREVIEW_CLOSE_COMMAND = "__KYNFLOW_PREVIEW_CLOSE__";
const PREVIEW_WINDOW_TITLE = "KYNFLOW Print Preview";
const PREVIEW_ICON_PATH =
  process.platform === "win32"
    ? path.join(__dirname, "../../build/icon.ico")
    : path.join(__dirname, "../../build/icon.png");

function registerPrintingHandlers() {
  ipcMain.handle("print:get-printers", async () => {
    try {
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) return [];

      const printers = await win.webContents.getPrintersAsync();
      return printers.map((printer) => ({
        name: printer.name,
        displayName: printer.displayName || printer.name,
        description: printer.description || "",
        isDefault: printer.isDefault ?? false,
        status: printer.status ?? 0,
      }));
    } catch (error) {
      console.error("[printing] get-printers failed:", error);
      return [];
    }
  });

  ipcMain.handle("print:html", async (_event, html, options = {}) => {
    const showPreview = options.preview === true;
    const printerName = options.printerName || options.deviceName || "";
    const pageSize = options.pageSize || "A4";
    const title = options.title || "KYNFLOW Print";
    const paperLabel =
      options.paperLabel ||
      (typeof pageSize === "string" ? pageSize : "Custom paper");

    if (showPreview) {
      return openPreviewWindow({
        html,
        title,
        paperLabel,
        printerName,
        pageSize,
      });
    }

    return silentPrint(html, printerName, pageSize);
  });
}

async function waitForDocumentImages(win, timeoutMs = 3000) {
  if (!win || win.isDestroyed()) return;

  await win.webContents
    .executeJavaScript(
      `
      Promise.race([
        Promise.all(
          Array.from(document.images || []).map(function (image) {
            if (image.complete && image.naturalWidth > 0) {
              return Promise.resolve();
            }

            return new Promise(function (resolve) {
              var finish = function () { resolve(); };
              image.addEventListener("load", finish, { once: true });
              image.addEventListener("error", finish, { once: true });
            });
          })
        ),
        new Promise(function (resolve) {
          window.setTimeout(resolve, ${timeoutMs});
        })
      ]);
    `,
    )
    .catch(() => {});
}
function buildPreviewBootstrap(title, paperLabel) {
  return `
    (function () {
      var existing = document.querySelector("[data-kynflow-preview-toolbar]");
      if (existing) return;

      document.querySelectorAll(".no-print").forEach(function (node) {
        node.remove();
      });

      var style = document.createElement("style");
      style.id = "kynflow-preview-shell-style";
      style.textContent = [
        "html,body{background:#fff!important;}body{padding-top:66px!important;}",
        ".kynflow-preview-toolbar{position:fixed;z-index:2147483647;top:0;left:0;right:0;height:58px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 16px;border-bottom:1px solid rgba(255,255,255,.12);background:#0f1e38;box-shadow:0 6px 18px rgba(15,23,42,.18);color:#fff;font-family:Inter,Segoe UI,Arial,sans-serif;}",
        ".kynflow-preview-toolbar:after{content:'';position:absolute;left:0;right:0;bottom:-2px;height:2px;background:linear-gradient(90deg,#20b7ff,#2477ff,#b026ff);}",
        ".kynflow-preview-copy{min-width:0;}",
        ".kynflow-preview-title{overflow:hidden;color:#fff;font-size:14px;font-weight:800;text-overflow:ellipsis;white-space:nowrap;}",
        ".kynflow-preview-sub{margin-top:2px;color:rgba(255,255,255,.55);font-size:10px;}",
        ".kynflow-preview-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto;}",
        ".kynflow-preview-paper{margin-right:6px;border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:5px 9px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.82);font-size:10px;font-weight:800;}",
        ".kynflow-preview-status{min-width:54px;color:rgba(255,255,255,.55);font-size:10px;text-align:right;}",
        ".kynflow-preview-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:7px 10px;background:rgba(255,255,255,.08);color:#fff;font-size:11px;font-weight:800;cursor:pointer;}",
        ".kynflow-preview-button:hover{background:rgba(255,255,255,.14);}",
        ".kynflow-preview-button.primary{border-color:#20b7ff;background:#2477ff;}",
        ".kynflow-preview-button.primary:hover{background:#1d67dd;}",
        ".kynflow-preview-key{display:inline-flex;align-items:center;justify-content:center;min-height:18px;border:1px solid rgba(255,255,255,.2);border-radius:5px;padding:1px 5px;background:rgba(255,255,255,.1);color:#fff;font:700 8px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;}",
        ".kynflow-preview-button:disabled{cursor:wait;opacity:.55;}",
        "@media print{body{padding-top:0!important}.kynflow-preview-toolbar{display:none!important}}"
      ].join("");

      document.head.appendChild(style);

      var toolbar = document.createElement("div");
      toolbar.className = "kynflow-preview-toolbar";
      toolbar.setAttribute("data-kynflow-preview-toolbar", "true");
      toolbar.innerHTML =
        '<div class="kynflow-preview-copy">' +
          '<div class="kynflow-preview-title"></div>' +
          '<div class="kynflow-preview-sub">Clean print preview</div>' +
        '</div>' +
        '<div class="kynflow-preview-actions">' +
          '<span class="kynflow-preview-paper"></span>' +
          '<span class="kynflow-preview-status" data-kynflow-preview-status>Ready</span>' +
          '<button type="button" class="kynflow-preview-button" data-kynflow-preview-close><span>Close</span><kbd class="kynflow-preview-key">Esc</kbd></button>' +
          '<button type="button" class="kynflow-preview-button primary" data-kynflow-preview-print><span>Print</span><kbd class="kynflow-preview-key">Ctrl+P</kbd></button>' +
        '</div>';

      document.body.prepend(toolbar);

      toolbar.querySelector(".kynflow-preview-title").textContent =
        ${JSON.stringify(title)};
      toolbar.querySelector(".kynflow-preview-paper").textContent =
        ${JSON.stringify(paperLabel)};

      function send(command) {
        document.title = command;
        window.setTimeout(function () {
          document.title = ${JSON.stringify(PREVIEW_WINDOW_TITLE)};
        }, 0);
      }

      toolbar
        .querySelector("[data-kynflow-preview-print]")
        .addEventListener("click", function () {
          send(${JSON.stringify(PREVIEW_PRINT_COMMAND)});
        });

      toolbar
        .querySelector("[data-kynflow-preview-close]")
        .addEventListener("click", function () {
          send(${JSON.stringify(PREVIEW_CLOSE_COMMAND)});
        });

      window.addEventListener(
        "keydown",
        function (event) {
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "p"
          ) {
            event.preventDefault();
            event.stopPropagation();
            send(${JSON.stringify(PREVIEW_PRINT_COMMAND)});
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            send(${JSON.stringify(PREVIEW_CLOSE_COMMAND)});
          }
        },
        true,
      );

      window.__kynflowPreviewSetState = function (state, message) {
        var status = toolbar.querySelector("[data-kynflow-preview-status]");
        var printButton = toolbar.querySelector("[data-kynflow-preview-print]");
        var closeButton = toolbar.querySelector("[data-kynflow-preview-close]");

        status.textContent = message || "";
        printButton.disabled = state === "printing";
        closeButton.disabled = state === "printing";
      };
    })();
  `;
}

function updatePreviewState(win, state, message) {
  if (!win || win.isDestroyed()) return Promise.resolve();

  return win.webContents
    .executeJavaScript(
      `window.__kynflowPreviewSetState && window.__kynflowPreviewSetState(${JSON.stringify(
        state,
      )}, ${JSON.stringify(message)});`,
    )
    .catch(() => {});
}

async function openPreviewWindow({
  html,
  title,
  paperLabel,
  printerName,
  pageSize,
}) {
  return new Promise((resolve) => {
    let printing = false;
    let printed = false;
    let printError = null;
    let settled = false;

    const win = new BrowserWindow({
      width: pageSize === "A4" ? 1180 : 720,
      height: 900,
      minWidth: pageSize === "A4" ? 940 : 520,
      minHeight: 680,
      show: false,
      autoHideMenuBar: true,
      title: PREVIEW_WINDOW_TITLE,
      icon: PREVIEW_ICON_PATH,
      backgroundColor: "#ffffff",
      webPreferences: {
        sandbox: false,
        webSecurity: false,
        contextIsolation: false,
      },
    });

    if (process.platform !== "darwin") {
      win.setIcon(PREVIEW_ICON_PATH);
    }

    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

    function finish(result) {
      if (settled) return;
      settled = true;
      resolve(result);
    }

    win.webContents.on("did-finish-load", async () => {
      try {
        await waitForDocumentImages(win);
        await win.webContents.executeJavaScript(
          buildPreviewBootstrap(title, paperLabel),
        );
        await win.webContents.executeJavaScript(
          `document.title = ${JSON.stringify(PREVIEW_WINDOW_TITLE)};`,
        );
        win.setTitle(PREVIEW_WINDOW_TITLE);
        win.show();
        win.focus();
      } catch (error) {
        printError = String(error?.message || error);
        if (!win.isDestroyed()) win.close();
      }
    });

    win.webContents.on("did-fail-load", (_event, code, description) => {
      printError = description || `Preview load failed (${code})`;
      if (!win.isDestroyed()) win.close();
    });

    win.webContents.on("page-title-updated", (event, newTitle) => {
      if (newTitle === PREVIEW_CLOSE_COMMAND) {
        event.preventDefault();
        win.setTitle(PREVIEW_WINDOW_TITLE);
        if (!printing && !win.isDestroyed()) win.close();
        return;
      }

      if (newTitle !== PREVIEW_PRINT_COMMAND) return;

      event.preventDefault();
      win.setTitle(PREVIEW_WINDOW_TITLE);
      if (printing || win.isDestroyed()) return;

      printing = true;
      updatePreviewState(win, "printing", "Printing…");

      win.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: printerName,
          margins: { marginType: "none" },
          pageSize,
        },
        async (success, failureReason) => {
          printing = false;

          if (success) {
            printed = true;
            await updatePreviewState(win, "printed", "Printed");
            setTimeout(() => {
              if (!win.isDestroyed()) win.close();
            }, 260);
            return;
          }

          printError = failureReason || "Print failed";
          await updatePreviewState(win, "error", "Print failed");
          win.webContents
            .executeJavaScript(
              `document.title = ${JSON.stringify(PREVIEW_WINDOW_TITLE)};`,
            )
            .catch(() => {});
        },
      );
    });

    win.on("closed", () => {
      if (printError && !printed) {
        finish({
          success: false,
          preview: true,
          printed: false,
          error: printError,
        });
        return;
      }

      finish({
        success: true,
        preview: true,
        printed,
      });
    });

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });
}

async function silentPrint(html, printerName, pageSize) {
  let win = null;

  try {
    win = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      skipTaskbar: true,
      icon: PREVIEW_ICON_PATH,
      backgroundColor: "#ffffff",
      webPreferences: {
        sandbox: false,
        webSecurity: false,
      },
    });

    await new Promise((resolve, reject) => {
      win.webContents.once("did-finish-load", resolve);
      win.webContents.once("did-fail-load", (_event, _code, description) =>
        reject(new Error(description || "Load failed")),
      );
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    });

    await waitForDocumentImages(win);
    await new Promise((resolve) => setTimeout(resolve, 120));

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
      ? { success: true, preview: false, printed: true }
      : {
          success: false,
          preview: false,
          printed: false,
          error: result.failureReason || "Print failed",
        };
  } catch (error) {
    if (win && !win.isDestroyed()) win.close();

    return {
      success: false,
      preview: false,
      printed: false,
      error: String(error?.message || error),
    };
  }
}

module.exports = { registerPrintingHandlers };
