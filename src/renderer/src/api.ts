import type { ElectronAPI } from '../../preload/types';

export const api: ElectronAPI = new Proxy({} as ElectronAPI, {
  get(_target, property: keyof ElectronAPI) {
    return window.electronAPI[property];
  },
});
