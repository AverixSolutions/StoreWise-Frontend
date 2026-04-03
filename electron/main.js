// electron/main.js
const { app, BrowserWindow, nativeImage, Menu, dialog } = require("electron");
const { registerAllHandlers } = require("../electron/ipcHandlers");
const path = require("path");
const express = require("express");
const http = require("http");

app.setName("KYNFLOW");

let localServer = null;
let mainWindow = null;

async function startLocalServer() {
  const serverApp = express();
  const outPath = path.join(__dirname, "../out");

  serverApp.use(express.static(outPath, { extensions: ["html"] }));

  serverApp.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(outPath, "index.html"));
  });

  return await new Promise((resolve, reject) => {
    const server = http.createServer(serverApp);

    server.on("error", reject);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to start local server"));
        return;
      }

      resolve({
        server,
        url: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

function attachWindowDebug(win) {
  win.webContents.on(
    "console-message",
    (_event, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
    },
  );

  win.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer process gone:", details);
    dialog.showErrorBox(
      "Renderer crashed",
      `Reason: ${details.reason}\nExit code: ${details.exitCode || "unknown"}`,
    );
  });

  win.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error("did-fail-load:", {
        errorCode,
        errorDescription,
        validatedURL,
      });
    },
  );

  win.webContents.on("unresponsive", () => {
    console.error("Window became unresponsive");
  });

  win.webContents.on("responsive", () => {
    console.log("Window responsive again");
  });
}

async function createWindow() {
  const iconPath =
    process.platform === "win32"
      ? path.join(__dirname, "../build/icon.ico")
      : path.join(__dirname, "../build/icon.png");

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    icon: iconPath,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);
  attachWindowDebug(mainWindow);

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  if (process.env.NODE_ENV === "development") {
    await mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  const { server, url } = await startLocalServer();
  localServer = server;

  await mainWindow.loadURL(url);
  mainWindow.webContents.openDevTools({ mode: "detach" });
}

app.whenReady().then(async () => {
  try {
    registerAllHandlers();

    if (process.platform === "darwin") {
      const icon = nativeImage.createFromPath(
        path.join(__dirname, "../build/icon.png"),
      );
      if (!icon.isEmpty()) {
        app.dock.setIcon(icon);
      }
    }

    await createWindow();

    app.on("activate", async function () {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createWindow();
      }
    });
  } catch (error) {
    console.error("App startup failed:", error);
    dialog.showErrorBox(
      "Startup Error",
      error?.stack || error?.message || String(error),
    );
  }
});

app.on("window-all-closed", function () {
  if (localServer) {
    try {
      localServer.close();
    } catch (_) {}
  }

  if (process.platform !== "darwin") app.quit();
});

process.on("uncaughtException", (error) => {
  console.error("uncaughtException:", error);
  dialog.showErrorBox(
    "Uncaught Exception",
    error?.stack || error?.message || String(error),
  );
});

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason);
  dialog.showErrorBox(
    "Unhandled Rejection",
    reason?.stack || reason?.message || String(reason),
  );
});
