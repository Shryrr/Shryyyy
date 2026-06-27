import * as db from '../db';
import { login as setSession } from '../auth';
import { el, field } from '../utils/dom';
import type { AppUser } from '../types';

/** First-launch wizard: welcome → name+PIN+confirm → create superadmin → resolve(onDone) so the caller can proceed to the dashboard. */
export function renderSetupWizard(container: HTMLElement, businessName: string, onDone: (user: AppUser) => void): void {
  let step: 1 | 2 = 1;

  function render(): void {
    container.innerHTML = '';
    container.appendChild(step === 1 ? renderWelcomeStep() : renderFormStep());
  }

  function renderWelcomeStep(): HTMLElement {
    return el('div', { class: 'auth-screen' }, [
      el('div', { class: 'auth-card' }, [
        el('div', { class: 'boot-logo auth-logo' }, ['م']),
        el('span', { class: 'auth-brand' }, [businessName]),
        el('h2', { class: 'auth-title' }, ['خوش آمدید به منوبان']),
        el('p', { class: 'auth-subtitle' }, ['ابتدا مدیر اصلی سیستم را تعریف کنید']),
        el(
          'button',
          { type: 'button', class: 'btn btn-primary auth-submit', onclick: () => { step = 2; render(); } },
          ['شروع'],
        ),
      ]),
    ]);
  }

  function renderFormStep(): HTMLElement {
    const nameInput = el('input', { type: 'text', class: 'input', autocomplete: 'off' });
    const pinInput = el('input', {
      type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 4, class: 'input auth-pin-input',
    });
    const confirmInput = el('input', {
      type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 4, class: 'input auth-pin-input',
    });
    const errorEl = el('p', { class: 'auth-error', hidden: true }, []);

    function showError(msg: string): void {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }

    async function submit(): Promise<void> {
      errorEl.hidden = true;
      const name = nameInput.value.trim();
      const pin = pinInput.value.trim();
      const confirmPin = confirmInput.value.trim();

      if (!name) return showError('نام مدیر اصلی الزامی است');
      if (!/^\d{4}$/.test(pin)) return showError('پین باید دقیقاً ۴ رقم باشد');
      if (pin !== confirmPin) return showError('پین و تکرار آن یکسان نیستند');

      const user = await db.createSuperadmin(name, pin);
      await setSession(user);
      onDone(user);
    }

    return el('div', { class: 'auth-screen' }, [
      el('div', { class: 'auth-card' }, [
        el('form', { class: 'auth-form', onsubmit: (e: Event) => { e.preventDefault(); submit(); } }, [
          el('div', { class: 'boot-logo auth-logo' }, ['م']),
          el('span', { class: 'auth-brand' }, [businessName]),
          el('h2', { class: 'auth-title' }, ['تعریف مدیر اصلی']),
          el('p', { class: 'auth-subtitle' }, ['نام، پین ۴ رقمی و تکرار آن را وارد کنید']),
          field('نام مدیر اصلی', nameInput),
          field('پین (۴ رقم)', pinInput),
          field('تکرار پین', confirmInput),
          errorEl,
          el('button', { type: 'submit', class: 'btn btn-primary auth-submit' }, ['ایجاد مدیر اصلی و شروع']),
        ]),
      ]),
    ]);
  }

  render();
}
