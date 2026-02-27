// @ts-nocheck
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { UPDATE_SOURCES } = require("./sources.js");

const DEFAULT_STATUS = {
  state: "idle",
  message: "",
  version: "",
  progress: 0,
  source: "",
  updatedAt: 0,
};

function createUpdateManager({ app, logger, publish }) {
  let autoUpdater = null;
  let updaterAvailable = true;
  try {
    // Optional dependency: when not installed, updater features are gracefully disabled.
    ({ autoUpdater } = require("electron-updater"));
  } catch (error) {
    updaterAvailable = false;
    logger.warn("electron-updater is not installed; update feature disabled", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  let status = { ...DEFAULT_STATUS };
  let checking = false;
  let initialized = false;
  let usingFallback = false;

  function emit(next) {
    status = {
      ...status,
      ...next,
      updatedAt: Date.now(),
    };
    publish(status);
  }

  function setSource(useFallback) {
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

  function ensureInitialized() {
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

    autoUpdater.on("update-available", (info) => {
      emit({
        state: "downloading",
        message: "发现新版本，正在后台下载...",
        version: String(info?.version || ""),
        progress: 0,
      });
    });

    autoUpdater.on("download-progress", (progressObj) => {
      emit({
        state: "downloading",
        message: "更新下载中...",
        progress: Math.max(0, Math.min(100, Math.round(Number(progressObj?.percent || 0)))),
      });
    });

    autoUpdater.on("update-not-available", () => {
      emit({
        state: "idle",
        message: "当前已是最新版本",
        progress: 0,
      });
    });

    autoUpdater.on("update-downloaded", (info) => {
      emit({
        state: "downloaded",
        message: "新版本已下载，点击重启更新",
        version: String(info?.version || ""),
        progress: 100,
      });
    });

    autoUpdater.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("auto updater error", { message });
      emit({
        state: "error",
        message,
      });
    });
  }

  async function checkForUpdates({ silent = false } = {}) {
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

  function getStatus() {
    return status;
  }

  function installDownloaded() {
    if (!updaterAvailable || !autoUpdater) return false;
    if (status.state !== "downloaded") return false;
    setImmediate(() => {
      autoUpdater.quitAndInstall();
    });
    return true;
  }

  function startSilentCheck() {
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
