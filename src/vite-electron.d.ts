export {};

declare global {
  interface Window {
    electronAPI?: {
      invoke: <T = unknown>(channel: string, payload?: unknown) => Promise<T>;
    };
  }
}
