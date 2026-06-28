import * as db from '../db';
import { navigate } from '../router';
import { notifications, refreshNotifications, unreadNotificationCount } from '../store';
import type { AppNotification, AppUser } from '../types';
import { el } from '../utils/dom';
import { formatDateTime, toPersian } from '../utils/format';

const NOTIFICATION_ROUTE: Record<AppNotification['type'], string> = {
  purchase_request: '/shopping',
  low_stock: '/shopping',
  system: '/',
};

export function createNotificationBell(user: AppUser): HTMLElement {
  const badge = el('span', { class: 'notification-bell__badge' }, ['']);
  badge.hidden = true;

  const panel = el('div', { class: 'notification-bell__panel' });
  panel.hidden = true;

  const btn = el(
    'button',
    { type: 'button', class: 'app-header__icon-btn', title: 'اعلان‌ها', onclick: () => toggle() },
    ['🔔'],
  );
  btn.setAttribute('aria-label', 'اعلان‌ها');

  const wrapper = el('div', { class: 'notification-bell' }, [btn, badge, panel]);

  function onOutsideClick(e: MouseEvent): void {
    if (!wrapper.contains(e.target as Node)) closePanel();
  }

  function closePanel(): void {
    panel.hidden = true;
    document.removeEventListener('click', onOutsideClick);
  }

  function toggle(): void {
    if (panel.hidden) {
      renderPanel();
      panel.hidden = false;
      document.addEventListener('click', onOutsideClick);
    } else {
      closePanel();
    }
  }

  async function pick(n: AppNotification): Promise<void> {
    closePanel();
    if (!n.isRead) {
      await db.markNotificationRead(n.id);
      await refreshNotifications();
    }
    navigate(NOTIFICATION_ROUTE[n.type] ?? '/');
  }

  function renderItem(n: AppNotification): HTMLElement {
    return el(
      'button',
      {
        type: 'button',
        class: `notification-bell__item${n.isRead ? '' : ' notification-bell__item--unread'}`,
        onclick: () => pick(n),
      },
      [
        el('span', { class: 'notification-bell__item-title' }, [n.title]),
        el('span', { class: 'notification-bell__item-message' }, [n.message]),
        el('span', { class: 'notification-bell__item-time' }, [formatDateTime(n.createdAt)]),
      ],
    );
  }

  function renderPanel(): void {
    panel.innerHTML = '';
    const mine = notifications
      .get()
      .filter((n) => n.targetRole === user.role)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (mine.length === 0) {
      panel.appendChild(el('div', { class: 'notification-bell__empty' }, ['اعلانی وجود ندارد']));
      return;
    }
    panel.append(...mine.map((n) => renderItem(n)));
  }

  notifications.subscribe(() => {
    const count = unreadNotificationCount(user.role);
    badge.hidden = count === 0;
    badge.textContent = count > 0 ? toPersian(count) : '';
    if (!panel.hidden) renderPanel();
  });

  return wrapper;
}
