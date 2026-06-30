import { hasRole } from '../auth';
import { currentPath, navigate } from '../router';
import { ingredients, lowStockCount } from '../store';
import { svgIcon } from '../utils/icons';
import type { IconName } from '../utils/icons';
import { toPersian } from '../utils/format';
import type { UserRole } from '../types';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  badge?: boolean;
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'داشبورد', icon: 'home', roles: ['superadmin', 'manager'] },
  { path: '/ingredients', label: 'انبار', icon: 'box', roles: ['superadmin', 'manager', 'warehouse'] },
  { path: '/recipes', label: 'منو و فودکاست', icon: 'utensils', roles: ['superadmin', 'manager'] },
  { path: '/accounting', label: 'حسابداری', icon: 'bar-chart', roles: ['superadmin', 'manager'] },
  { path: '/crm', label: 'CRM', icon: 'users', roles: ['superadmin', 'manager'] },
  { path: '/shopping', label: 'لیست خرید', icon: 'cart', badge: true, roles: ['warehouse', 'buyer'] },
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
    iconWrap.appendChild(svgIcon(item.icon));

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
