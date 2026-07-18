import type { GlacierApi } from '../../electron/api';

declare global {
  interface Window {
    glacierApi: GlacierApi;
  }
}

export {};
