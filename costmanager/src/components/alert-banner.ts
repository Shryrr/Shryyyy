import { svgIcon } from '../utils/icons';

export interface AlertBannerOptions {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'warning' | 'info' | 'danger';
}

const dismissedThisSession = new Set<string>();

/** Returns null if the user already dismissed this banner id during the current session. */
export function createAlertBanner(opts: AlertBannerOptions): HTMLElement | null {
  if (dismissedThisSession.has(opts.id)) return null;

  const el = document.createElement('div');
  el.className = `alert-banner alert-banner--${opts.tone ?? 'warning'}`;

  const icon = document.createElement('span');
  icon.className = 'alert-banner__icon';
  icon.appendChild(svgIcon(opts.tone === 'danger' ? 'alert-circle' : 'alert-triangle', 18));
  el.appendChild(icon);

  const text = document.createElement('span');
  text.className = 'alert-banner__text';
  text.textContent = opts.message;
  el.appendChild(text);

  if (opts.actionLabel && opts.onAction) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'alert-banner__action';
    btn.textContent = opts.actionLabel;
    btn.addEventListener('click', opts.onAction);
    el.appendChild(btn);
  }

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'alert-banner__dismiss';
  dismiss.setAttribute('aria-label', 'بستن هشدار');
  dismiss.textContent = '✕';
  dismiss.addEventListener('click', () => {
    dismissedThisSession.add(opts.id);
    el.remove();
  });
  el.appendChild(dismiss);

  return el;
}
