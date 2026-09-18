import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import {
  CHANNELS,
  EVENT_CHANNEL,
  HEALTH_CHECK_CHANNEL,
  type DesktopApi,
  type DesktopEvent,
} from "../shared/ipc";

const invokers = Object.fromEntries(
  Object.entries(CHANNELS).map(([name, channel]) => [
    name,
    (...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  ]),
);

const api = {
  healthCheck: () => ipcRenderer.invoke(HEALTH_CHECK_CHANNEL),
  ...invokers,
  onEvent: (listener: (event: DesktopEvent) => void) => {
    const handler = (_event: IpcRendererEvent, payload: DesktopEvent) =>
      listener(payload);
    ipcRenderer.on(EVENT_CHANNEL, handler);
    return () => {
      ipcRenderer.removeListener(EVENT_CHANNEL, handler);
    };
  },
} as DesktopApi;

contextBridge.exposeInMainWorld("resit", api);
