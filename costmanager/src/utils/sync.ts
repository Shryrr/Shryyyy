import * as db from '../db';
import type { StoreName } from '../db';
import { showToast } from '../components/toast';
import {
  automationTriggers, customers, employees, expenses, ingredients, isOnline, menuItems, notifications, refreshAll, sales, settings,
  shoppingList, smsLogs, suppliers, supplierPayments, syncStatus,
} from '../store';
import { api, ApiError, hasStoredSession } from './api';
import type { SyncRecord } from './api';

export const ERR_NETWORK = 'اتصال به سرور همگام‌سازی برقرار نشد';

const DEVICE_ID_KEY = 'syncDeviceId';
const EPOCH = '1970-01-01T00:00:00.000Z';

/**
 * Business-data stores synced record-level with the backend via /api/sync/{pull,push}.
 * Excludes 'settings' (per-device config, e.g. theme/apiBaseUrl) and 'subscription_payments_cache'
 * (a read-only local mirror of server-managed subscription_payments — never pushed back up).
 */
const SYNC_STORES: StoreName[] = [
  'ingredients', 'menu_items', 'expenses', 'employees', 'sales', 'shopping_list',
  'customers', 'sms_logs', 'notifications', 'waste', 'suppliers', 'supplier_payments',
  'automation_triggers', 'supplier_transactions', 'attendance', 'payroll_records',
  'salary_advances', 'petty_cash',
];

function isSyncStore(store: string): store is StoreName {
  return (SYNC_STORES as string[]).includes(store);
}

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** Pulls every record changed on the server since the last successful pull and applies it locally. */
export async function pullFromServer(opts: { silent?: boolean } = {}): Promise<{ ok: boolean; applied?: boolean; error?: string }> {
  if (!hasStoredSession() || !navigator.onLine) return { ok: false, error: ERR_NETWORK };
  syncStatus.set('syncing');
  try {
    const since = settings.get()?.lastSyncPulledAt || EPOCH;
    const { records, serverTime } = await api.syncPull(since, SYNC_STORES);
    for (const record of records) {
      if (!isSyncStore(record.store)) continue;
      await db.applySyncedRecord(record.store, record.id, record.isDeleted ? null : record.data);
    }
    await db.updateSettings({ lastSyncPulledAt: serverTime, lastSyncAt: new Date().toISOString() });
    if (records.length) await refreshAll();
    isOnline.set(true);
    syncStatus.set('synced');
    if (!opts.silent && records.length) showToast('داده‌ها از سرور دریافت شد', 'success');
    return { ok: true, applied: records.length > 0 };
  } catch (err) {
    syncStatus.set('error');
    if (err instanceof ApiError && err.status === 0) isOnline.set(false);
    if (!opts.silent) showToast(ERR_NETWORK, 'error');
    return { ok: false, error: ERR_NETWORK };
  }
}

/** Pushes a full snapshot of every syncable store plus any pending deletion tombstones. */
export async function pushToServer(opts: { silent?: boolean } = {}): Promise<{ ok: boolean; error?: string }> {
  if (!hasStoredSession() || !navigator.onLine) return { ok: false, error: ERR_NETWORK };
  syncStatus.set('syncing');
  const tombstones = db.consumeTombstones();
  try {
    const now = new Date().toISOString();
    const records: SyncRecord[] = [];
    for (const store of SYNC_STORES) {
      const rows = await db.getAllForSync(store);
      for (const row of rows) {
        records.push({ store, id: (row as { id: string }).id, data: row, updatedAt: now, isDeleted: false });
      }
    }
    for (const t of tombstones) {
      records.push({ store: t.store, id: t.id, data: null, updatedAt: t.deletedAt, isDeleted: true });
    }
    await api.syncPush(deviceId(), records);
    await db.updateSettings({ lastSyncAt: now });
    isOnline.set(true);
    syncStatus.set('synced');
    if (!opts.silent) showToast('داده‌ها با سرور همگام شد', 'success');
    return { ok: true };
  } catch (err) {
    db.requeueTombstones(tombstones);
    syncStatus.set('error');
    if (err instanceof ApiError && err.status === 0) isOnline.set(false);
    if (!opts.silent) showToast(ERR_NETWORK, 'error');
    return { ok: false, error: ERR_NETWORK };
  }
}

/** Pull-before-push: fold in remote changes first, then ship local changes (including tombstones). */
export async function syncNow(opts: { silent?: boolean } = {}): Promise<{ ok: boolean; error?: string }> {
  const pullResult = await pullFromServer({ silent: true });
  const pushResult = await pushToServer({ silent: true });
  const ok = pullResult.ok && pushResult.ok;
  if (!opts.silent) {
    if (ok) showToast('داده‌ها با سرور همگام شد', 'success');
    else showToast(pushResult.error ?? pullResult.error ?? ERR_NETWORK, 'error');
  }
  return { ok, error: ok ? undefined : (pushResult.error ?? pullResult.error) };
}

let autoSyncWired = false;

/** Syncs on load (if logged in), then debounced-pushes on local changes, pulls on reconnect, and polls periodically. Safe to call multiple times. */
export function setupAutoSync(): void {
  if (autoSyncWired) return;
  autoSyncWired = true;

  if (navigator.onLine && hasStoredSession()) void syncNow({ silent: true });

  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  function schedulePush(): void {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void pushToServer({ silent: true }), 1500);
  }

  for (const sig of [
    ingredients, menuItems, expenses, employees, sales, shoppingList, customers, smsLogs, automationTriggers, suppliers, supplierPayments,
    notifications,
  ]) {
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
    isOnline.set(true);
    void syncNow({ silent: true });
  });
  window.addEventListener('offline', () => isOnline.set(false));

  // Periodic pull doubles as a reachability probe: a successful round trip proves the API is
  // actually reachable, which navigator.onLine alone can't tell us (wrong WiFi, server down, etc.).
  setInterval(() => {
    if (navigator.onLine && hasStoredSession()) void pullFromServer({ silent: true });
  }, 20000);
}
