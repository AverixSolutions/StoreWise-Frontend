// electron/main.js
const { app, BrowserWindow, nativeImage, Menu } = require("electron");
const { registerAllHandlers } = require("../electron/ipcHandlers");
const path = require("path");

function createWindow() {
  const iconPath =
    process.platform === "win32"
      ? path.join(__dirname, "public/favicon.ico")
      : path.join(__dirname, "public/Averix-icon.png");

  const win = new BrowserWindow({
    width: 1600,
    height: 800,
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  Menu.setApplicationMenu(null);

  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://localhost:3000");
  } else {
    win.loadFile(path.join(__dirname, "../out/index.html"));
  }

  win.webContents.openDevTools();
}

app.whenReady().then(() => {
  registerAllHandlers();
  createWindow();

  if (process.platform === "darwin") {
    const icon = nativeImage.createFromPath(
      path.join(__dirname, "public/Averix-icon.png")
    );
    app.dock.setIcon(icon);
  }

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
