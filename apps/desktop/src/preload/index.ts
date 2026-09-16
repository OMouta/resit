import { contextBridge, ipcRenderer } from "electron";
import { HEALTH_CHECK_CHANNEL, type DesktopApi } from "../shared/ipc";

const api: DesktopApi = {
  healthCheck: () => ipcRenderer.invoke(HEALTH_CHECK_CHANNEL),
};

contextBridge.exposeInMainWorld("resit", api);
