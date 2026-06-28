import type { BusinessType, ExpenseCategory, ExpenseFrequency, IngredientCategory, PayType, RFMSegment, Unit } from '../types';

const moneyFmt = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
const plainFmt = new Intl.NumberFormat('fa-IR', { useGrouping: false, maximumFractionDigits: 6 });
const dateFmt = new Intl.DateTimeFormat('fa-IR', { calendar: 'persian', day: 'numeric', month: 'long', year: 'numeric' });
const dateShortFmt = new Intl.DateTimeFormat('fa-IR', { calendar: 'persian', day: 'numeric', month: 'long' });
const dateTimeFmt = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const UNIT_LABELS: Record<Unit, string> = {
  kg: 'کیلوگرم',
  g: 'گرم',
  l: 'لیتر',
  ml: 'میلی‌لیتر',
  unit: 'عدد',
  pack: 'بسته',
  box: 'جعبه',
};

/** Converts any Latin/mixed digit number to Persian digits, no grouping. */
export function toPersian(n: number | string): string {
  return plainFmt.format(Number(n));
}

/** Converts Persian/Arabic-Indic digits back to Latin digits (for parsing pasted input). */
export function parsePersianDigits(input: string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  return input.replace(/[۰-۹٠-٩]/g, (ch) => {
    const pIdx = persian.indexOf(ch);
    if (pIdx > -1) return String(pIdx);
    const aIdx = arabic.indexOf(ch);
    if (aIdx > -1) return String(aIdx);
    return ch;
  });
}

/** Plain Persian-digit number with thousand separators, no currency suffix. */
export function formatNumber(n: number): string {
  return numberFmt.format(n);
}

export function formatMoney(amount: number): string {
  return `${moneyFmt.format(Math.round(amount))} تومان`;
}

function trimmed(n: number, decimals: number): string {
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: decimals }).format(n);
}

export function formatMoneyShort(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `${sign}${trimmed(abs / 1_000_000_000, 1)}B تومان`;
  if (abs >= 1_000_000) return `${sign}${trimmed(abs / 1_000_000, 1)}M تومان`;
  if (abs >= 1_000) return `${sign}${trimmed(abs / 1_000, 1)}K تومان`;
  return formatMoney(amount);
}

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function formatDateShort(iso: string): string {
  return dateShortFmt.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

export function formatPct(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return `۰٪`;
  return `${trimmed(value, decimals)}٪`;
}

export function formatUnit(unit: Unit): string {
  return UNIT_LABELS[unit] ?? unit;
}

const INGREDIENT_CATEGORY_LABELS: Record<IngredientCategory, string> = {
  coffee_tea: 'قهوه و چای',
  dairy: 'لبنیات',
  dry_goods: 'خشکبار و غلات',
  protein: 'پروتئین',
  produce: 'میوه و سبزیجات',
  bakery: 'نان و شیرینی',
  beverages: 'نوشیدنی',
  packaging: 'بسته‌بندی',
  other: 'سایر',
};

export function formatIngredientCategory(category: IngredientCategory): string {
  return INGREDIENT_CATEGORY_LABELS[category] ?? category;
}

const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: 'اجاره',
  utilities: 'آب و برق و گاز',
  insurance: 'بیمه',
  marketing: 'بازاریابی',
  maintenance: 'تعمیر و نگهداری',
  packaging: 'بسته‌بندی',
  transport: 'حمل و نقل',
  tax: 'مالیات',
  other: 'سایر',
};

export function formatExpenseCategory(category: ExpenseCategory): string {
  return EXPENSE_CATEGORY_LABELS[category] ?? category;
}

const EXPENSE_FREQUENCY_LABELS: Record<ExpenseFrequency, string> = {
  monthly: 'ماهانه',
  yearly: 'سالانه',
  one_time: 'یک‌بار',
};

export function formatExpenseFrequency(freq: ExpenseFrequency): string {
  return EXPENSE_FREQUENCY_LABELS[freq] ?? freq;
}

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  cafe: 'کافه',
  restaurant: 'رستوران',
  fast_food: 'فست‌فود',
  bakery: 'نان‌وایی / شیرینی‌فروشی',
  other: 'سایر',
};

export function formatBusinessType(type: BusinessType): string {
  return BUSINESS_TYPE_LABELS[type] ?? type;
}

const PAY_TYPE_LABELS: Record<PayType, string> = {
  monthly: 'ماهانه',
  daily: 'روزانه',
  hourly: 'ساعتی',
};

export function formatPayType(type: PayType): string {
  return PAY_TYPE_LABELS[type] ?? type;
}

const RFM_SEGMENT_LABELS: Record<RFMSegment, string> = {
  champions: 'مشتریان ویژه',
  loyal: 'وفادار',
  potential: 'بااستعداد',
  new: 'تازه‌وارد',
  at_risk: 'در معرض ریزش',
  lost: 'ازدست‌رفته',
  hibernating: 'غیرفعال',
  regular: 'عادی',
};

const RFM_SEGMENT_ICONS: Record<RFMSegment, string> = {
  champions: '🏆',
  loyal: '💙',
  potential: '🌱',
  new: '✨',
  at_risk: '⚠️',
  lost: '👻',
  hibernating: '😴',
  regular: '🙂',
};

export function formatRfmSegment(segment: RFMSegment): string {
  return RFM_SEGMENT_LABELS[segment] ?? segment;
}

export function rfmSegmentIcon(segment: RFMSegment): string {
  return RFM_SEGMENT_ICONS[segment] ?? '🙂';
}

/** Display order for RFM segments, best to worst — shared by the dashboard and CRM views. */
export const RFM_SEGMENT_ORDER: RFMSegment[] = ['champions', 'loyal', 'potential', 'regular', 'new', 'at_risk', 'hibernating', 'lost'];

/** ISO date string for "today" at local midnight, used as default form value. */
export function todayISO(): string {
  return new Date().toISOString();
}
