import * as db from '../db';
import { login as setSession } from '../auth';
import { getPlatformPricing } from '../platform-owner';
import { importFromSyncCode } from '../utils/sync';
import { passwordStrength, validatePassword, validateUsername } from '../utils/password';
import { el, field, selectEl } from '../utils/dom';
import { formatBusinessType, formatMoney, toPersian } from '../utils/format';
import type { AppUser, BusinessType, PaidSubscriptionPlan } from '../types';

const BUSINESS_TYPE_OPTIONS: BusinessType[] = ['cafe', 'restaurant', 'fast_food', 'bakery', 'other'];

const PLAN_OPTIONS: { value: PaidSubscriptionPlan; label: string }[] = [
  { value: '1m', label: '۱ ماهه' },
  { value: '3m', label: '۳ ماهه' },
  { value: '6m', label: '۶ ماهه' },
  { value: '12m', label: '۱۲ ماهه' },
];

export interface SetupWizardCallbacks {
  /** A brand-new business was registered and its manager is now logged in. */
  onDone: (user: AppUser) => void;
  /** An existing business's data was imported onto this device; caller should re-run the auth gate to show the PIN grid. */
  onJoined: () => void;
  /** User backed out of the first wizard step; caller should return to the landing page. */
  onBack: () => void;
}

type Step = 'join' | 'business' | 'manager' | 'plan';

interface WizardState {
  businessName: string;
  businessType: BusinessType;
  managerName: string;
  managerEmail: string;
  managerPhone: string;
  managerUsername: string;
  managerPassword: string;
  plan: PaidSubscriptionPlan;
}

/** Registration wizard, entered from the landing page at either 'business' (register-new) or 'join' (join-existing); for new businesses: business info → manager info → plan, calling db.registerBusiness. */
export function renderSetupWizard(container: HTMLElement, callbacks: SetupWizardCallbacks, initialStep: 'business' | 'join'): void {
  let step: Step = initialStep;
  const state: WizardState = {
    businessName: '',
    businessType: 'cafe',
    managerName: '',
    managerEmail: '',
    managerPhone: '',
    managerUsername: '',
    managerPassword: '',
    plan: '1m',
  };

  function render(): void {
    container.innerHTML = '';
    const steps: Record<Step, () => HTMLElement> = {
      join: renderJoinStep,
      business: renderBusinessStep,
      manager: renderManagerStep,
      plan: renderPlanStep,
    };
    container.appendChild(steps[step]());
  }

  function shell(children: HTMLElement[]): HTMLElement {
    return el('div', { class: 'auth-screen' }, [el('div', { class: 'auth-card' }, children)]);
  }

  function renderJoinStep(): HTMLElement {
    const codeInput = el('input', {
      type: 'text', inputmode: 'numeric', autocomplete: 'off', maxlength: 6, class: 'input', dir: 'ltr', placeholder: '۶ رقمی',
    });
    const errorEl = el('p', { class: 'auth-error', hidden: true }, []);

    function showError(msg: string): void {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }

    async function submit(): Promise<void> {
      errorEl.hidden = true;
      const code = codeInput.value.trim();
      if (!/^\d{6}$/.test(code)) return showError('کد باید ۶ رقم باشد');
      const result = await importFromSyncCode(code, { skipConfirm: true });
      if (!result.ok) return showError(result.error ?? 'کد نامعتبر است');
      callbacks.onJoined();
    }

    return shell([
      el('button', { type: 'button', class: 'auth-back-btn', onclick: callbacks.onBack }, ['→ بازگشت']),
      el('div', { class: 'boot-logo auth-logo' }, ['م']),
      el('h2', { class: 'auth-title' }, ['پیوستن به کسب‌وکار موجود']),
      el('p', { class: 'auth-subtitle' }, ['کدی که از مدیر اصلی کسب‌وکار دریافت کرده‌اید را وارد کنید']),
      el('form', { class: 'auth-form', onsubmit: (e: Event) => { e.preventDefault(); submit(); } }, [
        field('کد همگام‌سازی', codeInput),
        errorEl,
        el('button', { type: 'submit', class: 'btn btn-primary auth-submit' }, ['پیوستن']),
      ]),
    ]);
  }

  function renderBusinessStep(): HTMLElement {
    const nameInput = el('input', { type: 'text', class: 'input', autocomplete: 'off', value: state.businessName });
    const typeSelect = selectEl(BUSINESS_TYPE_OPTIONS.map((t) => ({ value: t, label: formatBusinessType(t) })), state.businessType);
    const errorEl = el('p', { class: 'auth-error', hidden: true }, []);

    function submit(): void {
      const name = nameInput.value.trim();
      if (!name) {
        errorEl.textContent = 'نام کسب‌وکار الزامی است';
        errorEl.hidden = false;
        return;
      }
      state.businessName = name;
      state.businessType = typeSelect.value as BusinessType;
      step = 'manager';
      render();
    }

    return shell([
      el('button', { type: 'button', class: 'auth-back-btn', onclick: callbacks.onBack }, ['→ بازگشت']),
      el('div', { class: 'boot-logo auth-logo' }, ['م']),
      el('h2', { class: 'auth-title' }, ['اطلاعات کسب‌وکار']),
      el('p', { class: 'auth-subtitle' }, ['گام ۱ از ۳']),
      el('form', { class: 'auth-form', onsubmit: (e: Event) => { e.preventDefault(); submit(); } }, [
        field('نام کسب‌وکار', nameInput),
        field('نوع کسب‌وکار', typeSelect),
        errorEl,
        el('button', { type: 'submit', class: 'btn btn-primary auth-submit' }, ['بعدی']),
      ]),
    ]);
  }

  function renderManagerStep(): HTMLElement {
    const nameInput = el('input', { type: 'text', class: 'input', autocomplete: 'off', value: state.managerName });
    const emailInput = el('input', { type: 'email', class: 'input', autocomplete: 'off', dir: 'ltr', value: state.managerEmail });
    const phoneInput = el('input', { type: 'tel', class: 'input', autocomplete: 'off', dir: 'ltr', value: state.managerPhone });
    const usernameInput = el('input', { type: 'text', class: 'input', autocomplete: 'username', dir: 'ltr', value: state.managerUsername });
    const passwordInput = el('input', { type: 'password', class: 'input', dir: 'ltr', autocomplete: 'new-password' }) as HTMLInputElement;
    const confirmPasswordInput = el('input', { type: 'password', class: 'input', dir: 'ltr', autocomplete: 'new-password' });
    const strengthEl = el('p', { class: 'auth-hint' }, ['']);
    const errorEl = el('p', { class: 'auth-error', hidden: true }, []);

    passwordInput.addEventListener('input', () => {
      const { label } = passwordStrength(passwordInput.value);
      strengthEl.textContent = passwordInput.value ? `قدرت رمز عبور: ${label}` : '';
    });

    function showError(msg: string): void {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }

    async function submit(): Promise<void> {
      errorEl.hidden = true;
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const phone = phoneInput.value.trim();
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      const confirmPassword = confirmPasswordInput.value;

      if (!name) return showError('نام مدیر اصلی الزامی است');
      if (!email) return showError('ایمیل مدیر اصلی الزامی است');
      const usernameError = validateUsername(username);
      if (usernameError) return showError(usernameError);
      if (await db.isUsernameTaken(username)) return showError('این نام کاربری قبلاً استفاده شده است');
      const passwordError = validatePassword(password);
      if (passwordError) return showError(passwordError);
      if (password !== confirmPassword) return showError('رمز عبور و تکرار آن یکسان نیستند');

      state.managerName = name;
      state.managerEmail = email;
      state.managerPhone = phone;
      state.managerUsername = username;
      state.managerPassword = password;
      step = 'plan';
      render();
    }

    return shell([
      el('div', { class: 'boot-logo auth-logo' }, ['م']),
      el('h2', { class: 'auth-title' }, ['اطلاعات مدیر اصلی']),
      el('p', { class: 'auth-subtitle' }, ['گام ۲ از ۳']),
      el('form', { class: 'auth-form', onsubmit: (e: Event) => { e.preventDefault(); void submit(); } }, [
        field('نام مدیر اصلی', nameInput),
        field('ایمیل', emailInput),
        field('شماره تماس (اختیاری)', phoneInput),
        field('نام کاربری (برای ورود)', usernameInput),
        field('رمز عبور', passwordInput),
        strengthEl,
        field('تکرار رمز عبور', confirmPasswordInput),
        errorEl,
        el('div', { class: 'auth-step-actions' }, [
          el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => { step = 'business'; render(); } }, ['قبلی']),
          el('button', { type: 'submit', class: 'btn btn-primary' }, ['بعدی']),
        ]),
      ]),
    ]);
  }

  function renderPlanStep(): HTMLElement {
    const pricing = getPlatformPricing();
    const planSelect = selectEl(
      PLAN_OPTIONS.map((p) => ({ value: p.value, label: `${p.label} — ${formatMoney(pricing[p.value] ?? 0)}` })),
      state.plan,
    );
    const errorEl = el('p', { class: 'auth-error', hidden: true }, []);

    async function submit(): Promise<void> {
      errorEl.hidden = true;
      state.plan = planSelect.value as PaidSubscriptionPlan;
      try {
        const user = await db.registerBusiness({
          businessName: state.businessName,
          businessType: state.businessType,
          managerName: state.managerName,
          managerUsername: state.managerUsername,
          managerEmail: state.managerEmail,
          managerPassword: state.managerPassword,
          managerPhone: state.managerPhone || undefined,
          plan: state.plan,
        });
        await setSession(user);
        callbacks.onDone(user);
      } catch (err) {
        errorEl.textContent = err instanceof Error ? err.message : 'خطایی رخ داد';
        errorEl.hidden = false;
      }
    }

    return shell([
      el('div', { class: 'boot-logo auth-logo' }, ['م']),
      el('h2', { class: 'auth-title' }, ['انتخاب پلن اشتراک']),
      el('p', { class: 'auth-subtitle' }, ['گام ۳ از ۳']),
      el('p', { class: 'auth-subtitle' }, [`کسب‌وکار شما با ${toPersian(db.TRIAL_DAYS)} روز اشتراک رایگان شروع می‌شود؛ این پلن از پایان دوره آزمایشی فعال می‌شود.`]),
      el('form', { class: 'auth-form', onsubmit: (e: Event) => { e.preventDefault(); submit(); } }, [
        field('پلن اشتراک', planSelect),
        errorEl,
        el('div', { class: 'auth-step-actions' }, [
          el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => { step = 'manager'; render(); } }, ['قبلی']),
          el('button', { type: 'submit', class: 'btn btn-primary' }, ['تکمیل ثبت‌نام']),
        ]),
      ]),
    ]);
  }

  render();
}
