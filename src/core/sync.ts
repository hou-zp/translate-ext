import { browser } from 'wxt/browser';
import { loadConfig, onConfigChanged, replaceConfig, type AppConfig } from './config';
import { listFavorites, type FavoriteEntry } from './favorites';

// ---------------------------------------------------------------------------
// chrome.storage.sync mirror (small config, automatic, last-write-wins)
// ---------------------------------------------------------------------------

const SYNC_KEY = 'app-config-sync';

interface SyncPayload {
  cfg: AppConfig;
  at: number;
}

let applyingRemote = false;
let mirrorTimer: ReturnType<typeof setTimeout> | undefined;
let lastMirrored = '';

function stripBulky(cfg: AppConfig): AppConfig {
  // subscribedRules can be re-fetched and may blow the 8KB sync item quota
  return { ...cfg, subscribedRules: [] };
}

async function mirrorToSync(cfg: AppConfig): Promise<void> {
  const slim = stripBulky(cfg);
  const json = JSON.stringify(slim);
  if (json === lastMirrored) return;
  if (json.length > 7500) return; // stay under the per-item quota
  lastMirrored = json;
  const payload: SyncPayload = { cfg: slim, at: Date.now() };
  try {
    await browser.storage.sync.set({ [SYNC_KEY]: payload });
  } catch {
    // sync quota exceeded or sync disabled by the browser: ignore
  }
}

async function applyFromSync(payload: SyncPayload): Promise<void> {
  const local = await loadConfig();
  if (!local.syncEnabled) return;
  const localJson = JSON.stringify(stripBulky(local));
  const remoteJson = JSON.stringify(payload.cfg);
  if (localJson === remoteJson) return;
  applyingRemote = true;
  try {
    // keep locally-fetched subscribed rules
    await replaceConfig({ ...payload.cfg, subscribedRules: local.subscribedRules });
    lastMirrored = remoteJson;
  } finally {
    applyingRemote = false;
  }
}

/**
 * Start the automatic chrome.storage.sync mirror (call once from background).
 * On startup the newer side wins; afterwards changes propagate both ways.
 */
export function startConfigSync(): void {
  void (async () => {
    const cfg = await loadConfig();
    if (cfg.syncEnabled) {
      const got = await browser.storage.sync.get(SYNC_KEY);
      const payload = got[SYNC_KEY] as SyncPayload | undefined;
      if (payload?.cfg) await applyFromSync(payload);
    }
  })();

  onConfigChanged((cfg) => {
    if (!cfg.syncEnabled || applyingRemote) return;
    if (mirrorTimer) clearTimeout(mirrorTimer);
    mirrorTimer = setTimeout(() => void mirrorToSync(cfg), 2000);
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || applyingRemote) return;
    const change = changes[SYNC_KEY];
    if (change?.newValue) void applyFromSync(change.newValue as SyncPayload);
  });
}

// ---------------------------------------------------------------------------
// WebDAV backup (full config + favorites, manual upload / download)
// ---------------------------------------------------------------------------

const BACKUP_FILE = 'translate-ext-backup.json';

export interface WebdavBackup {
  config: AppConfig;
  favorites: FavoriteEntry[];
  exportedAt: string;
}

function davTarget(cfg: AppConfig): { url: string; headers: Record<string, string> } {
  const base = cfg.webdavUrl.trim().replace(/\/$/, '');
  if (!base) throw new Error('请先填写 WebDAV 地址');
  const headers: Record<string, string> = {};
  if (cfg.webdavUser) {
    headers.Authorization = `Basic ${btoa(`${cfg.webdavUser}:${cfg.webdavPass}`)}`;
  }
  return { url: `${base}/${BACKUP_FILE}`, headers };
}

export async function webdavUpload(cfg: AppConfig): Promise<void> {
  const { url, headers } = davTarget(cfg);
  const backup: WebdavBackup = {
    config: cfg,
    favorites: await listFavorites(),
    exportedAt: new Date().toISOString(),
  };
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(backup),
  });
  if (!res.ok) throw new Error(`上传失败 HTTP ${res.status}`);
}

export async function webdavDownload(cfg: AppConfig): Promise<WebdavBackup> {
  const { url, headers } = davTarget(cfg);
  const res = await fetch(url, { headers });
  if (res.status === 404) throw new Error('云端还没有备份文件，请先上传一次');
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`);
  const backup = (await res.json()) as WebdavBackup;
  if (!backup.config) throw new Error('备份文件格式不正确');
  return backup;
}

/** Apply a downloaded backup: replace config and merge favorites. */
export async function applyBackup(backup: WebdavBackup): Promise<void> {
  // keep the local WebDAV credentials so the user stays connected
  const local = await loadConfig();
  await replaceConfig({
    ...backup.config,
    webdavUrl: local.webdavUrl || backup.config.webdavUrl,
    webdavUser: local.webdavUser || backup.config.webdavUser,
    webdavPass: local.webdavPass || backup.config.webdavPass,
  });
  if (Array.isArray(backup.favorites) && backup.favorites.length > 0) {
    const existing = await listFavorites();
    const seen = new Set(existing.map((f) => f.id));
    const merged = [...existing, ...backup.favorites.filter((f) => !seen.has(f.id))].sort(
      (a, b) => b.at - a.at,
    );
    await browser.storage.local.set({ 'txe.favorites.v1': merged.slice(0, 1000) });
  }
}
