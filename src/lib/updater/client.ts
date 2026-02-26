import { ipcInvoke, ipcOn } from "@/lib/ipc";
import {
  APP_UPDATE_CHECK_CHANNEL,
  APP_UPDATE_GET_STATUS_CHANNEL,
  APP_UPDATE_INSTALL_CHANNEL,
  APP_UPDATE_STATUS_CHANNEL,
} from "@/lib/updater/channels";

export type AppUpdateStatus = {
  state: "idle" | "checking" | "downloading" | "downloaded" | "error" | "unsupported";
  message?: string;
  version?: string;
  progress?: number;
  source?: string;
  updatedAt?: number;
};

export function getAppUpdateStatus(): Promise<AppUpdateStatus> {
  return ipcInvoke<AppUpdateStatus>(APP_UPDATE_GET_STATUS_CHANNEL);
}

export function checkAppUpdate(): Promise<AppUpdateStatus> {
  return ipcInvoke<AppUpdateStatus>(APP_UPDATE_CHECK_CHANNEL);
}

export function installAppUpdate(): Promise<{ ok: boolean }> {
  return ipcInvoke<{ ok: boolean }>(APP_UPDATE_INSTALL_CHANNEL);
}

export function onAppUpdateStatus(listener: (status: AppUpdateStatus) => void): () => void {
  return ipcOn(APP_UPDATE_STATUS_CHANNEL, (payload) => listener(payload as AppUpdateStatus));
}
