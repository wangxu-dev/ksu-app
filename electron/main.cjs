const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { login } = require("./auth/login.cjs");
const { buildKsuRequest } = require("./ksu/request-builder.cjs");
const { dispatchRequest } = require("./request/dispatcher.cjs");
const {
  AUTH_LOGIN_CHANNEL,
  KSU_REQUEST_CHANNEL,
  PROXY_REQUEST_CHANNEL,
} = require("./request/channels.cjs");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL || "http://localhost:1420";
  win.loadURL(devUrl);
}

app.whenReady().then(() => {
  ipcMain.handle(AUTH_LOGIN_CHANNEL, async (event, payload) =>
    login(event.sender.session, payload),
  );
  ipcMain.handle(KSU_REQUEST_CHANNEL, async (event, payload) => {
    try {
      return await dispatchRequest(ipcMain, event, buildKsuRequest(payload));
    } catch (error) {
      return {
        ok: false,
        status: 0,
        headers: {},
        body: "",
        error: error instanceof Error ? error.message : "ksu request build failed",
      };
    }
  });
  ipcMain.handle(PROXY_REQUEST_CHANNEL, async (event, payload) =>
    dispatchRequest(ipcMain, event, payload),
  );
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
