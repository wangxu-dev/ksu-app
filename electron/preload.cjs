const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
});
