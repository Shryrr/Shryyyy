import { parsePersianDigits, toPersian } from './format';
import { svgIcon } from './icons';
import type { IconName } from './icons';

type Child = HTMLElement | string | null | undefined | false;

type ElProps = {
  class?: string;
  html?: string;
  dataset?: Record<string, string>;
  [key: `on${string}`]: ((e: Event) => void) | undefined;
} & Record<string, unknown>;

/** Tiny hyperscript-style DOM builder. No vdom, no diffing — just element creation. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: ElProps | null,
  children?: Child[],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null) continue;
      if (key === 'class') node.className = String(value);
      else if (key === 'html') node.innerHTML = String(value);
      else if (key === 'dataset') Object.assign(node.dataset, value as Record<string, string>);
      else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      } else if (key.includes('-')) {
        node.setAttribute(key, String(value));
      } else {
        try {
          (node as unknown as Record<string, unknown>)[key] = value;
        } catch {
          node.setAttribute(key, String(value));
        }
      }
    }
  }
  if (children) {
    for (const child of children) {
      if (child === null || child === undefined || child === false) continue;
      node.append(typeof child === 'string' ? document.createTextNode(child) : child);
    }
  }
  return node;
}

export function fragment(children: Child[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    frag.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return frag;
}

export function clear(node: HTMLElement): void {
  node.innerHTML = '';
}

export function field(label: string, input: HTMLElement, hint?: string): HTMLElement {
  return el('label', { class: 'field' }, [
    el('span', { class: 'field__label' }, [label]),
    input,
    hint ? el('span', { class: 'field__hint' }, [hint]) : null,
  ]);
}

export interface EmptyStateOptions {
  icon: IconName;
  title: string;
  message?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function emptyState(opts: EmptyStateOptions): HTMLElement {
  const iconEl = el('div', { class: 'empty-state__icon' }, []);
  iconEl.appendChild(svgIcon(opts.icon, 28));
  return el('div', { class: 'empty-state' }, [
    iconEl,
    el('p', { class: 'empty-state__title' }, [opts.title]),
    opts.message ? el('p', { class: 'empty-state__message' }, [opts.message]) : null,
    opts.ctaLabel && opts.onCta
      ? el('button', { class: 'btn btn-primary', type: 'button', onclick: opts.onCta }, [opts.ctaLabel])
      : null,
  ]);
}

/** Text input (not type=number) so pasted Persian digits parse correctly via parseNumberInput. */
export function numberInput(value: number | string = '', extraClass = ''): HTMLInputElement {
  return el('input', {
    type: 'text',
    inputmode: 'decimal',
    class: extraClass ? `input ${extraClass}` : 'input',
    value: typeof value === 'number' ? toPersian(value) : value,
  });
}

export function parseNumberInput(input: HTMLInputElement): number {
  return Number(parsePersianDigits(input.value)) || 0;
}

export type KpiTone = 'positive' | 'negative' | 'warning';

export function kpiCard(icon: IconName, label: string, value: string, tone?: KpiTone, onClick?: () => void): HTMLElement {
  const iconEl = el('span', { class: 'kpi-card__icon' }, []);
  iconEl.appendChild(svgIcon(icon, 20));
  return el(
    'div',
    {
      class: `kpi-card${tone ? ` kpi-card--${tone}` : ''}${onClick ? ' kpi-card--clickable' : ''}`,
      onclick: onClick,
      role: onClick ? 'button' : undefined,
      tabindex: onClick ? 0 : undefined,
      onkeydown: onClick
        ? (e: Event) => {
            const ke = e as KeyboardEvent;
            if (ke.key === 'Enter' || ke.key === ' ') {
              e.preventDefault();
              onClick();
            }
          }
        : undefined,
    },
    [
      iconEl,
      el('div', { class: 'kpi-card__body' }, [
        el('span', { class: 'kpi-card__label' }, [label]),
        el('span', { class: 'kpi-card__value' }, [value]),
      ]),
      onClick ? el('span', { class: 'kpi-card__arrow' }, ['←']) : null,
    ],
  );
}

/** Square icon-only button (edit/delete/etc. row actions) rendered with an inline SVG icon instead of emoji. */
export function iconBtn(icon: IconName, title: string, onClick: () => void): HTMLElement {
  const btn = el('button', { type: 'button', class: 'icon-btn', title, onclick: onClick }, []);
  btn.appendChild(svgIcon(icon, 16));
  return btn;
}

/** Text button with a leading SVG icon instead of an emoji prefix, e.g. for `btn btn-primary`/`btn btn-secondary` actions. */
export function iconTextBtn(icon: IconName, label: string, className: string, onClick: () => void): HTMLElement {
  const btn = el('button', { type: 'button', class: className, onclick: onClick }, []);
  btn.append(svgIcon(icon, 14), ` ${label}`);
  return btn;
}

export function selectEl(options: { value: string; label: string }[], selected?: string): HTMLSelectElement {
  const select = el('select', { class: 'input' });
  for (const opt of options) {
    const optionEl = el('option', { value: opt.value }, [opt.label]);
    if (opt.value === selected) optionEl.selected = true;
    select.appendChild(optionEl);
  }
  return select as HTMLSelectElement;
}
