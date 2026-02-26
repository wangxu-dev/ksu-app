const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("node:path");
const { login } = require("./auth/login.cjs");
const { buildKsuRequest } = require("./ksu/request-builder.cjs");
const { dispatchRequest } = require("./request/dispatcher.cjs");
const { runAssistantStream } = require("./assistant/runtime.cjs");
const { createAssistantStore } = require("./assistant/store.cjs");
const {
  AUTH_LOGIN_CHANNEL,
  KSU_REQUEST_CHANNEL,
  PROXY_REQUEST_CHANNEL,
} = require("./request/channels.cjs");
const {
  ASSISTANT_STREAM_START_CHANNEL,
  ASSISTANT_CONVERSATION_CREATE_CHANNEL,
  ASSISTANT_CONVERSATION_LIST_CHANNEL,
  ASSISTANT_CONVERSATION_MESSAGES_CHANNEL,
  ASSISTANT_CONVERSATION_REPLACE_MESSAGES_CHANNEL,
  ASSISTANT_SETTINGS_GET_CHANNEL,
  ASSISTANT_SETTINGS_SET_CHANNEL,
} = require("./assistant/channels.cjs");

function platformWindowOptions() {
  if (process.platform === "darwin") {
    return {
      titleBarStyle: "default",
      autoHideMenuBar: false,
    };
  }

  return {
    autoHideMenuBar: true,
    titleBarStyle: "default",
  };
}

function buildApplicationMenu() {
  if (process.platform === "darwin") {
    // Keep native mac app/window behavior but remove File/Edit style menus.
    return Menu.buildFromTemplate([{ role: "appMenu" }, { role: "windowMenu" }]);
  }

  // On Windows/Linux we don't need a classic menu bar.
  return null;
}

function createWindow() {
  const width = 1200;
  const height = 800;

  const win = new BrowserWindow({
    width,
    height,
    minWidth: width,
    minHeight: height,
    resizable: true,
    maximizable: true,
    fullScreenable: true,
    ...platformWindowOptions(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL || "http://localhost:1420";
  win.loadURL(devUrl);
  bindClipboardShortcuts(win);
  bindDevtoolsShortcuts(win);
  bindInspectContextMenu(win);
}

function bindClipboardShortcuts(win) {
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const hasModifier = !!input.meta || !!input.control;
    if (!hasModifier) return;
    const key = String(input.key || "").toLowerCase();

    if (key === "v") {
      win.webContents.paste();
      event.preventDefault();
      return;
    }
    if (key === "c") {
      win.webContents.copy();
      event.preventDefault();
      return;
    }
    if (key === "x") {
      win.webContents.cut();
      event.preventDefault();
      return;
    }
    if (key === "a") {
      win.webContents.selectAll();
      event.preventDefault();
    }
  });
}

function bindDevtoolsShortcuts(win) {
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const key = String(input.key || "").toLowerCase();
    const withMeta = !!input.meta && !!input.alt && key === "i";
    const withCtrlShift = !!input.control && !!input.shift && key === "i";
    const withF12 = key === "f12";

    if (withMeta || withCtrlShift || withF12) {
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools();
      } else {
        win.webContents.openDevTools({ mode: "detach" });
      }
      event.preventDefault();
    }
  });
}

function bindInspectContextMenu(win) {
  win.webContents.on("context-menu", (_event, params) => {
    const menu = Menu.buildFromTemplate([
      {
        label: "Inspect",
        click: () => {
          win.webContents.inspectElement(params.x, params.y);
          if (!win.webContents.isDevToolsOpened()) {
            win.webContents.openDevTools({ mode: "detach" });
          }
        },
      },
    ]);
    menu.popup();
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildApplicationMenu());
  const assistantStore = createAssistantStore(app.getPath("userData"));
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
  ipcMain.handle(ASSISTANT_STREAM_START_CHANNEL, async (event, payload) =>
    runAssistantStream({
      event,
      payload,
      store: assistantStore,
      callKsuEndpoint: async (input) => dispatchRequest(ipcMain, event, buildKsuRequest(input)),
    }),
  );
  ipcMain.handle(ASSISTANT_CONVERSATION_CREATE_CHANNEL, async (_event, payload) =>
    assistantStore.createConversation(payload?.title),
  );
  ipcMain.handle(ASSISTANT_CONVERSATION_LIST_CHANNEL, async () =>
    assistantStore.listConversations(),
  );
  ipcMain.handle(ASSISTANT_CONVERSATION_MESSAGES_CHANNEL, async (_event, payload) =>
    assistantStore.getMessages(String(payload?.conversationId || "")),
  );
  ipcMain.handle(ASSISTANT_CONVERSATION_REPLACE_MESSAGES_CHANNEL, async (_event, payload) => {
    const conversationId = String(payload?.conversationId || "");
    assistantStore.replaceMessages(conversationId, payload?.messages || []);
    return { ok: true };
  });
  ipcMain.handle(ASSISTANT_SETTINGS_GET_CHANNEL, async () => assistantStore.getSettings());
  ipcMain.handle(ASSISTANT_SETTINGS_SET_CHANNEL, async (_event, payload) =>
    assistantStore.setSettings(payload || {}),
  );
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
