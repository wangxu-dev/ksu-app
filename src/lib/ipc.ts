type ElectronAPI = {
  invoke: <T = unknown>(channel: string, payload?: unknown) => Promise<T>;
};

function getElectronAPI(): ElectronAPI {
  const api = (window as Window & { electronAPI?: ElectronAPI }).electronAPI;
  if (!api) {
    throw new Error("electronAPI unavailable. Run inside Electron.");
  }
  return api;
}

export function ipcInvoke<T = unknown>(channel: string, payload?: unknown): Promise<T> {
  return getElectronAPI().invoke<T>(channel, payload);
}
