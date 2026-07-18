import { contextBridge, ipcRenderer } from 'electron';
import type { GlacierApi, NoteCreateInput, NoteFilter, NoteUpdatePatch } from './api';

const api: GlacierApi = {
  ping: () => ipcRenderer.invoke('app:ping'),
  notebooks: {
    list: () => ipcRenderer.invoke('notebooks:list'),
    create: (name: string) => ipcRenderer.invoke('notebooks:create', name),
    update: (id: string, patch) => ipcRenderer.invoke('notebooks:update', id, patch),
    delete: (id: string) => ipcRenderer.invoke('notebooks:delete', id),
    getDefaultId: () => ipcRenderer.invoke('notebooks:getDefaultId'),
  },
  notes: {
    list: (filter?: NoteFilter) => ipcRenderer.invoke('notes:list', filter),
    get: (id: string) => ipcRenderer.invoke('notes:get', id),
    create: (input: NoteCreateInput) => ipcRenderer.invoke('notes:create', input),
    update: (id: string, patch: NoteUpdatePatch) => ipcRenderer.invoke('notes:update', id, patch),
    trash: (id: string) => ipcRenderer.invoke('notes:trash', id),
    restore: (id: string) => ipcRenderer.invoke('notes:restore', id),
    purge: (id: string) => ipcRenderer.invoke('notes:purge', id),
    move: (id: string, notebookId: string) => ipcRenderer.invoke('notes:move', id, notebookId),
  },
  labels: {
    list: () => ipcRenderer.invoke('labels:list'),
    create: (name: string) => ipcRenderer.invoke('labels:create', name),
    update: (id: string, patch) => ipcRenderer.invoke('labels:update', id, patch),
    delete: (id: string) => ipcRenderer.invoke('labels:delete', id),
  },
  images: {
    add: (data: Uint8Array, mimeType: string, fileName?: string) =>
      ipcRenderer.invoke('images:add', data, mimeType, fileName),
    getDataUrl: (id: string) => ipcRenderer.invoke('images:getDataUrl', id),
    delete: (id: string) => ipcRenderer.invoke('images:delete', id),
    deleteIfUnreferenced: (id: string) => ipcRenderer.invoke('images:deleteIfUnreferenced', id),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
};

contextBridge.exposeInMainWorld('glacierApi', api);
