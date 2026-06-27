import * as db from './db';
import { createAlertBanner } from './components/alert-banner';
import { createAppNav } from './components/bottom-nav';
import { el } from './utils/dom';
import { navigate, registerRoutes, startRouter } from './router';
import type { Route } from './router';
import { initOnlineWatcher, initThemeWatcher, isOnline, refreshAll } from './store';
import { seedDatabase } from './seed';
import { daysUntilExpiry, isExpired, isExpiringSoon, restoreSession } from './auth';
import { initLowStockWatcher, requestNotificationPermission, setNotificationBannerHost } from './utils/notifications';
import { toPersian } from './utils/format';
import { renderAuthGate } from './views/login';
import { renderAccounting } from './views/accounting';
import { renderAdmin } from './views/admin';
import { renderDashboard } from './views/dashboard';
import { renderExpenses } from './views/expenses';
import { renderIngredients } from './views/ingredients';
import { renderRecipes } from './views/recipes';
import { renderSales } from './views/sales';
import { renderSettings } from './views/settings';
import { openBuyerShoppingModal, renderShopping } from './views/shopping';
import type { UserRole } from './types';

const HEADER_LINKS: { path: string; label: string; icon: string; roles?: UserRole[] }[] = [
  { path: '/sales', label: 'فروش', icon: '🧾', roles: ['admin'] },
  { path: '/expenses', label: 'هزینه‌ها و حقوق', icon: '💸', roles: ['admin'] },
  { path: '/settings', label: 'تنظیمات', icon: '⚙️', roles: ['admin'] },
];

const ALL_ROUTES: (Route & { roles: UserRole[] })[] = [
  { path: '/', title: 'داشبورد', render: renderDashboard, roles: ['admin', 'viewer'] },
  { path: '/ingredients', title: 'انبار مواد اولیه', render: renderIngredients, roles: ['admin', 'buyer'] },
  { path: '/recipes', title: 'منو و فودکاست', render: renderRecipes, roles: ['admin', 'viewer'] },
  { path: '/expenses', title: 'هزینه‌ها و حقوق', render: renderExpenses, roles: ['admin'] },
  { path: '/sales', title: 'فروش', render: renderSales, roles: ['admin'] },
  { path: '/accounting', title: 'حسابداری و سود و زیان', render: renderAccounting, roles: ['admin'] },
  { path: '/shopping', title: 'لیست خرید', render: renderShopping, roles: ['admin', 'buyer'] },
  { path: '/settings', title: 'تنظیمات', render: renderSettings, roles: ['admin'] },
  { path: '/admin', title: 'مدیریت', render: renderAdmin, roles: ['admin'] },
];

function createAppHeader(role: UserRole): HTMLElement {
  const offlineBadge = el('span', { class: 'app-header__offline-badge' }, ['آفلاین']);
  offlineBadge.hidden = true;

  const links = HEADER_LINKS.filter((link) => !link.roles || link.roles.includes(role));

  const header = el('header', { class: 'app-header' }, [
    el('span', { class: 'app-header__logo' }, ['منوبان']),
    offlineBadge,
    el(
      'div',
      { class: 'app-header__actions' },
      links.map((link) => {
        const btn = el('button', { type: 'button', class: 'app-header__icon-btn', title: link.label, onclick: () => navigate(link.path) }, [
          link.icon,
        ]);
        btn.setAttribute('aria-label', link.label);
        return btn;
      }),
    ),
  ]);

  isOnline.subscribe((online) => {
    offlineBadge.hidden = online;
  });

  return header;
}

async function bootstrap(): Promise<void> {
  console.log('[boot] starting');
  initThemeWatcher();
  initOnlineWatcher();
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

  const user = (await restoreSession()) ?? (await renderAuthGate(app));
  console.log('[boot] authenticated as', user.role);

  setNotificationBannerHost(app);
  initLowStockWatcher();
  await requestNotificationPermission();

  app.innerHTML = '';

  if (isExpired(user)) {
    app.append(
      el('div', { class: 'boot-splash', role: 'alert' }, [
        el('div', { class: 'auth-card' }, [
          el('div', { class: 'boot-logo' }, ['⛔']),
          el('h2', { class: 'auth-title' }, ['اشتراک شما منقضی شده است']),
          el('p', { class: 'auth-subtitle' }, ['برای ادامه استفاده از برنامه، لطفاً با مدیر سیستم تماس بگیرید.']),
        ]),
      ]),
    );
    console.log('[boot] subscription expired, blocking app');
    return;
  }

  const main = el('main', { class: 'app-main' });
  const bannerHost = el('div', { class: 'app-banner-host' });

  app.append(createAppHeader(user.role), bannerHost, main, createAppNav());

  if (isExpiringSoon(user)) {
    const days = daysUntilExpiry(user);
    const banner = createAlertBanner({
      id: 'subscription-expiring',
      message: `اشتراک شما تا ${toPersian(days)} روز دیگر منقضی می‌شود.`,
      tone: 'warning',
    });
    if (banner) bannerHost.appendChild(banner);
  }

  registerRoutes(
    ALL_ROUTES.filter((r) => r.roles.includes(user.role)).map((r) => ({ path: r.path, title: r.title, render: r.render })),
  );

  startRouter(main);
  console.log('[boot] router started, app ready');

  if (user.role === 'buyer') openBuyerShoppingModal();
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
