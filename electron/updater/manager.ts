import { createRequire } from "node:module";
import type { App } from "electron";
import type { AppUpdater, ProgressInfo, UpdateInfo } from "electron-updater";
import { UPDATE_SOURCES } from "./sources.js";

const require = createRequire(import.meta.url);

type UpdateState = "idle" | "checking" | "downloading" | "downloaded" | "error" | "unsupported";

type UpdateStatus = {
  state: UpdateState;
  message: string;
  version: string;
  progress: number;
  source: string;
  updatedAt: number;
};

type LoggerLike = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

type UpdateManagerDeps = {
  app: App;
  logger: LoggerLike;
  publish: (payload: UpdateStatus) => void;
};

type UpdateManager = {
  getStatus: () => UpdateStatus;
  checkForUpdates: (options?: { silent?: boolean }) => Promise<UpdateStatus>;
  installDownloaded: () => boolean;
  startSilentCheck: () => void;
};

const DEFAULT_STATUS: UpdateStatus = {
  state: "idle",
  message: "",
  version: "",
  progress: 0,
  source: "",
  updatedAt: 0,
};

function createUpdateManager({ app, logger, publish }: UpdateManagerDeps): UpdateManager {
  let autoUpdater: AppUpdater | null = null;
  let updaterAvailable = true;

  try {
    const updaterModule = require("electron-updater") as { autoUpdater: AppUpdater };
    autoUpdater = updaterModule.autoUpdater;
  } catch (error) {
    updaterAvailable = false;
    logger.warn("electron-updater is not installed; update feature disabled", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  let status: UpdateStatus = { ...DEFAULT_STATUS };
  let checking = false;
  let initialized = false;
  let usingFallback = false;

  function emit(next: Partial<UpdateStatus>): void {
    status = {
      ...status,
      ...next,
      updatedAt: Date.now(),
    };
    publish(status);
  }

  function setSource(useFallback: boolean): void {
    if (!autoUpdater) return;
    const source = useFallback ? UPDATE_SOURCES.fallback : UPDATE_SOURCES.primary;
    const url = `${source.baseUrl}/releases/latest/download`;
    autoUpdater.setFeedURL({
      provider: "generic",
      url,
    });
    usingFallback = useFallback;
    logger.info("updater source selected", { source: source.name, url });
  }

  function ensureInitialized(): void {
    if (!updaterAvailable || !autoUpdater) return;
    if (initialized) return;
    initialized = true;

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;

    autoUpdater.on("checking-for-update", () => {
      emit({
        state: "checking",
        message: "正在检查更新...",
        progress: 0,
        source: usingFallback ? UPDATE_SOURCES.fallback.name : UPDATE_SOURCES.primary.name,
      });
    });

    autoUpdater.on("update-available", (info: UpdateInfo) => {
      emit({
        state: "downloading",
        message: "发现新版本，正在后台下载...",
        version: String(info.version || ""),
        progress: 0,
      });
    });

    autoUpdater.on("download-progress", (progressObj: ProgressInfo) => {
      emit({
        state: "downloading",
        message: "更新下载中...",
        progress: Math.max(0, Math.min(100, Math.round(Number(progressObj.percent || 0)))),
      });
    });

    autoUpdater.on("update-not-available", () => {
      emit({
        state: "idle",
        message: "当前已是最新版本",
        progress: 0,
      });
    });

    autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
      emit({
        state: "downloaded",
        message: "新版本已下载，点击重启更新",
        version: String(info.version || ""),
        progress: 100,
      });
    });

    autoUpdater.on("error", (error: Error) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("auto updater error", { message });
      emit({
        state: "error",
        message,
      });
    });
  }

  async function checkForUpdates({
    silent = false,
  }: { silent?: boolean } = {}): Promise<UpdateStatus> {
    if (!updaterAvailable || !autoUpdater) {
      emit({
        state: "unsupported",
        message: "未安装更新模块（electron-updater）",
      });
      return status;
    }
    if (!app.isPackaged) {
      emit({
        state: "unsupported",
        message: "开发模式不启用自动更新",
      });
      return status;
    }
    if (checking) return status;

    checking = true;
    ensureInitialized();

    if (!silent) {
      emit({
        state: "checking",
        message: "正在检查更新...",
      });
    }

    try {
      setSource(false);
      await autoUpdater.checkForUpdates();
    } catch (primaryError) {
      logger.warn("primary update source failed, trying fallback", {
        message: primaryError instanceof Error ? primaryError.message : String(primaryError),
      });
      try {
        setSource(true);
        await autoUpdater.checkForUpdates();
      } catch (fallbackError) {
        const fallbackMessage =
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        logger.error("fallback update source failed", { message: fallbackMessage });
        emit({
          state: "error",
          message: fallbackMessage,
        });
      }
    } finally {
      checking = false;
    }

    return status;
  }

  function getStatus(): UpdateStatus {
    return status;
  }

  function installDownloaded(): boolean {
    if (!updaterAvailable || !autoUpdater) return false;
    if (status.state !== "downloaded") return false;
    setImmediate(() => {
      autoUpdater?.quitAndInstall();
    });
    return true;
  }

  function startSilentCheck(): void {
    if (!updaterAvailable || !autoUpdater) {
      emit({
        state: "unsupported",
        message: "未安装更新模块（electron-updater）",
      });
      return;
    }
    if (!app.isPackaged) {
      emit({
        state: "unsupported",
        message: "开发模式不启用自动更新",
      });
      return;
    }
    setTimeout(() => {
      void checkForUpdates({ silent: true });
    }, 2_000);
  }

  return {
    getStatus,
    checkForUpdates,
    installDownloaded,
    startSilentCheck,
  };
}

export { createUpdateManager };
