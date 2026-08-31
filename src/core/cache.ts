import { browser } from 'wxt/browser';

const STORAGE_KEY = 'tx-cache-v1';
const MAX_ENTRIES = 5000;
const PERSIST_DEBOUNCE_MS = 3000;

/** FNV-1a string hash, good enough for cache keys. */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function cacheKey(parts: {
  provider: string;
  model?: string;
  from: string;
  to: string;
  expertId?: string;
  refined?: boolean;
  text: string;
}): string {
  const prefix = [
    parts.provider,
    parts.model ?? '',
    parts.from,
    parts.to,
    parts.expertId ?? '',
    parts.refined ? 'r' : '',
  ].join('|');
  return `${fnv1a(prefix)}:${fnv1a(parts.text)}:${parts.text.length}`;
}

/**
 * LRU translation cache living in the background service worker,
 * persisted (debounced) to storage.local so it survives worker restarts.
 */
export class TranslationCache {
  private map = new Map<string, string>();
  private loaded = false;
  private persistTimer: ReturnType<typeof setTimeout> | undefined;

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const data = await browser.storage.local.get(STORAGE_KEY);
      const entries = data[STORAGE_KEY] as [string, string][] | undefined;
      if (Array.isArray(entries)) {
        for (const [k, v] of entries) this.map.set(k, v);
      }
    } catch {
      // corrupted cache is not fatal
    }
  }

  get(key: string): string | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      // refresh LRU position
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }

  set(key: string, value: string): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > MAX_ENTRIES) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
    this.schedulePersist();
  }

  stats(): { entries: number; chars: number } {
    let chars = 0;
    for (const v of this.map.values()) chars += v.length;
    return { entries: this.map.size, chars };
  }

  async clear(): Promise<void> {
    this.map.clear();
    await browser.storage.local.remove(STORAGE_KEY);
  }

  private schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      void browser.storage.local.set({ [STORAGE_KEY]: [...this.map.entries()] });
    }, PERSIST_DEBOUNCE_MS);
  }
}
