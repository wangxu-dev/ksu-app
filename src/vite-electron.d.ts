export {};

declare global {
  type UnsubscribeFn = () => void;

  interface Window {
    electronAPI?: {
      invoke: <T = unknown>(channel: string, payload?: unknown) => Promise<T>;
      send: (channel: string, payload?: unknown) => void;
      on: (channel: string, listener: (payload: unknown) => void) => UnsubscribeFn;
    };
  }
}
