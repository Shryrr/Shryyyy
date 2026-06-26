export type ToastType = 'success' | 'error' | 'info';

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message: string, type: ToastType = 'info', duration = 2500): void {
  const root = ensureContainer();
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast--visible'));
  setTimeout(() => {
    el.classList.remove('toast--visible');
    setTimeout(() => el.remove(), 200);
  }, duration);
}
