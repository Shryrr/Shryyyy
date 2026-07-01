import * as db from '../db';
import { currentUser, hasFullAccess, hasRole } from '../auth';
import { confirmModal, openModal } from '../components/modal';
import { api } from '../utils/api';
import { showToast } from '../components/toast';
import { emptyState, el, field, iconBtn, kpiCard, numberInput, parseNumberInput, selectEl } from '../utils/dom';
import { svgIcon } from '../utils/icons';
import { formatDateShort, formatIngredientCategory, formatMoney, formatMoneyShort, formatUnit, toPersian, todayISO } from '../utils/format';
import { navigate } from '../router';
import type { RouteCleanup } from '../router';
import { ingredients, refreshIngredients, refreshMenuItems, takeNavigationIntent } from '../store';
import { inventoryValue, lowStockIngredients } from '../utils/calc';
import { scheduleRecalculation } from '../utils/inventory-engine';
import { STOCKOUT_WARNING_DAYS } from '../utils/stock-alerts';
import type { Ingredient, IngredientCategory, PurchaseRecord, Unit } from '../types';
import { renderCreateRequestModal } from './purchase-requests';

const CATEGORY_OPTIONS: IngredientCategory[] = [
  'coffee_tea', 'dairy', 'dry_goods', 'protein', 'produce', 'bakery', 'beverages', 'packaging', 'other',
];
const UNIT_OPTIONS: Unit[] = ['kg', 'g', 'l', 'ml', 'unit', 'pack', 'box'];

function openIngredientFormModal(existing?: Ingredient): void {
  const nameInput = el('input', { type: 'text', class: 'input', value: existing?.name ?? '' });
  const categorySelect = selectEl(
    CATEGORY_OPTIONS.map((c) => ({ value: c, label: formatIngredientCategory(c) })),
    existing?.category ?? 'other',
  );
  const unitSelect = selectEl(
    UNIT_OPTIONS.map((u) => ({ value: u, label: formatUnit(u) })),
    existing?.unit ?? 'kg',
  );
  const minInput = numberInput(existing?.minStock ?? 0);
  const maxInput = numberInput(existing?.maxStock ?? 0);
  const stockInput = numberInput(0);
  const priceInput = numberInput(0);

  const body = el('form', { class: 'form' }, [
    field('نام ماده اولیه', nameInput),
    field('دسته‌بندی', categorySelect),
    field('واحد', unitSelect),
    field('حد آستانه (هشدار کسری موجودی)', minInput),
    field('حد بالا (سقف موجودی)', maxInput),
    !existing ? field('موجودی اولیه', stockInput) : null,
    !existing ? field('قیمت خرید اولیه (هر واحد، تومان)', priceInput) : null,
    existing
      ? el('p', { class: 'form-hint' }, [
          `موجودی فعلی: ${toPersian(existing.currentStock)} ${formatUnit(existing.unit)} — برای تغییر موجودی از «ثبت خرید» استفاده کنید.`,
        ])
      : null,
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, [existing ? 'ذخیره تغییرات' : 'افزودن ماده اولیه']),
    ]),
  ]);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      showToast('نام ماده اولیه الزامی است', 'error');
      return;
    }
    const minStock = parseNumberInput(minInput);
    const maxStock = parseNumberInput(maxInput);
    if (maxStock > 0 && maxStock < minStock) {
      showToast('سقف موجودی باید بیشتر از حد آستانه باشد', 'error');
      return;
    }

    try {
      if (existing) {
        await db.updateIngredient(existing.id, {
          name,
          category: categorySelect.value as IngredientCategory,
          unit: unitSelect.value as Unit,
          minStock,
          maxStock,
        });
      } else {
        await db.createIngredient({
          name,
          category: categorySelect.value as IngredientCategory,
          unit: unitSelect.value as Unit,
          minStock,
          maxStock,
          currentStock: parseNumberInput(stockInput),
          pricePerUnit: parseNumberInput(priceInput),
        });
      }
      await refreshIngredients();
      scheduleRecalculation();
      showToast(existing ? 'تغییرات ذخیره شد' : 'ماده اولیه افزوده شد', 'success');
      modal.close();
    } catch {
      showToast('خطا در ذخیره‌سازی', 'error');
    }
  });

  const modal = openModal({ title: existing ? 'ویرایش ماده اولیه' : 'افزودن ماده اولیه', body });
}


function openPurchaseModal(ingredient: Ingredient): void {
  const qtyInput = numberInput(0);
  const priceInput = numberInput(ingredient.pricePerUnit);
  const dateInput = el('input', { type: 'date', class: 'input', value: todayISO().slice(0, 10) });
  const supplierInput = el('input', { type: 'text', class: 'input' });
  const noteInput = el('input', { type: 'text', class: 'input' });

  const body = el('form', { class: 'form' }, [
    el('p', { class: 'form-hint' }, [
      `موجودی فعلی: ${toPersian(ingredient.currentStock)} ${formatUnit(ingredient.unit)} — میانگین قیمت: ${formatMoney(ingredient.pricePerUnit)}`,
    ]),
    field(`مقدار خرید (${formatUnit(ingredient.unit)})`, qtyInput),
    field('قیمت خرید (هر واحد، تومان)', priceInput),
    field('تاریخ خرید', dateInput),
    field('تامین‌کننده (اختیاری)', supplierInput),
    field('یادداشت (اختیاری)', noteInput),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, ['ثبت خرید']),
    ]),
  ]);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const quantity = parseNumberInput(qtyInput);
    const pricePerUnit = parseNumberInput(priceInput);
    if (quantity <= 0 || pricePerUnit <= 0) {
      showToast('مقدار و قیمت باید بیشتر از صفر باشد', 'error');
      return;
    }
    await db.recordPurchase(ingredient.id, {
      quantity,
      pricePerUnit,
      date: dateInput.value ? new Date(dateInput.value).toISOString() : todayISO(),
      supplier: supplierInput.value.trim() || undefined,
      note: noteInput.value.trim() || undefined,
    });
    await refreshIngredients();
    scheduleRecalculation();
    showToast('خرید ثبت شد', 'success');
    modal.close();
  });

  const modal = openModal({ title: `ثبت خرید — ${ingredient.name}`, body });
}

function openPhysicalCountModal(ingredient: Ingredient): void {
  const qtyInput = numberInput(ingredient.currentStock);

  const body = el('form', { class: 'form' }, [
    el('p', { class: 'form-hint' }, [
      `موجودی سیستمی فعلی: ${toPersian(ingredient.currentStock)} ${formatUnit(ingredient.unit)} — مقدار شمارش‌شده واقعی را وارد کنید.`,
    ]),
    field(`مقدار شمارش‌شده (${formatUnit(ingredient.unit)})`, qtyInput),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, ['ثبت شمارش']),
    ]),
  ]);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const quantity = parseNumberInput(qtyInput);
    if (quantity < 0) {
      showToast('مقدار نمی‌تواند منفی باشد', 'error');
      return;
    }
    await db.recordPhysicalCount(ingredient.id, quantity, currentUser.get()?.name ?? 'نامشخص');
    await refreshIngredients();
    scheduleRecalculation();
    showToast('شمارش فیزیکی ثبت شد', 'success');
    modal.close();
  });

  const modal = openModal({ title: `ثبت شمارش فیزیکی — ${ingredient.name}`, body });
}

function renderPurchaseRow(ingredient: Ingredient, record: PurchaseRecord): HTMLElement {
  const row = el('div', { class: 'purchase-history-row' });

  function showView(): void {
    row.innerHTML = '';
    row.append(
      el('span', { class: 'purchase-history-row__date' }, [formatDateShort(record.date)]),
      el('span', { class: 'purchase-history-row__qty' }, [`${toPersian(record.quantity)} ${formatUnit(ingredient.unit)}`]),
      el('span', { class: 'purchase-history-row__price' }, [formatMoney(record.pricePerUnit)]),
      el('span', { class: 'purchase-history-row__meta' }, [[record.supplier, record.note].filter(Boolean).join(' — ')]),
      iconBtn('edit', 'ویرایش', showEdit),
    );
  }

  function showEdit(): void {
    const qtyInput = numberInput(record.quantity, 'input--sm');
    const priceInput = numberInput(record.pricePerUnit, 'input--sm');
    const dateInput = el('input', { type: 'date', class: 'input input--sm', value: record.date.slice(0, 10) });
    const supplierInput = el('input', { type: 'text', class: 'input input--sm', value: record.supplier ?? '' });

    async function save(): Promise<void> {
      await db.updatePurchaseHistoryEntry(ingredient.id, record.id, {
        quantity: parseNumberInput(qtyInput),
        pricePerUnit: parseNumberInput(priceInput),
        date: dateInput.value ? new Date(dateInput.value).toISOString() : record.date,
        supplier: supplierInput.value.trim() || undefined,
      });
      await refreshIngredients();
      scheduleRecalculation();
      showToast('رکورد خرید به‌روزرسانی شد', 'success');
    }

    row.innerHTML = '';
    row.append(
      qtyInput,
      priceInput,
      dateInput,
      supplierInput,
      iconBtn('check', 'ذخیره', save),
      iconBtn('x', 'انصراف', showView),
    );
  }

  showView();
  return row;
}

function openPurchaseHistoryModal(ingredientId: string): void {
  const body = el('div', { class: 'purchase-history' });

  function render(): void {
    const ingredient = ingredients.get().find((i) => i.id === ingredientId);
    if (!ingredient) {
      modal.close();
      return;
    }
    body.innerHTML = '';
    const history = [...ingredient.purchaseHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (!history.length) {
      body.appendChild(emptyState({ icon: 'receipt', title: 'تاریخچه خریدی ثبت نشده است' }));
      return;
    }
    const list = el('div', { class: 'purchase-history-list' });
    for (const record of history) list.appendChild(renderPurchaseRow(ingredient, record));
    body.appendChild(list);
  }

  let unsub = () => {};
  const modal = openModal({ title: 'تاریخچه خرید', body, maxWidth: '560px', onClose: () => unsub() });
  unsub = ingredients.subscribe(render);
}

async function handleDelete(ingredient: Ingredient): Promise<void> {
  const confirmed = await confirmModal({
    title: 'حذف ماده اولیه',
    message: `ماده اولیه «${ingredient.name}» برای همیشه حذف می‌شود.`,
    confirmLabel: 'حذف',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await db.deleteIngredient(ingredient.id);
    await refreshIngredients();
    scheduleRecalculation();
    showToast('ماده اولیه حذف شد', 'success');
  } catch (err) {
    if (err instanceof db.IngredientInUseError) {
      const confirmed = await confirmModal({
        title: 'این ماده در دستور پخت استفاده شده است',
        message: `«${ingredient.name}» در ${toPersian(err.recipes.length)} آیتم منو استفاده شده است. در صورت حذف، این ماده از دستورهای زیر نیز حذف می‌شود:`,
        details: err.recipes.map((r) => r.name),
        confirmLabel: 'حذف در هر صورت',
        danger: true,
      });
      if (confirmed) {
        await db.deleteIngredient(ingredient.id, true);
        await refreshIngredients();
        await refreshMenuItems();
        scheduleRecalculation();
        showToast('ماده اولیه حذف شد', 'success');
      }
    } else {
      showToast('خطا در حذف ماده اولیه', 'error');
    }
  }
}

function renderIngredientCard(ingredient: Ingredient): HTMLElement {
  const pct = ingredient.maxStock > 0 ? Math.min(100, Math.max(0, (ingredient.currentStock / ingredient.maxStock) * 100)) : 0;
  const status = ingredient.currentStock <= ingredient.minStock ? 'low' : ingredient.currentStock >= ingredient.maxStock ? 'full' : 'ok';
  const canEdit = hasFullAccess() || hasRole('warehouse');
  const isPredictedStockout = ingredient.dailyUsageRate > 0 && ingredient.daysOfStockRemaining <= STOCKOUT_WARNING_DAYS;

  return el('div', { class: 'ingredient-card' }, [
    el('div', { class: 'ingredient-card__main' }, [
      el('div', { class: 'ingredient-card__title-row' }, [
        el('span', { class: 'ingredient-card__name' }, [ingredient.name]),
        el('span', { class: 'badge' }, [formatIngredientCategory(ingredient.category)]),
      ]),
      el('div', { class: 'stock-bar' }, [el('div', { class: `stock-bar__fill stock-bar__fill--${status}`, style: `width:${pct}%` })]),
      el('div', { class: 'ingredient-card__meta' }, [
        `${toPersian(ingredient.currentStock)} / ${toPersian(ingredient.maxStock)} ${formatUnit(ingredient.unit)} · میانگین قیمت: ${formatMoney(ingredient.pricePerUnit)}`,
      ]),
      ingredient.dailyUsageRate > 0
        ? (() => {
            const predictEl = el('div', { class: `ingredient-card__predict${isPredictedStockout ? ' ingredient-card__predict--warning' : ''}` }, []);
            predictEl.append(svgIcon('trending-down', 14), ` با نرخ مصرف فعلی، تا ${toPersian(Math.round(ingredient.daysOfStockRemaining))} روز دیگر تمام می‌شود`);
            return predictEl;
          })()
        : null,
      ingredient.lastPhysicalCount
        ? el('div', { class: 'ingredient-card__meta ingredient-card__meta--muted' }, [
            `آخرین شمارش فیزیکی: ${formatDateShort(ingredient.lastPhysicalCount.date)} توسط ${ingredient.lastPhysicalCount.countedBy}`,
          ])
        : null,
    ]),
    el('div', { class: 'ingredient-card__actions' }, [
      status === 'low'
        ? el('button', { class: 'btn btn-warning btn-sm', type: 'button', onclick: () => renderCreateRequestModal(ingredient) }, ['درخواست خرید'])
        : null,
      canEdit ? el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => openPurchaseModal(ingredient) }, ['ثبت خرید']) : null,
      canEdit ? iconBtn('clipboard', 'ثبت شمارش فیزیکی', () => openPhysicalCountModal(ingredient)) : null,
      iconBtn('receipt', 'تاریخچه خرید', () => openPurchaseHistoryModal(ingredient.id)),
      canEdit ? iconBtn('edit', 'ویرایش', () => openIngredientFormModal(ingredient)) : null,
      canEdit ? iconBtn('trash', 'حذف', () => handleDelete(ingredient)) : null,
    ]),
  ]);
}

function renderIngredientsStatsPanel(
  all: Ingredient[],
  actions: { onSortByValue: () => void; onShowShortage: () => void; onSortByStockout: () => void },
): HTMLElement {
  const lowStock = lowStockIngredients(all);
  const predictedStockouts = all.filter((i) => i.dailyUsageRate > 0 && i.daysOfStockRemaining <= STOCKOUT_WARNING_DAYS);
  return el('div', { class: 'kpi-grid' }, [
    kpiCard('wallet', 'ارزش انبار', formatMoneyShort(inventoryValue(all)), undefined, actions.onSortByValue),
    kpiCard('alert-triangle', 'اقلام رو به اتمام', toPersian(lowStock.length), lowStock.length > 0 ? 'warning' : undefined, actions.onShowShortage),
    kpiCard('trending-down', 'پیش‌بینی اتمام موجودی', toPersian(predictedStockouts.length), predictedStockouts.length > 0 ? 'warning' : undefined, actions.onSortByStockout),
  ]);
}

export async function renderIngredients(container: HTMLElement): Promise<RouteCleanup> {
  const root = el('div', { class: 'view view-ingredients' });
  container.appendChild(root);

  const statsContainer = el('div');
  const searchInput = el('input', { type: 'text', class: 'input', placeholder: 'جستجوی ماده اولیه...' });
  const categorySelect = selectEl(
    [{ value: '', label: 'همه دسته‌ها' }, ...CATEGORY_OPTIONS.map((c) => ({ value: c, label: formatIngredientCategory(c) }))],
    '',
  );
  const sortSelect = selectEl(
    [
      { value: 'name', label: 'مرتب‌سازی: نام' },
      { value: 'stock', label: 'مرتب‌سازی: کمترین موجودی' },
      { value: 'category', label: 'مرتب‌سازی: دسته‌بندی' },
      { value: 'value', label: 'مرتب‌سازی: بیشترین ارزش' },
      { value: 'stockout', label: 'مرتب‌سازی: نزدیک‌ترین اتمام' },
    ],
    'name',
  );
  const lowStockOnlyCheckbox = el('input', { type: 'checkbox' });
  const listEl = el('div', { class: 'ingredient-list' });

  const intent = takeNavigationIntent();
  if (intent.sortByValue) sortSelect.value = 'value';
  if (intent.lowStockOnly) lowStockOnlyCheckbox.checked = true;

  const statsActions = {
    onSortByValue: () => {
      sortSelect.value = 'value';
      renderList();
    },
    onShowShortage: () => navigate('/shopping'),
    onSortByStockout: () => {
      sortSelect.value = 'stockout';
      renderList();
    },
  };

  root.append(
    el('div', { class: 'view-header' }, [
      el('h1', { class: 'view-header__title' }, ['انبار مواد اولیه']),
      hasFullAccess() || hasRole('warehouse')
        ? el('button', { class: 'btn btn-primary', type: 'button', onclick: () => openIngredientFormModal() }, ['+ افزودن ماده اولیه'])
        : null,
    ]),
    statsContainer,
    el('div', { class: 'toolbar' }, [
      searchInput,
      categorySelect,
      sortSelect,
      el('label', { class: 'toolbar__checkbox' }, [lowStockOnlyCheckbox, ' فقط کسری موجودی']),
    ]),
    listEl,
  );

  function renderList(): void {
    listEl.innerHTML = '';
    const all = ingredients.get();
    statsContainer.innerHTML = '';
    statsContainer.appendChild(renderIngredientsStatsPanel(all, statsActions));
    let list = all;

    const term = searchInput.value.trim();
    if (term) list = list.filter((i) => i.name.includes(term));

    const category = categorySelect.value;
    if (category) list = list.filter((i) => i.category === category);

    if (lowStockOnlyCheckbox.checked) list = list.filter((i) => i.currentStock <= i.minStock);

    const sortBy = sortSelect.value;
    list = [...list].sort((a, b) => {
      if (sortBy === 'stock') return a.currentStock - b.currentStock;
      if (sortBy === 'category') return a.category.localeCompare(b.category);
      if (sortBy === 'value') return b.currentStock * b.pricePerUnit - a.currentStock * a.pricePerUnit;
      if (sortBy === 'stockout') return a.daysOfStockRemaining - b.daysOfStockRemaining;
      return a.name.localeCompare(b.name, 'fa');
    });

    if (!list.length) {
      listEl.appendChild(
        emptyState({
          icon: 'box',
          title: all.length ? 'نتیجه‌ای یافت نشد' : 'هنوز مواد اولیه‌ای ثبت نشده است',
          message: all.length ? 'فیلترها را تغییر دهید.' : 'اولین ماده اولیه را اضافه کنید.',
          ctaLabel: all.length || !(hasFullAccess() || hasRole('warehouse')) ? undefined : 'افزودن ماده اولیه',
          onCta: all.length || !(hasFullAccess() || hasRole('warehouse')) ? undefined : () => openIngredientFormModal(),
        }),
      );
      return;
    }

    for (const ingredient of list) listEl.appendChild(renderIngredientCard(ingredient));
  }

  searchInput.addEventListener('input', renderList);
  categorySelect.addEventListener('change', renderList);
  sortSelect.addEventListener('change', renderList);
  lowStockOnlyCheckbox.addEventListener('change', renderList);

  const unsub = ingredients.subscribe(renderList);

  return () => unsub();
}
