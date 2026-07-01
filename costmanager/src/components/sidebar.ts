import { hasRole } from '../auth';
import { isPlatformOwnerSession } from '../platform-owner';
import { currentPath, navigate } from '../router';
import { svgIcon } from '../utils/icons';
import type { IconName } from '../utils/icons';
import type { AppUser, UserRole } from '../types';

interface SidebarLink {
  path: string;
  label: string;
  icon: IconName;
  roles?: UserRole[];
}

const SIDEBAR_LINKS: SidebarLink[] = [
  { path: '/', label: 'داشبورد', icon: 'home', roles: ['superadmin', 'manager'] },
  { path: '/ingredients', label: 'انبار مواد اولیه', icon: 'box', roles: ['superadmin', 'manager', 'warehouse'] },
  { path: '/recipes', label: 'منو و فودکاست', icon: 'utensils', roles: ['superadmin', 'manager'] },
  { path: '/sales', label: 'فروش', icon: 'receipt', roles: ['superadmin', 'manager'] },
  { path: '/expenses', label: 'هزینه‌ها و حقوق', icon: 'wallet', roles: ['superadmin', 'manager'] },
  { path: '/hr', label: 'منابع انسانی', icon: 'user', roles: ['superadmin', 'manager'] },
  { path: '/accounting', label: 'حسابداری و سود و زیان', icon: 'bar-chart', roles: ['superadmin', 'manager'] },
  { path: '/crm', label: 'CRM', icon: 'users', roles: ['superadmin', 'manager'] },
  { path: '/menu-engineering', label: 'مهندسی منو', icon: 'cpu', roles: ['superadmin', 'manager'] },
  { path: '/shopping', label: 'لیست خرید', icon: 'cart', roles: ['superadmin', 'manager', 'warehouse', 'buyer'] },
  { path: '/purchase-requests', label: 'درخواست‌های خرید', icon: 'send', roles: ['superadmin', 'manager', 'warehouse', 'buyer'] },
  { path: '/admin', label: 'مدیریت', icon: 'wrench', roles: ['superadmin'] },
  { path: '/settings', label: 'تنظیمات', icon: 'settings', roles: ['superadmin'] },
];

const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'مدیر اصلی',
  manager: 'مدیر',
  warehouse: 'انباردار',
  buyer: 'خریدار',
  accountant: 'حسابدار',
};

export interface Sidebar {
  element: HTMLElement;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

function navButton(link: SidebarLink, onPick: () => void): HTMLElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sidebar__item';
  btn.dataset.path = link.path;
  btn.appendChild(svgIcon(link.icon));
  const label = document.createElement('span');
  label.textContent = link.label;
  btn.appendChild(label);
  btn.addEventListener('click', () => {
    navigate(link.path);
    onPick();
  });
  return btn;
}

/** RTL slide-in sidebar holding the full app menu (nav links, platform panel, user info, logout). */
export function createSidebar(
  user: AppUser,
  opts: { onLogout: () => void; onPlatformPanel: () => void },
): Sidebar {
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.hidden = true;

  const panel = document.createElement('aside');
  panel.className = 'sidebar';
  panel.setAttribute('aria-label', 'منوی اصلی');

  const header = document.createElement('div');
  header.className = 'sidebar__header';
  const title = document.createElement('span');
  title.className = 'sidebar__title';
  title.textContent = 'منو';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'sidebar__close-btn';
  closeBtn.setAttribute('aria-label', 'بستن منو');
  closeBtn.appendChild(svgIcon('x'));
  closeBtn.addEventListener('click', () => close());
  header.append(title, closeBtn);

  const nav = document.createElement('nav');
  nav.className = 'sidebar__nav';
  const links = SIDEBAR_LINKS.filter((link) => !link.roles || hasRole(...link.roles));
  for (const link of links) nav.appendChild(navButton(link, close));

  const footer = document.createElement('div');
  footer.className = 'sidebar__footer';

  const userInfo = document.createElement('div');
  userInfo.className = 'sidebar__user';
  userInfo.appendChild(svgIcon('user'));
  const userText = document.createElement('span');
  userText.textContent = `${user.name} (${ROLE_LABELS[user.role]})`;
  userInfo.appendChild(userText);
  footer.appendChild(userInfo);

  if (isPlatformOwnerSession()) {
    const platformBtn = document.createElement('button');
    platformBtn.type = 'button';
    platformBtn.className = 'sidebar__item';
    platformBtn.appendChild(svgIcon('shield'));
    const platformLabel = document.createElement('span');
    platformLabel.textContent = 'پنل پلتفرم';
    platformBtn.appendChild(platformLabel);
    platformBtn.addEventListener('click', () => {
      close();
      opts.onPlatformPanel();
    });
    footer.appendChild(platformBtn);
  }

  const logoutBtn = document.createElement('button');
  logoutBtn.type = 'button';
  logoutBtn.className = 'sidebar__item sidebar__item--danger';
  logoutBtn.appendChild(svgIcon('log-out'));
  const logoutLabel = document.createElement('span');
  logoutLabel.textContent = 'خروج';
  logoutBtn.appendChild(logoutLabel);
  logoutBtn.addEventListener('click', () => {
    close();
    opts.onLogout();
  });
  footer.appendChild(logoutBtn);

  panel.append(header, nav, footer);

  function setActive(path: string): void {
    nav.querySelectorAll<HTMLButtonElement>('.sidebar__item').forEach((btn) => {
      btn.classList.toggle('sidebar__item--active', btn.dataset.path === path);
    });
  }
  currentPath.subscribe(setActive);

  function open(): void {
    overlay.hidden = false;
    requestAnimationFrame(() => {
      overlay.classList.add('sidebar-overlay--visible');
      panel.classList.add('sidebar--open');
    });
  }

  function close(): void {
    overlay.classList.remove('sidebar-overlay--visible');
    panel.classList.remove('sidebar--open');
    setTimeout(() => {
      overlay.hidden = true;
    }, 200);
  }

  overlay.addEventListener('click', () => close());

  const root = document.createElement('div');
  root.append(overlay, panel);

  return {
    element: root,
    open,
    close,
    toggle: () => (panel.classList.contains('sidebar--open') ? close() : open()),
  };
}
