import { el } from '../utils/dom';
import { svgIcon } from '../utils/icons';
import type { IconName } from '../utils/icons';

export interface LandingCallbacks {
  onRegister: () => void;
  onJoin: () => void;
  onLogin: () => void;
}

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: 'box',
    title: 'پیش‌بینی هوشمند موجودی',
    desc: 'برآورد خودکار موجودی واقعی و نرخ مصرف روزانه از فروش و ضایعات، با هشدار پیش از اتمام هر ماده اولیه.',
  },
  {
    icon: 'users',
    title: 'بازاریابی خودکار مشتریان',
    desc: 'تقسیم‌بندی مشتریان بر اساس تازگی، تکرار و ارزش خرید (RFM) و ارسال خودکار پیامک به مشتریان وفادار، تازه‌وارد و در حال ریزش.',
  },
  {
    icon: 'cpu',
    title: 'مهندسی منو با هوش مصنوعی',
    desc: 'تحلیل سودآوری و محبوبیت هر آیتم منو برای شناسایی ستاره‌ها، اسب‌های زحمتکش و آیتم‌های ضعیف.',
  },
  {
    icon: 'bar-chart',
    title: 'سود و زیان یکپارچه',
    desc: 'ترکیب داده‌های صندوق فروشگاهی، اسنپ‌فود و فروش دستی در یک گزارش واحد سود و زیان.',
  },
  {
    icon: 'radio',
    title: 'کاملاً آفلاین',
    desc: 'تمام امکانات بدون نیاز به اینترنت کار می‌کنند؛ داده‌ها به‌محض اتصال مجدد همگام‌سازی می‌شوند.',
  },
];

function featureCard(f: { icon: IconName; title: string; desc: string }): HTMLElement {
  const iconEl = el('span', { class: 'landing-feature__icon' }, []);
  iconEl.appendChild(svgIcon(f.icon, 24));
  return el('div', { class: 'landing-feature' }, [
    iconEl,
    el('h3', { class: 'landing-feature__title' }, [f.title]),
    el('p', { class: 'landing-feature__desc' }, [f.desc]),
  ]);
}

/** Pre-auth marketing splash shown on a brand-new device, before the register/join choice. */
export function renderLandingPage(container: HTMLElement, callbacks: LandingCallbacks): void {
  container.innerHTML = '';

  container.appendChild(
    el('div', { class: 'landing-screen' }, [
      el('div', { class: 'landing-hero' }, [
        el('div', { class: 'boot-logo auth-logo' }, ['م']),
        el('span', { class: 'auth-brand' }, ['منوبان']),
        el('h1', { class: 'landing-hero__title' }, ['لایه هوشمند مدیریت کسب‌وکار شما']),
        el('p', { class: 'landing-hero__subtitle' }, [
          'منوبان داده‌های صندوق، اسنپ‌فود و ثبت دستی شما را در یک‌جا یکپارچه می‌کند و با پیش‌بینی موجودی، بازاریابی خودکار مشتریان و تحلیل منو، یک لایه هوش تجاری روی کسب‌وکار شما می‌سازد — نه یک صندوق فروش جدید.',
        ]),
      ]),
      el('div', { class: 'landing-cta' }, [
        el('button', { type: 'button', class: 'btn btn-primary auth-submit', onclick: callbacks.onRegister }, ['ثبت‌نام رایگان']),
        el('button', { type: 'button', class: 'btn btn-secondary auth-submit', onclick: callbacks.onLogin }, ['ورود به حساب']),
        el(
          'button',
          { type: 'button', class: 'landing-join-link', onclick: callbacks.onJoin },
          ['کد دعوت دارید؟ پیوستن به کسب‌وکار موجود'],
        ),
      ]),
      el('div', { class: 'landing-features' }, FEATURES.map(featureCard)),
    ]),
  );
}
