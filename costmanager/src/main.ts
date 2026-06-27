import * as db from './db';
import { createAlertBanner } from './components/alert-banner';
import { createAppNav } from './components/bottom-nav';
import { el } from './utils/dom';
import { navigate, registerRoutes, startRouter } from './router';
import { initOnlineWatcher, initThemeWatcher, isOnline, refreshAll } from './store';
import { seedDatabase } from './seed';
import { renderAccounting } from './views/accounting';
import { renderDashboard } from './views/dashboard';
import { renderExpenses } from './views/expenses';
import { renderIngredients } from './views/ingredients';
import { renderRecipes } from './views/recipes';
import { renderSales } from './views/sales';
import { renderSettings } from './views/settings';
import { renderShopping } from './views/shopping';

const HEADER_LINKS: { path: string; label: string; icon: string }[] = [
  { path: '/sales', label: 'فروش', icon: '🧾' },
  { path: '/expenses', label: 'هزینه‌ها و حقوق', icon: '💸' },
  { path: '/settings', label: 'تنظیمات', icon: '⚙️' },
];

function createAppHeader(): HTMLElement {
  const offlineBadge = el('span', { class: 'app-header__offline-badge' }, ['آفلاین']);
  offlineBadge.hidden = true;

  const header = el('header', { class: 'app-header' }, [
    el('span', { class: 'app-header__logo' }, ['منوبان']),
    offlineBadge,
    el(
      'div',
      { class: 'app-header__actions' },
      HEADER_LINKS.map((link) => {
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
  app.innerHTML = '';

  const main = el('main', { class: 'app-main' });

  app.append(createAppHeader(), main, createAppNav());

  registerRoutes([
    { path: '/', title: 'داشبورد', render: renderDashboard },
    { path: '/ingredients', title: 'انبار مواد اولیه', render: renderIngredients },
    { path: '/recipes', title: 'منو و فودکاست', render: renderRecipes },
    { path: '/expenses', title: 'هزینه‌ها و حقوق', render: renderExpenses },
    { path: '/sales', title: 'فروش', render: renderSales },
    { path: '/accounting', title: 'حسابداری و سود و زیان', render: renderAccounting },
    { path: '/shopping', title: 'لیست خرید', render: renderShopping },
    { path: '/settings', title: 'تنظیمات', render: renderSettings },
  ]);

  startRouter(main);
  console.log('[boot] router started, app ready');
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
