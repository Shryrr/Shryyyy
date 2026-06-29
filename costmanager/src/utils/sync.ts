import * as db from '../db';
import { confirmModal } from '../components/modal';
import { showToast } from '../components/toast';
import {
  customers, employees, expenses, ingredients, isOnline, menuItems, refreshAll, sales, settings, shoppingList, smsLogs, syncStatus,
} from '../store';
import type { AppUser, FullBackup } from '../types';

const FETCH_TIMEOUT_MS = 6000;
const SYNC_CODE_PREFIX = 'synccode:';

export const ERR_NETWORK = 'اتصال به سرور همگام‌سازی برقرار نشد';
export const ERR_NOT_FOUND = 'کد یافت نشد یا منقضی شده است';

interface SyncPayload {
  exportedAt: string;
  version: '1.0';
  businessId: string;
  businessName: string;
  backup: FullBackup;
  users: AppUser[];
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function buildPayload(): Promise<SyncPayload> {
  const s = await db.getSettings();
  const backup = await db.exportAllData();
  const users = await db.listUsers();
  return {
    exportedAt: backup.exportedAt,
    version: '1.0',
    businessId: s.businessId,
    businessName: s.businessName,
    backup,
    users,
  };
}

/** Applies a remote payload locally, preserving this device's own connection setting (server URL). */
async function applyPayload(payload: SyncPayload): Promise<void> {
  const local = await db.getSettings();
  const backup: FullBackup = {
    ...payload.backup,
    data: {
      ...payload.backup.data,
      settings: payload.backup.data.settings.map((s) => ({ ...s, syncServerUrl: local.syncServerUrl })),
    },
  };
  await db.importAllData(backup, 'replace');
  await db.replaceAuthUsers(payload.users);
  await db.regenerateShoppingList();
  await db.updateSettings({ businessId: payload.businessId, lastSyncAt: new Date().toISOString() });
  await refreshAll();
}

function normalizeBase(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function serverBase(): string {
  return normalizeBase(settings.get()?.syncServerUrl ?? '');
}

interface RegistryEntry {
  businessId: string;
  businessName: string;
  lastSyncAt: string;
  userCount: number;
}

interface Registry {
  businesses: RegistryEntry[];
}

/**
 * There is no listing endpoint on a static WebDAV directory, so the platform admin panel can't
 * just ask the server "what businesses exist". Instead every successful push upserts this
 * business's summary into a shared `_registry.json` file via a best-effort GET-merge-PUT.
 * Failures here must never affect the result of the business-data push itself.
 */
async function updateRegistry(payload: SyncPayload, base: string): Promise<void> {
  const registryUrl = `${base}/_registry.json`;
  let registry: Registry = { businesses: [] };
  try {
    const res = await fetchWithTimeout(registryUrl);
    if (res.ok) {
      const data = (await res.json()) as Registry;
      if (Array.isArray(data?.businesses)) registry = data;
    }
  } catch {
    // Registry missing or unreachable — start fresh.
  }

  const entry: RegistryEntry = {
    businessId: payload.businessId,
    businessName: payload.businessName,
    lastSyncAt: payload.exportedAt,
    userCount: payload.users.length,
  };
  const idx = registry.businesses.findIndex((b) => b.businessId === entry.businessId);
  if (idx >= 0) registry.businesses[idx] = entry;
  else registry.businesses.push(entry);

  try {
    await fetchWithTimeout(registryUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registry),
    });
  } catch {
    // Best-effort: the business data push itself already succeeded.
  }
}

/**
 * The sync "server" is just a plain WebDAV directory (e.g. Nginx with `dav_methods PUT`) —
 * each business's data lives at `{base}/{businessId}.json` as a static file, written with PUT
 * and read with GET. There is no application backend on the other end.
 */
export async function pushToServer(opts: { silent?: boolean } = {}): Promise<{ ok: boolean; error?: string }> {
  const base = serverBase();
  if (!base || !navigator.onLine) return { ok: false, error: ERR_NETWORK };
  syncStatus.set('syncing');
  try {
    const payload = await buildPayload();
    const res = await fetchWithTimeout(`${base}/${encodeURIComponent(payload.businessId)}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // The round trip reached the server at all — proves real connectivity regardless of
    // the HTTP outcome, which navigator.onLine alone can't tell us.
    isOnline.set(true);
    if (!res.ok) {
      syncStatus.set('error');
      if (!opts.silent) showToast('ارسال داده به سرور ناموفق بود', 'error');
      return { ok: false, error: ERR_NETWORK };
    }
    await updateRegistry(payload, base);
    await db.updateSettings({ lastSyncAt: new Date().toISOString() });
    syncStatus.set('synced');
    if (!opts.silent) showToast('داده‌ها با سرور همگام شد', 'success');
    return { ok: true };
  } catch {
    syncStatus.set('error');
    isOnline.set(false);
    if (!opts.silent) showToast(ERR_NETWORK, 'error');
    return { ok: false, error: ERR_NETWORK };
  }
}

export async function pullFromServer(
  opts: { silent?: boolean; skipConfirm?: boolean } = {},
): Promise<{ ok: boolean; applied?: boolean; error?: string }> {
  const base = serverBase();
  const businessId = settings.get()?.businessId;
  if (!base || !businessId || !navigator.onLine) return { ok: false, error: ERR_NETWORK };
  syncStatus.set('syncing');
  try {
    const res = await fetchWithTimeout(`${base}/${encodeURIComponent(businessId)}.json`);
    isOnline.set(true);
    if (res.status === 404) {
      // Nothing has ever been pushed for this business yet — not an error.
      syncStatus.set('synced');
      return { ok: true, applied: false };
    }
    if (!res.ok) {
      syncStatus.set('error');
      return { ok: false, error: ERR_NETWORK };
    }
    const payload = (await res.json()) as SyncPayload;
    const cur = settings.get();
    if (cur?.lastSyncAt && payload.exportedAt <= cur.lastSyncAt) {
      syncStatus.set('synced');
      return { ok: true, applied: false };
    }
    if (!opts.skipConfirm) {
      const confirmed = await confirmModal({
        title: 'دریافت داده از سرور',
        message: 'نسخهٔ جدیدتری از داده‌های این کسب‌وکار روی سرور موجود است. داده‌های فعلی این دستگاه با آن جایگزین شود؟',
        confirmLabel: 'دریافت و جایگزینی',
      });
      if (!confirmed) {
        syncStatus.set('idle');
        return { ok: true, applied: false };
      }
    }
    await applyPayload(payload);
    syncStatus.set('synced');
    if (!opts.silent) showToast('داده‌ها از سرور دریافت شد', 'success');
    return { ok: true, applied: true };
  } catch {
    syncStatus.set('error');
    isOnline.set(false);
    if (!opts.silent) showToast(ERR_NETWORK, 'error');
    return { ok: false, error: ERR_NETWORK };
  }
}

/** There's no `/ping` route on a static file server — any HTTP response (even 403/404) means the address is reachable. */
export async function testSyncConnection(serverUrl: string): Promise<{ ok: boolean; error?: string }> {
  const base = normalizeBase(serverUrl);
  if (!base) return { ok: false, error: 'آدرس سرور را وارد کنید' };
  try {
    await fetchWithTimeout(`${base}/`);
    isOnline.set(true);
    return { ok: true };
  } catch {
    isOnline.set(false);
    return { ok: false, error: ERR_NETWORK };
  }
}

function randomSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Exports current data to a short shareable code: stored locally and best-effort pushed to the server. */
export async function generateSyncCode(): Promise<string> {
  const payload = await buildPayload();
  const code = randomSixDigitCode();
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  localStorage.setItem(`${SYNC_CODE_PREFIX}${code}`, encoded);

  const base = serverBase();
  if (base && navigator.onLine) {
    try {
      await fetchWithTimeout(`${base}/codes/${code}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // Silent fallback: the code still works locally; cross-device pickup just needs the server reachable.
    }
  }
  return code;
}

/** Imports data from a 6-digit sync code: checks local storage first, then falls back to the server. */
export async function importFromSyncCode(code: string, opts: { skipConfirm?: boolean } = {}): Promise<{ ok: boolean; error?: string }> {
  const trimmed = code.trim();
  let payload: SyncPayload | null = null;

  const local = localStorage.getItem(`${SYNC_CODE_PREFIX}${trimmed}`);
  if (local) {
    try {
      payload = JSON.parse(decodeURIComponent(escape(atob(local)))) as SyncPayload;
    } catch {
      payload = null;
    }
  }

  if (!payload) {
    const base = serverBase();
    if (!base || !navigator.onLine) return { ok: false, error: ERR_NOT_FOUND };
    try {
      const res = await fetchWithTimeout(`${base}/codes/${trimmed}.json`);
      if (!res.ok) return { ok: false, error: ERR_NOT_FOUND };
      payload = (await res.json()) as SyncPayload;
    } catch {
      return { ok: false, error: ERR_NETWORK };
    }
  }

  if (!opts.skipConfirm) {
    const confirmed = await confirmModal({
      title: 'دریافت داده با کد همگام‌سازی',
      message: `داده‌های کسب‌وکار «${payload.businessName}» جایگزین داده‌های فعلی این دستگاه می‌شود. ادامه می‌دهید؟`,
      confirmLabel: 'جایگزینی',
      danger: true,
    });
    if (!confirmed) return { ok: false };
  }

  await applyPayload(payload);
  showToast('داده‌ها با موفقیت دریافت شد', 'success');
  return { ok: true };
}

let autoSyncWired = false;

/** Pulls the latest data on load, then silently pushes whenever local data changes (debounced). Safe to call multiple times. */
export function setupAutoSync(): void {
  if (autoSyncWired) return;
  autoSyncWired = true;

  if (navigator.onLine) {
    void pullFromServer({ silent: true, skipConfirm: true });
  }

  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  function schedulePush(): void {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void pushToServer({ silent: true }), 1500);
  }

  for (const sig of [ingredients, menuItems, expenses, employees, sales, shoppingList, customers, smsLogs]) {
    let first = true;
    sig.subscribe(() => {
      if (first) {
        first = false;
        return;
      }
      schedulePush();
    });
  }

  window.addEventListener('online', () => {
    void pullFromServer({ silent: true, skipConfirm: true });
  });

  // navigator.onLine only reflects whether the device has a network interface up — a device
  // can be "online" on that signal while the configured sync server itself is unreachable
  // (wrong WiFi, firewall, server down). Correct the indicator with a real probe.
  function checkReachability(): void {
    const base = serverBase();
    if (!base || !navigator.onLine) return;
    void testSyncConnection(base);
  }
  checkReachability();
  setInterval(checkReachability, 20000);
}
