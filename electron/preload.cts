type ElectronBridge = {
  invoke: (channel: string, payload?: unknown) => Promise<unknown>;
  send: (channel: string, payload?: unknown) => void;
  on: (channel: string, listener: (payload: unknown) => void) => () => void;
};

const { contextBridge, ipcRenderer } = require("electron");

const electronAPI: ElectronBridge = {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  send: (channel, payload) => ipcRenderer.send(channel, payload),
  on: (channel, listener) => {
    const wrapped = (_event: unknown, payload: unknown) => listener(payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
