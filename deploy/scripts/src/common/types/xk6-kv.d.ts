declare module 'k6/x/kv' {
  interface KvClient {
    get(key: string): Promise<unknown>
    set(key: string, value: unknown): Promise<void>
  }

  export function openKv(): KvClient
}
