import { LazyStore } from '@tauri-apps/plugin-store';

export const isTauriEnvironment = (): boolean =>
  typeof window !== 'undefined' &&
  Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

export const isCapacitorEnvironment = (): boolean =>
  typeof window !== 'undefined' &&
  !isTauriEnvironment() &&
  Boolean((window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());


export interface UniversalStore {
  entries<T = unknown>(): Promise<[string, T][]>;
  get<T>(key: string): Promise<T | null | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  save(): Promise<void>;
  clear(): Promise<void>;
  close?: () => Promise<void>;
}

class LocalStorageStore implements UniversalStore {
  private prefix: string;
  private legacyPrefix: string;

  constructor(filename: string) {
    this.prefix = `aurora_${filename}_`;
    this.legacyPrefix = `nuclear_${filename}_`;
  }

  async entries<T = unknown>(): Promise<[string, T][]> {
    const result: [string, T][] = [];
    if (typeof localStorage === 'undefined') {
      return result;
    }

    const seen = new Set<string>();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        const rawKey = key.slice(this.prefix.length);
        seen.add(rawKey);
        const value = this.deserialize<T>(localStorage.getItem(key));
        if (value !== null) {
          result.push([rawKey, value]);
        }
      } else if (key && key.startsWith(this.legacyPrefix)) {
        const rawKey = key.slice(this.legacyPrefix.length);
        if (!seen.has(rawKey)) {
          const value = this.deserialize<T>(localStorage.getItem(key));
          if (value !== null) {
            result.push([rawKey, value]);
          }
        }
      }
    }
    return result;
  }

  async get<T>(key: string): Promise<T | null> {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const raw =
      localStorage.getItem(`${this.prefix}${key}`) ??
      localStorage.getItem(`${this.legacyPrefix}${key}`);
    return this.deserialize<T>(raw);
  }

  async set(key: string, value: unknown): Promise<void> {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(`${this.prefix}${key}`, JSON.stringify(value));
    } catch {
      // Ignored if storage full
    }
  }

  async delete(key: string): Promise<boolean> {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    const itemKey = `${this.prefix}${key}`;
    const existed = localStorage.getItem(itemKey) !== null;
    localStorage.removeItem(itemKey);
    return existed;
  }

  async save(): Promise<void> {
    // localStorage is synchronous
  }

  async clear(): Promise<void> {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  }

  private deserialize<T>(raw: string | null): T | null {
    if (raw === null) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }
}

export const createUniversalStore = (filename: string): UniversalStore => {
  if (isTauriEnvironment()) {
    return new LazyStore(filename);
  }
  return new LocalStorageStore(filename);
};
