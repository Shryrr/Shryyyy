import * as db from './db';
import { createAlertBanner } from './components/alert-banner';
import { createAppNav } from './components/bottom-nav';
import { confirmModal } from './components/modal';
import { createNotificationBell } from './components/notification-bell';
import { showToast } from './components/toast';
import { el, emptyState } from './utils/dom';
import { currentPath, navigate, registerRoutes, startRouter } from './router';
import type { Route, RouteCleanup } from './router';
import { initOnlineWatcher, initThemeWatcher, isOnline, refreshAll, settings, syncStatus } from './store';
import { seedDatabase } from './seed';
import { daysUntilBusinessExpiry, isBusinessExpired, isBusinessExpiringSoon, logout, restoreSession, takeSessionExpiredReason } from './auth';
import { initLowStockWatcher, requestNotificationPermission, setNotificationBannerHost } from './utils/notifications';
import { formatDate, toPersian } from './utils/format';
import { setupAutoSync } from './utils/sync';
import { isPlatformOwnerSession } from './platform-owner';
import { renderAuthGate } from './views/login';
import { openPlatformOwnerPanel } from './views/platform-admin';
import { renderAccounting } from './views/accounting';
import { renderAdmin } from './views/admin';
import { renderCrm } from './views/crm';
import { renderDashboard } from './views/dashboard';
import { renderExpenses } from './views/expenses';
import { renderIngredients } from './views/ingredients';
import { renderRecipes } from './views/recipes';
import { renderSales } from './views/sales';
import { renderSettings } from './views/settings';
import { maybeShowBuyerLowStockAlert, renderShopping } from './views/shopping';
import type { AppUser, UserRole } from './types';

const HEADER_LINKS: { path: string; label: string; icon: string; roles?: UserRole[] }[] = [
  { path: '/sales', label: 'فروش', icon: '🧾', roles: ['superadmin', 'manager'] },
  { path: '/expenses', label: 'هزینه‌ها و حقوق', icon: '💸', roles: ['superadmin', 'manager'] },
  { path: '/shopping', label: 'لیست خرید', icon: '🛒', roles: ['superadmin', 'manager'] },
  { path: '/admin', label: 'مدیریت', icon: '🛠️', roles: ['superadmin'] },
  { path: '/settings', label: 'تنظیمات', icon: '⚙️', roles: ['superadmin'] },
];

const ALL_ROUTES: (Route & { roles: UserRole[] })[] = [
  { path: '/', title: 'داشبورد', render: renderDashboard, roles: ['superadmin', 'manager'] },
  { path: '/ingredients', title: 'انبار مواد اولیه', render: renderIngredients, roles: ['superadmin', 'manager', 'warehouse'] },
  { path: '/recipes', title: 'منو و فودکاست', render: renderRecipes, roles: ['superadmin', 'manager'] },
  { path: '/expenses', title: 'هزینه‌ها و حقوق', render: renderExpenses, roles: ['superadmin', 'manager'] },
  { path: '/sales', title: 'فروش', render: renderSales, roles: ['superadmin', 'manager'] },
  { path: '/accounting', title: 'حسابداری و سود و زیان', render: renderAccounting, roles: ['superadmin', 'manager'] },
  { path: '/crm', title: 'CRM', render: renderCrm, roles: ['superadmin', 'manager'] },
  { path: '/shopping', title: 'لیست خرید', render: renderShopping, roles: ['superadmin', 'manager', 'warehouse', 'buyer'] },
  { path: '/settings', title: 'تنظیمات', render: renderSettings, roles: ['superadmin'] },
  { path: '/admin', title: 'مدیریت', render: renderAdmin, roles: ['superadmin'] },
];

function renderAccessDenied(container: HTMLElement): RouteCleanup {
  container.appendChild(
    el('div', { class: 'view view-access-denied' }, [
      emptyState({ icon: '🚫', title: 'دسترسی ندارید', message: 'شما اجازهٔ دسترسی به این بخش را ندارید.' }),
    ]),
  );
}

const SYNC_STATUS_ICON: Record<string, string> = { idle: '', syncing: '🔄', synced: '✓', error: '⚠' };
const SYNC_STATUS_LABEL: Record<string, string> = {
  idle: '',
  syncing: 'در حال همگام‌سازی…',
  synced: 'همگام‌سازی شد',
  error: 'خطا در همگام‌سازی',
};

function openPlatformOwnerOverlay(): void {
  const overlay = el('div', { class: 'platform-admin-overlay' });
  document.body.appendChild(overlay);
  openPlatformOwnerPanel(overlay, () => overlay.remove());
}

const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'مدیر اصلی',
  manager: 'مدیر',
  warehouse: 'انباردار',
  buyer: 'خریدار',
};

async function handleLogoutClick(): Promise<void> {
  const confirmed = await confirmModal({
    title: 'خروج از حساب',
    message: 'آیا می‌خواهید خارج شوید؟',
    confirmLabel: 'خروج',
    danger: true,
  });
  if (confirmed) logout();
}

function createAppHeader(user: AppUser): HTMLElement {
  const offlineBadge = el('span', { class: 'app-header__offline-badge' }, ['آفلاین']);
  offlineBadge.hidden = true;

  const syncBadge = el('span', { class: 'app-header__sync-badge' }, ['']);
  syncBadge.hidden = true;

  const links = HEADER_LINKS.filter((link) => !link.roles || link.roles.includes(user.role));

  const actions = el(
    'div',
    { class: 'app-header__actions' },
    links.map((link) => {
      const btn = el('button', { type: 'button', class: 'app-header__icon-btn', title: link.label, onclick: () => navigate(link.path) }, [
        link.icon,
      ]);
      btn.setAttribute('aria-label', link.label);
      return btn;
    }),
  );

  if (isPlatformOwnerSession()) {
    const platformBtn = el(
      'button',
      { type: 'button', class: 'app-header__icon-btn', title: 'پنل پلتفرم', onclick: openPlatformOwnerOverlay },
      ['🔧'],
    );
    platformBtn.setAttribute('aria-label', 'پنل پلتفرم');
    actions.appendChild(platformBtn);
  }

  const userChip = el('span', { class: 'app-header__user-chip' }, [`${user.name} (${ROLE_LABELS[user.role]})`]);
  const logoutBtn = el('button', { type: 'button', class: 'app-header__icon-btn', title: 'خروج', onclick: handleLogoutClick }, ['🚪']);
  logoutBtn.setAttribute('aria-label', 'خروج');
  actions.append(createNotificationBell(user), userChip, logoutBtn);

  const header = el('header', { class: 'app-header' }, [el('span', { class: 'app-header__logo' }, ['منوبان']), offlineBadge, syncBadge, actions]);

  isOnline.subscribe((online) => {
    offlineBadge.hidden = online;
  });

  syncStatus.subscribe((status) => {
    syncBadge.hidden = status === 'idle';
    syncBadge.textContent = SYNC_STATUS_ICON[status];
    syncBadge.title = SYNC_STATUS_LABEL[status];
    syncBadge.className = `app-header__sync-badge app-header__sync-badge--${status}`;
  });

  return header;
}

function createBreadcrumb(routes: (Route & { roles: UserRole[] })[]): HTMLElement {
  const bar = el('nav', { class: 'breadcrumb', 'aria-label': 'مسیر دسترسی' });

  currentPath.subscribe((path) => {
    const route = routes.find((r) => r.path === path);
    bar.innerHTML = '';
    const home = el('button', { type: 'button', class: 'breadcrumb__item', onclick: () => navigate('/') }, ['🏠 داشبورد']);
    if (path === '/' || !route) {
      home.classList.add('breadcrumb__item--current');
      bar.appendChild(home);
      return;
    }
    bar.append(home, el('span', { class: 'breadcrumb__sep' }, ['/']), el('span', { class: 'breadcrumb__item--current' }, [route.title]));
  });

  return bar;
}

function renderExpiredScreen(app: HTMLElement, expiry: string): void {
  app.append(
    el('div', { class: 'boot-splash', role: 'alert' }, [
      el('div', { class: 'auth-card' }, [
        el('div', { class: 'boot-logo' }, ['⛔']),
        el('h2', { class: 'auth-title' }, ['اشتراک شما منقضی شده است']),
        el('p', { class: 'auth-subtitle' }, [`اشتراک کسب‌وکار شما در ${formatDate(expiry)} منقضی شده`]),
        el('p', { class: 'auth-subtitle' }, ['برای تمدید با مدیر اصلی تماس بگیرید']),
        el('button', { type: 'button', class: 'btn btn-secondary', onclick: logout }, ['خروج از حساب']),
      ]),
    ]),
  );
}

async function bootstrap(): Promise<void> {
  console.log('[boot] starting');
  initThemeWatcher();
  initOnlineWatcher();
  setupAutoSync();
  console.log('[boot] watchers initialized');

  const empty = await db.isDatabaseEmpty();
  console.log('[boot] isDatabaseEmpty:', empty);
  if (empty) {
    console.log('[boot] seeding database...');
    await seedDatabase();
    console.log('[boot] seeding complete');
  }

  console.log('[boot] refreshing store...');
  await refreshAll();
  console.log('[boot] store refreshed');

  const app = document.getElementById('app');
  if (!app) {
    console.error('[boot] #app element not found, aborting');
    return;
  }

  const sessionExpiredReason = takeSessionExpiredReason();
  if (sessionExpiredReason) showToast(sessionExpiredReason, 'error', 4000);

  const user = (await restoreSession()) ?? (await renderAuthGate(app));
  console.log('[boot] authenticated as', user.role);

  setNotificationBannerHost(app);
  initLowStockWatcher();
  await requestNotificationPermission();

  app.innerHTML = '';

  const businessSettings = settings.get() ?? (await db.getSettings());

  if (isBusinessExpired(businessSettings)) {
    renderExpiredScreen(app, businessSettings.subscriptionExpiry);
    console.log('[boot] subscription expired, blocking app');
    return;
  }

  const main = el('main', { class: 'app-main' });
  const bannerHost = el('div', { class: 'app-banner-host' });

  app.append(createAppHeader(user), createBreadcrumb(ALL_ROUTES), bannerHost, main, createAppNav());

  if (isBusinessExpiringSoon(businessSettings)) {
    const days = daysUntilBusinessExpiry(businessSettings);
    const banner = createAlertBanner({
      id: 'subscription-expiring',
      message: `اشتراک کسب‌وکار شما تا ${toPersian(days)} روز دیگر منقضی می‌شود.`,
      tone: 'warning',
    });
    if (banner) bannerHost.appendChild(banner);
  }

  registerRoutes(
    ALL_ROUTES.map((r) => ({ path: r.path, title: r.title, render: r.roles.includes(user.role) ? r.render : renderAccessDenied })),
  );

  const allowedPaths = new Set(ALL_ROUTES.filter((r) => r.roles.includes(user.role)).map((r) => r.path));
  const currentHashPath = location.hash.replace(/^#/, '') || '/';
  if (!allowedPaths.has(currentHashPath)) {
    const fallback = ALL_ROUTES.find((r) => allowedPaths.has(r.path));
    if (fallback) location.hash = fallback.path;
  }

  startRouter(main);
  console.log('[boot] router started, app ready');

  if (user.role === 'buyer') maybeShowBuyerLowStockAlert(user);
}

function showBootError(error: unknown): void {
  console.error('[boot] bootstrap failed:', error);
  const app = document.getElementById('app');
  if (!app) return;
  const message = error instanceof Error ? error.message : String(error);
  app.innerHTML = '';
  app.append(
    el('div', { class: 'boot-splash boot-splash--error', role: 'alert' }, [
      el('div', { class: 'boot-logo' }, ['⚠️']),
      el('p', {}, ['خطا در بارگذاری برنامه']),
      el('p', { style: 'font-size: 12px; opacity: 0.7; direction: ltr;' }, [message]),
    ]),
  );
}

function watchForUpdates(registration: ServiceWorkerRegistration): void {
  // clientsClaim() also fires 'controllerchange' on a plain first visit (controller goes
  // null -> SW), so only reload if *we* requested the skip-waiting update, never on first claim.
  let userRequestedUpdate = false;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!userRequestedUpdate || reloading) return;
    reloading = true;
    location.reload();
  });

  registration.addEventListener('updatefound', () => {
    const installingWorker = registration.installing;
    if (!installingWorker) return;

    installingWorker.addEventListener('statechange', () => {
      if (installingWorker.state !== 'installed' || !navigator.serviceWorker.controller) return;

      const app = document.getElementById('app');
      const banner = createAlertBanner({
        id: 'sw-update',
        message: 'نسخه جدید برنامه آماده است.',
        tone: 'info',
        actionLabel: 'بازنشانی',
        onAction: () => {
          userRequestedUpdate = true;
          installingWorker.postMessage({ type: 'SKIP_WAITING' });
        },
      });
      if (app && banner) app.appendChild(banner);
    });
  });
}

bootstrap().catch(showBootError);

// Attached synchronously at script-evaluation time, not inside bootstrap(): bootstrap()
// awaits DB seeding before it would reach this point, and on a fresh install that can
// easily outlast page load, so a 'load' listener added after those awaits can attach too
// late and silently miss an already-fired 'load' event, permanently skipping SW registration.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(watchForUpdates).catch(() => {});
  });
}
