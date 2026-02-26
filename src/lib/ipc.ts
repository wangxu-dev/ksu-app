type ElectronAPI = {
  invoke: <T = unknown>(channel: string, payload?: unknown) => Promise<T>;
  send: (channel: string, payload?: unknown) => void;
  on: (channel: string, listener: (payload: unknown) => void) => () => void;
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

export function ipcSend(channel: string, payload?: unknown): void {
  getElectronAPI().send(channel, payload);
}

export function ipcOn(channel: string, listener: (payload: unknown) => void): () => void {
  return getElectronAPI().on(channel, listener);
}
