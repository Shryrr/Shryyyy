import { checkInactivityTimeout } from './auth';
import { signal } from './store';

export type RouteCleanup = (() => void) | void;
export type RouteRender = (container: HTMLElement) => Promise<RouteCleanup> | RouteCleanup;

export interface Route {
  path: string;
  title: string;
  render: RouteRender;
}

const routes: Route[] = [];
export const currentPath = signal<string>('/');

export function registerRoutes(list: Route[]): void {
  routes.push(...list);
}

function getHashPath(): string {
  const hash = location.hash.replace(/^#/, '');
  return hash || '/';
}

let cleanup: RouteCleanup;
let rootEl: HTMLElement | null = null;

async function renderCurrent(): Promise<void> {
  if (!rootEl) return;
  if (checkInactivityTimeout()) return;
  if (cleanup) {
    cleanup();
    cleanup = undefined;
  }
  const path = getHashPath();
  const route = routes.find((r) => r.path === path) ?? routes[0];
  if (!route) return;
  currentPath.set(route.path);
  document.title = `${route.title} — منوبان`;
  rootEl.innerHTML = '';
  rootEl.scrollTop = 0;
  const result = await route.render(rootEl);
  cleanup = result;
}

export function navigate(path: string): void {
  if (getHashPath() === path) {
    renderCurrent();
    return;
  }
  location.hash = path;
}

export function startRouter(container: HTMLElement): void {
  rootEl = container;
  window.addEventListener('hashchange', renderCurrent);
  renderCurrent();
}
