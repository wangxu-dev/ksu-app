import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, Menu, ipcMain, type MenuItemConstructorOptions } from "electron";
import { createLogger } from "./shared/logger.js";
import { login } from "./auth/login.js";
import { buildKsuRequest, type KsuRequestPayload } from "./ksu/request-builder.js";
import { dispatchRequest } from "./request/dispatcher.js";
import { runAssistantStream } from "./assistant/runtime.js";
import { createAssistantStore } from "./assistant/store.js";
import { createKsuMcpRegistry } from "./assistant/mcp/ksu-mcp.js";
import { createUpdateManager } from "./updater/manager.js";
import {
  APP_UPDATE_STATUS_CHANNEL,
  APP_UPDATE_GET_STATUS_CHANNEL,
  APP_UPDATE_CHECK_CHANNEL,
  APP_UPDATE_INSTALL_CHANNEL,
} from "./updater/channels.js";
import {
  AUTH_LOGIN_CHANNEL,
  KSU_REQUEST_CHANNEL,
  PROXY_REQUEST_CHANNEL,
} from "./request/channels.js";
import {
  ASSISTANT_STREAM_START_CHANNEL,
  ASSISTANT_CONVERSATION_CREATE_CHANNEL,
  ASSISTANT_CONVERSATION_LIST_CHANNEL,
  ASSISTANT_CONVERSATION_MESSAGES_CHANNEL,
  ASSISTANT_CONVERSATION_DELETE_CHANNEL,
  ASSISTANT_CONVERSATION_REPLACE_MESSAGES_CHANNEL,
  ASSISTANT_SETTINGS_GET_CHANNEL,
  ASSISTANT_SETTINGS_SET_CHANNEL,
  ASSISTANT_MCP_LIST_TOOLS_CHANNEL,
  ASSISTANT_MCP_CALL_TOOL_CHANNEL,
} from "./assistant/channels.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger("main");
const VERBOSE_RENDERER_LOGS = String(process.env.LOG_VERBOSE_RENDERER || "") === "1";

function resolveIconPath(): string {
  const icoPath = path.join(__dirname, "..", "build", "icons", "icon.ico");
  const pngPath = path.join(__dirname, "..", "build", "icons", "icon.png");
  const icnsPath = path.join(__dirname, "..", "build", "icons", "icon.icns");

  if (process.platform === "win32") return icoPath;
  if (process.platform === "darwin") return icnsPath;
  return pngPath;
}

function platformWindowOptions(): Partial<Electron.BrowserWindowConstructorOptions> {
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

function buildApplicationMenu(): Electron.Menu | null {
  if (process.platform === "darwin") {
    const template: MenuItemConstructorOptions[] = [{ role: "appMenu" }, { role: "windowMenu" }];
    return Menu.buildFromTemplate(template);
  }
  return null;
}

function createWindow(): void {
  const width = 1200;
  const height = 800;
  const iconPath = resolveIconPath();
  const windowIcon =
    process.platform === "win32"
      ? iconPath
      : path.join(__dirname, "..", "build", "icons", "icon.png");
  const hasWindowIcon = fs.existsSync(windowIcon);
  if (!hasWindowIcon) {
    logger.warn("window icon missing", { windowIcon });
  }

  const win = new BrowserWindow({
    width,
    height,
    minWidth: width,
    minHeight: height,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    icon: hasWindowIcon ? windowIcon : undefined,
    ...platformWindowOptions(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL || "http://localhost:1420";
  if (app.isPackaged) {
    const indexPath = path.join(__dirname, "..", "dist", "index.html");
    if (fs.existsSync(indexPath)) {
      logger.info("loading packaged renderer", { indexPath });
      win.loadFile(indexPath);
    } else {
      logger.error("packaged renderer entry missing", { indexPath });
    }
  } else {
    logger.info("loading dev renderer", { devUrl });
    win.loadURL(devUrl);
  }

  win.webContents.on("did-fail-load", (_event, code, description, validatedURL) => {
    logger.error("renderer failed to load", {
      code,
      description,
      validatedURL,
      isPackaged: app.isPackaged,
    });
  });
  win.webContents.on("did-finish-load", () => {
    logger.info("renderer did finish load", {
      url: win.webContents.getURL(),
      isPackaged: app.isPackaged,
    });
  });
  win.webContents.on("console-message", (_event, details: unknown) => {
    const payload = (details || {}) as {
      level?: number;
      message?: string;
      lineNumber?: number;
      sourceId?: string;
    };
    const level = Number(payload.level || 0);
    const meta = {
      level,
      message: String(payload.message || ""),
      line: Number(payload.lineNumber || 0),
      sourceId: String(payload.sourceId || ""),
    };
    // Chromium levels: 0=log, 1=warn, 2=error, 3=debug-like internal noise
    if (level >= 2) {
      logger.error("renderer console message", meta);
      return;
    }
    if (VERBOSE_RENDERER_LOGS) {
      logger.debug("renderer console message", meta);
    }
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    logger.error("renderer process gone", details ? { ...details } : {});
  });
  bindClipboardShortcuts(win);
  bindDevtoolsShortcuts(win);
  bindInspectContextMenu(win);
}

function bindClipboardShortcuts(win: BrowserWindow): void {
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

function bindDevtoolsShortcuts(win: BrowserWindow): void {
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

function bindInspectContextMenu(win: BrowserWindow): void {
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
  logger.info("app ready");
  const broadcastUpdateStatus = (
    payload: ReturnType<ReturnType<typeof createUpdateManager>["getStatus"]>,
  ) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(APP_UPDATE_STATUS_CHANNEL, payload);
      }
    }
  };
  const updateManager = createUpdateManager({
    app,
    logger,
    publish: broadcastUpdateStatus,
  });
  if (process.platform === "darwin" && app.dock) {
    const dockIcon = path.join(__dirname, "..", "build", "icons", "icon.png");
    if (fs.existsSync(dockIcon)) {
      app.dock.setIcon(dockIcon);
    } else {
      logger.warn("dock icon missing", { dockIcon });
    }
  }
  const assistantStore = createAssistantStore(app.getPath("userData"));
  ipcMain.handle(AUTH_LOGIN_CHANNEL, async (event, payload: unknown) => {
    try {
      logger.info("auth login request received");
      const result = await login(
        event.sender.session,
        (payload || {}) as { username: string; password: string },
      );
      logger.info("auth login request completed", { success: !!result?.success });
      return result;
    } catch (error) {
      logger.error("auth login request failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });
  ipcMain.handle(KSU_REQUEST_CHANNEL, async (event, payload: unknown) => {
    try {
      return await dispatchRequest(ipcMain, event, buildKsuRequest(payload as KsuRequestPayload));
    } catch (error) {
      logger.error("ksu request failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        status: 0,
        headers: {},
        body: "",
        error: error instanceof Error ? error.message : "ksu request build failed",
        errorCode: "KSU_REQUEST_BUILD_FAILED",
      };
    }
  });
  ipcMain.handle(PROXY_REQUEST_CHANNEL, async (event, payload: unknown) =>
    dispatchRequest(ipcMain, event, payload),
  );
  ipcMain.handle(APP_UPDATE_GET_STATUS_CHANNEL, async () => updateManager.getStatus());
  ipcMain.handle(APP_UPDATE_CHECK_CHANNEL, async () => updateManager.checkForUpdates());
  ipcMain.handle(APP_UPDATE_INSTALL_CHANNEL, async () => ({
    ok: updateManager.installDownloaded(),
  }));
  ipcMain.handle(ASSISTANT_STREAM_START_CHANNEL, async (event, payload: unknown) => {
    const safePayload = (payload || {}) as {
      message?: string;
      token?: string;
      conversationId?: string;
      apiKey?: string;
      model?: string;
      baseUrl?: string;
    };
    logger.info("assistant stream request received", {
      conversationId: String(safePayload.conversationId || ""),
      hasToken: Boolean(String(safePayload.token || "")),
      messageLength: String(safePayload.message || "").trim().length,
    });
    return runAssistantStream({
      event,
      payload: safePayload,
      store: assistantStore,
      callKsuEndpoint: async (input) => dispatchRequest(ipcMain, event, buildKsuRequest(input)),
    });
  });
  ipcMain.handle(ASSISTANT_CONVERSATION_CREATE_CHANNEL, async (_event, payload: unknown) =>
    assistantStore.createConversation((payload as { title?: string } | undefined)?.title),
  );
  ipcMain.handle(ASSISTANT_CONVERSATION_LIST_CHANNEL, async () =>
    assistantStore.listConversations(),
  );
  ipcMain.handle(ASSISTANT_CONVERSATION_MESSAGES_CHANNEL, async (_event, payload: unknown) =>
    assistantStore.getMessages(
      String((payload as { conversationId?: string } | undefined)?.conversationId || ""),
    ),
  );
  ipcMain.handle(ASSISTANT_CONVERSATION_DELETE_CHANNEL, async (_event, payload: unknown) =>
    assistantStore.deleteConversation(
      String((payload as { conversationId?: string } | undefined)?.conversationId || ""),
    ),
  );
  ipcMain.handle(
    ASSISTANT_CONVERSATION_REPLACE_MESSAGES_CHANNEL,
    async (_event, payload: unknown) => {
      const safePayload = (payload || {}) as {
        conversationId?: string;
        messages?: Array<{ role: "user" | "assistant"; content: string }>;
      };
      const conversationId = String(safePayload.conversationId || "");
      logger.debug("replace conversation messages", {
        conversationId,
        count: Array.isArray(safePayload.messages) ? safePayload.messages.length : 0,
      });
      assistantStore.replaceMessages(conversationId, safePayload.messages || []);
      return { ok: true };
    },
  );
  ipcMain.handle(ASSISTANT_SETTINGS_GET_CHANNEL, async () => assistantStore.getSettings());
  ipcMain.handle(ASSISTANT_SETTINGS_SET_CHANNEL, async (_event, payload: unknown) =>
    assistantStore.setSettings((payload || {}) as Record<string, string>),
  );
  ipcMain.handle(ASSISTANT_MCP_LIST_TOOLS_CHANNEL, async (event) => {
    const registry = createKsuMcpRegistry({
      callKsuEndpoint: async (input) => dispatchRequest(ipcMain, event, buildKsuRequest(input)),
    });
    logger.debug("mcp list tools");
    return registry.listTools();
  });
  ipcMain.handle(ASSISTANT_MCP_CALL_TOOL_CHANNEL, async (event, payload: unknown) => {
    const registry = createKsuMcpRegistry({
      callKsuEndpoint: async (input) => dispatchRequest(ipcMain, event, buildKsuRequest(input)),
    });
    const safePayload = (payload || {}) as {
      name?: string;
      token?: string;
      args?: Record<string, unknown>;
    };
    const toolName = String(safePayload.name || "");
    const token = String(safePayload.token || "");
    try {
      return await registry.callTool(toolName, safePayload.args || {}, { token });
    } catch (error) {
      logger.error("mcp call failed", {
        toolName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });
  createWindow();
  updateManager.startSilentCheck();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
