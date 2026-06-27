import * as db from '../db';
import { confirmModal } from '../components/modal';
import { showToast } from '../components/toast';
import { refreshAll, refreshSettings } from '../store';
import type { AppUser, Employee, Expense, Ingredient, MenuItem, Sale, Settings } from '../types';

const GIST_FILENAME = 'costmanager-data.json';
const GIST_DESCRIPTION = 'پشتیبان داده‌های منوبان (مدیریت‌شده توسط برنامه — ویرایش دستی نکنید)';
const GITHUB_API = 'https://api.github.com';

const ERR_NO_TOKEN = 'برای همگام‌سازی ابتدا توکن GitHub را در تنظیمات وارد کنید';
const ERR_NETWORK = 'خطا در اتصال — داده‌ها به‌صورت محلی ذخیره شدند';
const ERR_INVALID_TOKEN = 'توکن GitHub نامعتبر است — لطفاً توکن را بررسی کنید';

interface CloudPayload {
  exportedAt: string;
  version: '1.0';
  ingredients: Ingredient[];
  menu_items: MenuItem[];
  expenses: Expense[];
  employees: Employee[];
  sales: Sale[];
  settings: Omit<Settings, 'githubToken' | 'gistId'>;
  users: AppUser[];
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
}

async function buildPayload(): Promise<CloudPayload> {
  const [ingredients, menu_items, expenses, employees, sales, users, settings] = await Promise.all([
    db.listIngredients(),
    db.listMenuItems(),
    db.listExpenses(),
    db.listEmployees(),
    db.listSales(),
    db.listUsers(),
    db.getSettings(),
  ]);
  const { githubToken, gistId, ...rest } = settings;
  void githubToken;
  void gistId;
  return {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    ingredients,
    menu_items,
    expenses,
    employees,
    sales,
    settings: rest,
    users,
  };
}

export async function testConnection(token: string): Promise<{ ok: true; login: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${GITHUB_API}/user`, { headers: authHeaders(token) });
    if (res.status === 401) return { ok: false, error: ERR_INVALID_TOKEN };
    if (!res.ok) return { ok: false, error: ERR_NETWORK };
    const data = await res.json();
    return { ok: true, login: data.login };
  } catch {
    return { ok: false, error: ERR_NETWORK };
  }
}

async function fetchCloudPayload(token: string, gistId: string): Promise<CloudPayload | null> {
  const res = await fetch(`${GITHUB_API}/gists/${gistId}`, { headers: authHeaders(token) });
  if (!res.ok) return null;
  const gist = await res.json();
  const file = gist.files?.[GIST_FILENAME];
  if (!file?.content) return null;
  return JSON.parse(file.content) as CloudPayload;
}

export async function syncToCloud(): Promise<boolean> {
  const settings = await db.getSettings();
  const token = settings.githubToken?.trim();
  if (!token) {
    showToast(ERR_NO_TOKEN, 'error');
    return false;
  }
  try {
    const payload = await buildPayload();
    const body = {
      description: GIST_DESCRIPTION,
      public: false,
      files: { [GIST_FILENAME]: { content: JSON.stringify(payload, null, 2) } },
    };
    const res = settings.gistId
      ? await fetch(`${GITHUB_API}/gists/${settings.gistId}`, { method: 'PATCH', headers: authHeaders(token), body: JSON.stringify(body) })
      : await fetch(`${GITHUB_API}/gists`, { method: 'POST', headers: authHeaders(token), body: JSON.stringify(body) });

    if (res.status === 401) {
      showToast(ERR_INVALID_TOKEN, 'error');
      return false;
    }
    if (!res.ok) {
      showToast(ERR_NETWORK, 'error');
      return false;
    }
    const gist = await res.json();
    await db.updateSettings({ gistId: gist.id, lastSyncAt: new Date().toISOString() });
    await refreshSettings();
    showToast('همگام‌سازی انجام شد ✓', 'success');
    return true;
  } catch {
    showToast(ERR_NETWORK, 'error');
    return false;
  }
}

export async function syncFromCloud(opts: { skipConfirm?: boolean } = {}): Promise<boolean> {
  const settings = await db.getSettings();
  const token = settings.githubToken?.trim();
  if (!token) {
    showToast(ERR_NO_TOKEN, 'error');
    return false;
  }
  if (!settings.gistId) {
    showToast('هنوز هیچ نسخهٔ ابری ثبت نشده است', 'error');
    return false;
  }
  if (!opts.skipConfirm) {
    const confirmed = await confirmModal({
      title: 'دریافت از ابر',
      message: 'داده‌های محلی با نسخهٔ ابری جایگزین می‌شوند. ادامه می‌دهید؟',
      confirmLabel: 'دریافت و جایگزینی',
      danger: true,
    });
    if (!confirmed) return false;
  }
  try {
    const cloud = await fetchCloudPayload(token, settings.gistId);
    if (!cloud) {
      showToast(ERR_NETWORK, 'error');
      return false;
    }
    await db.importAllData(
      {
        exportedAt: cloud.exportedAt,
        version: 1,
        data: {
          ingredients: cloud.ingredients,
          menu_items: cloud.menu_items,
          expenses: cloud.expenses,
          employees: cloud.employees,
          sales: cloud.sales,
          shopping_list: [],
          settings: [{ ...cloud.settings, githubToken: settings.githubToken, gistId: settings.gistId } as Settings],
        },
      },
      'replace',
    );
    await db.replaceAuthUsers(cloud.users);
    await db.regenerateShoppingList();
    await db.updateSettings({ lastSyncAt: new Date().toISOString() });
    await refreshAll();
    showToast('داده‌ها از ابر دریافت شدند ✓', 'success');
    return true;
  } catch {
    showToast(ERR_NETWORK, 'error');
    return false;
  }
}

/** Checks for a newer cloud snapshot without applying it; caller decides how to prompt the user. */
export async function checkForNewerCloudVersion(): Promise<{ exportedAt: string } | null> {
  if (!navigator.onLine) return null;
  const settings = await db.getSettings();
  const token = settings.githubToken?.trim();
  if (!token || !settings.gistId) return null;
  try {
    const cloud = await fetchCloudPayload(token, settings.gistId);
    if (!cloud) return null;
    if (!settings.lastSyncAt || new Date(cloud.exportedAt) > new Date(settings.lastSyncAt)) {
      return { exportedAt: cloud.exportedAt };
    }
    return null;
  } catch {
    return null;
  }
}

let autoSyncWired = false;

/** Wires the offline->online auto-push trigger; safe to call multiple times (no-op after the first). */
export function setupAutoSync(): void {
  if (autoSyncWired) return;
  autoSyncWired = true;
  window.addEventListener('online', async () => {
    const settings = await db.getSettings();
    if (!settings.githubToken) return;
    showToast('اتصال برقرار شد — داده‌ها همگام‌سازی شدند', 'info');
    await syncToCloud();
  });
}
