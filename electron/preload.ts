import { contextBridge, ipcRenderer } from 'electron';
import type { GlacierApi } from './api';

const api: GlacierApi = {
  ping: () => ipcRenderer.invoke('app:ping'),
};

contextBridge.exposeInMainWorld('glacierApi', api);
