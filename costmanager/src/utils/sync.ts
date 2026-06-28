import * as db from '../db';
import { confirmModal } from '../components/modal';
import { showToast } from '../components/toast';
import {
  customers, employees, expenses, ingredients, menuItems, refreshAll, sales, settings, shoppingList, smsLogs, syncStatus,
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

function serverBase(): string {
  return (settings.get()?.syncServerUrl ?? '').trim();
}

export async function pushToServer(opts: { silent?: boolean } = {}): Promise<{ ok: boolean; error?: string }> {
  const base = serverBase();
  if (!base || !navigator.onLine) return { ok: false, error: ERR_NETWORK };
  syncStatus.set('syncing');
  try {
    const payload = await buildPayload();
    const res = await fetchWithTimeout(`${base}/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      syncStatus.set('error');
      if (!opts.silent) showToast('ارسال داده به سرور ناموفق بود', 'error');
      return { ok: false, error: ERR_NETWORK };
    }
    await db.updateSettings({ lastSyncAt: new Date().toISOString() });
    syncStatus.set('synced');
    if (!opts.silent) showToast('داده‌ها با سرور همگام شد', 'success');
    return { ok: true };
  } catch {
    syncStatus.set('error');
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
    const res = await fetchWithTimeout(`${base}/pull?businessId=${encodeURIComponent(businessId)}`);
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
    if (!opts.silent) showToast(ERR_NETWORK, 'error');
    return { ok: false, error: ERR_NETWORK };
  }
}

export async function testSyncConnection(serverUrl: string): Promise<{ ok: boolean; error?: string }> {
  const base = serverUrl.trim();
  if (!base) return { ok: false, error: 'آدرس سرور را وارد کنید' };
  try {
    const res = await fetchWithTimeout(`${base}/ping`);
    return res.ok ? { ok: true } : { ok: false, error: ERR_NETWORK };
  } catch {
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
      await fetchWithTimeout(`${base}/code/${code}`, {
        method: 'POST',
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
      const res = await fetchWithTimeout(`${base}/code/${trimmed}`);
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
}
