/**
 * Persistence seam: localStorage on web now, Capacitor Preferences in Phase 4.
 * (Named KVStore to avoid colliding with the DOM's Storage type.)
 */
export interface KVStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export class LocalStorageStore implements KVStore {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private-mode/quota failures degrade to session-only persistence.
    }
  }
}

/** Deterministic in-memory store for tests and headless sims. */
export class MemoryStore implements KVStore {
  private map = new Map<string, string>();

  get(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.map.set(key, value);
  }
}
