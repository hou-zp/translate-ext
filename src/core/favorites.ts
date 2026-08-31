import { browser } from 'wxt/browser';

export interface FavoriteEntry {
  id: string;
  text: string;
  translation: string;
  sourceLang: string;
  targetLang: string;
  /** hostname where the word was collected */
  host: string;
  /** unix ms */
  at: number;
}

const KEY = 'txe.favorites.v1';
const MAX_ENTRIES = 1000;

export async function listFavorites(): Promise<FavoriteEntry[]> {
  const got = await browser.storage.local.get(KEY);
  const list = got[KEY];
  return Array.isArray(list) ? (list as FavoriteEntry[]) : [];
}

export async function addFavorite(
  entry: Omit<FavoriteEntry, 'id' | 'at'>,
): Promise<FavoriteEntry> {
  const list = await listFavorites();
  const existing = list.find(
    (f) => f.text === entry.text && f.targetLang === entry.targetLang,
  );
  if (existing) return existing;
  const fav: FavoriteEntry = {
    ...entry,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
  };
  const next = [fav, ...list].slice(0, MAX_ENTRIES);
  await browser.storage.local.set({ [KEY]: next });
  return fav;
}

export async function removeFavorite(id: string): Promise<void> {
  const list = await listFavorites();
  await browser.storage.local.set({ [KEY]: list.filter((f) => f.id !== id) });
}

export async function clearFavorites(): Promise<void> {
  await browser.storage.local.remove(KEY);
}

function csvCell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Anki-importable CSV: front,back,tags */
export function favoritesToAnkiCsv(list: FavoriteEntry[]): string {
  const rows = list.map((f) =>
    [csvCell(f.text), csvCell(f.translation), csvCell(f.host)].join(','),
  );
  return rows.join('\n');
}
