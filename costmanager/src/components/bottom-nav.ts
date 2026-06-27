import { hasRole } from '../auth';
import { currentPath, navigate } from '../router';
import { ingredients, lowStockCount } from '../store';
import { toPersian } from '../utils/format';
import type { UserRole } from '../types';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: boolean;
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'داشبورد', icon: '🏠', roles: ['superadmin', 'manager'] },
  { path: '/ingredients', label: 'انبار', icon: '📦', roles: ['superadmin', 'manager', 'warehouse'] },
  { path: '/recipes', label: 'منو و فودکاست', icon: '🍽️', roles: ['superadmin', 'manager'] },
  { path: '/accounting', label: 'حسابداری', icon: '📊', roles: ['superadmin', 'manager'] },
  { path: '/shopping', label: 'لیست خرید', icon: '🛒', badge: true, roles: ['superadmin', 'manager', 'warehouse', 'buyer'] },
  { path: '/admin', label: 'مدیریت', icon: '🛠️', roles: ['superadmin'] },
];

export function createAppNav(): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'app-nav';
  nav.setAttribute('aria-label', 'پیمایش اصلی');

  const items = NAV_ITEMS.filter((item) => !item.roles || hasRole(...item.roles));

  for (const item of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'app-nav__item';
    btn.dataset.path = item.path;

    const iconWrap = document.createElement('span');
    iconWrap.className = 'app-nav__icon';
    iconWrap.textContent = item.icon;

    if (item.badge) {
      const badge = document.createElement('span');
      badge.className = 'app-nav__badge';
      badge.hidden = true;
      iconWrap.appendChild(badge);
    }

    const label = document.createElement('span');
    label.className = 'app-nav__label';
    label.textContent = item.label;

    btn.append(iconWrap, label);
    btn.addEventListener('click', () => navigate(item.path));
    nav.appendChild(btn);
  }

  currentPath.subscribe((path) => {
    nav.querySelectorAll<HTMLButtonElement>('.app-nav__item').forEach((btn) => {
      const active = btn.dataset.path === path;
      btn.classList.toggle('app-nav__item--active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
  });

  ingredients.subscribe(() => {
    const badge = nav.querySelector<HTMLElement>('.app-nav__badge');
    if (!badge) return;
    const count = lowStockCount();
    badge.hidden = count === 0;
    badge.textContent = toPersian(count);
  });

  return nav;
}
