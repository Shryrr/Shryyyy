import * as db from '../db';
import { hasFullAccess } from '../auth';
import { confirmModal, openModal } from '../components/modal';
import { showToast } from '../components/toast';
import { el, emptyState, field, iconBtn, iconTextBtn, kpiCard, numberInput, parseNumberInput, selectEl } from '../utils/dom';
import { formatMoney, formatPct, formatUnit, toPersian } from '../utils/format';
import { navigate } from '../router';
import type { RouteCleanup } from '../router';
import { ingredients, ingredientsById, menuItems, refreshMenuItems, settings, takeNavigationIntent } from '../store';
import {
  avgFoodCostPct,
  foodCostPct,
  foodCostStatus,
  grossProfit,
  recipeCost,
  suggestedPriceForTarget,
} from '../utils/calc';
import type { Ingredient, MenuItem } from '../types';

function openRecipeBuilderModal(existingId?: string): void {
  const existing = existingId ? menuItems.get().find((m) => m.id === existingId) : undefined;
  const isNew = !existing;

  const nameInput = el('input', { type: 'text', class: 'input', value: existing?.name ?? '' });
  const categoryListId = `menu-categories-${existingId ?? 'new'}`;
  const existingCategories = Array.from(new Set(menuItems.get().map((m) => m.category))).filter(Boolean);
  const categoryInput = el('input', { type: 'text', class: 'input', list: categoryListId, value: existing?.category ?? '' });
  const datalist = el(
    'datalist',
    { id: categoryListId },
    existingCategories.map((c) => el('option', { value: c })),
  );
  const priceInput = numberInput(existing?.salePrice ?? 0);
  const recipeSection = el('div', { class: 'recipe-section' });

  async function handleCreate(): Promise<void> {
    const name = nameInput.value.trim();
    if (!name) {
      showToast('نام آیتم منو الزامی است', 'error');
      return;
    }
    const created = await db.createMenuItem({
      name,
      category: categoryInput.value.trim() || 'سایر',
      salePrice: parseNumberInput(priceInput),
    });
    await refreshMenuItems();
    modal.close();
    openRecipeBuilderModal(created.id);
  }

  async function handleSave(): Promise<void> {
    if (!existingId) return;
    const name = nameInput.value.trim();
    if (!name) {
      showToast('نام آیتم منو الزامی است', 'error');
      return;
    }
    await db.updateMenuItem(existingId, {
      name,
      category: categoryInput.value.trim() || 'سایر',
      salePrice: parseNumberInput(priceInput),
    });
    await refreshMenuItems();
    showToast('تغییرات ذخیره شد', 'success');
  }

  function renderRecipeSection(): void {
    recipeSection.innerHTML = '';
    if (!existingId) return;
    const itemId = existingId;
    const item = menuItems.get().find((m) => m.id === itemId);
    if (!item) {
      modal.close();
      return;
    }

    const ingById = ingredientsById();
    const usedIds = new Set(item.recipe.map((r) => r.ingredientId));
    const available = ingredients.get().filter((i) => !usedIds.has(i.id));

    const ingredientSelect = selectEl(available.map((i) => ({ value: i.id, label: `${i.name} (${formatUnit(i.unit)})` })));
    const qtyInput = numberInput(0);

    async function addRow(): Promise<void> {
      const ingredientId = ingredientSelect.value;
      const qty = parseNumberInput(qtyInput);
      if (!ingredientId || qty <= 0) {
        showToast('مواد اولیه و مقدار را مشخص کنید', 'error');
        return;
      }
      await db.setRecipeIngredientQty(itemId, ingredientId, qty);
      await refreshMenuItems();
    }

    const listEl = el('div', { class: 'recipe-ingredient-list' });
    if (!item.recipe.length) {
      listEl.appendChild(emptyState({ icon: 'utensils', title: 'هنوز موردی به دستور پخت اضافه نشده' }));
    } else {
      for (const ri of item.recipe) {
        const ingredient = ingById.get(ri.ingredientId);
        if (!ingredient) {
          listEl.appendChild(
            el('div', { class: 'recipe-ingredient-row' }, [
              el('span', { class: 'recipe-ingredient-row__name recipe-ingredient-row__name--deleted' }, ['ماده حذف‌شده ⚠']),
              el('span', { class: 'recipe-ingredient-row__unit' }, [toPersian(ri.quantity)]),
              el('span', { class: 'recipe-ingredient-row__cost' }, ['هزینه: —']),
              iconBtn('trash', 'حذف', async () => {
                await db.removeRecipeIngredient(itemId, ri.ingredientId);
                await refreshMenuItems();
              }),
            ]),
          );
          continue;
        }
        const rowQtyInput = numberInput(ri.quantity, 'input--sm');
        rowQtyInput.addEventListener('change', async () => {
          const qty = parseNumberInput(rowQtyInput);
          if (qty <= 0) await db.removeRecipeIngredient(itemId, ingredient.id);
          else await db.setRecipeIngredientQty(itemId, ingredient.id, qty);
          await refreshMenuItems();
        });
        listEl.appendChild(
          el('div', { class: 'recipe-ingredient-row' }, [
            el('span', { class: 'recipe-ingredient-row__name' }, [ingredient.name]),
            rowQtyInput,
            el('span', { class: 'recipe-ingredient-row__unit' }, [formatUnit(ingredient.unit)]),
            el('span', { class: 'recipe-ingredient-row__cost' }, [`هزینه: ${formatMoney(ri.quantity * ingredient.pricePerUnit)}`]),
            iconBtn('trash', 'حذف', async () => {
              await db.removeRecipeIngredient(itemId, ingredient.id);
              await refreshMenuItems();
            }),
          ]),
        );
      }
    }

    const cost = recipeCost(item.recipe, ingById);
    const salePrice = parseNumberInput(priceInput);
    const pct = foodCostPct(cost, salePrice);
    const status = foodCostStatus(pct);
    const profit = grossProfit(salePrice, cost);
    const targetPercent = settings.get()?.targetFoodCostPercent ?? 30;
    const suggested = suggestedPriceForTarget(cost, targetPercent);

    const calcPanel = el('div', { class: `recipe-calc-panel recipe-calc-panel--${status}` }, [
      el('div', { class: 'recipe-calc-panel__row' }, [el('span', {}, ['بهای تمام‌شده:']), el('span', {}, [formatMoney(cost)])]),
      el('div', { class: 'recipe-calc-panel__row' }, [el('span', {}, ['فودکاست:']), el('span', {}, [formatPct(pct)])]),
      el('div', { class: 'recipe-calc-panel__row' }, [el('span', {}, ['سود ناخالص:']), el('span', {}, [formatMoney(profit)])]),
      el('div', { class: 'recipe-calc-panel__row' }, [
        el('span', {}, [`قیمت پیشنهادی برای فودکاست ${formatPct(targetPercent, 0)}:`]),
        el('span', {}, [formatMoney(suggested)]),
      ]),
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-secondary btn-sm',
          onclick: () => {
            priceInput.value = toPersian(Math.round(suggested));
            renderRecipeSection();
          },
        },
        ['اعمال قیمت پیشنهادی'],
      ),
    ]);

    recipeSection.append(
      el('hr'),
      el('h4', { class: 'recipe-section__title' }, ['اجزای دستور پخت']),
      el('div', { class: 'recipe-picker-row' }, [
        ingredientSelect,
        qtyInput,
        el('button', { type: 'button', class: 'btn btn-secondary btn-sm', onclick: addRow }, ['+ افزودن']),
      ]),
      listEl,
      calcPanel,
    );
  }

  let scheduled = false;
  function scheduleRender(): void {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      renderRecipeSection();
    });
  }
  priceInput.addEventListener('input', scheduleRender);

  const body = el('div', { class: 'form' }, [
    field('نام آیتم منو', nameInput),
    field('دسته‌بندی', categoryInput),
    datalist,
    field('قیمت فروش (تومان)', priceInput),
    recipeSection,
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['بستن']),
      el(
        'button',
        { type: 'button', class: 'btn btn-primary', onclick: () => (isNew ? handleCreate() : handleSave()) },
        [isNew ? 'ایجاد و افزودن مواد اولیه' : 'ذخیره تغییرات'],
      ),
    ]),
  ]);

  let unsubMenuItems = () => {};
  let unsubIngredients = () => {};
  const modal = openModal({
    title: isNew ? 'افزودن آیتم منو' : `ویرایش — ${existing!.name}`,
    body,
    maxWidth: '560px',
    onClose: () => {
      unsubMenuItems();
      unsubIngredients();
    },
  });
  unsubMenuItems = menuItems.subscribe(scheduleRender);
  unsubIngredients = ingredients.subscribe(scheduleRender);
}

async function handleDelete(item: MenuItem): Promise<void> {
  const confirmed = await confirmModal({
    title: 'حذف آیتم منو',
    message: `آیتم «${item.name}» برای همیشه حذف می‌شود. این عملیات شامل سوابق فروش گذشته نمی‌شود.`,
    confirmLabel: 'حذف',
    danger: true,
  });
  if (!confirmed) return;
  await db.deleteMenuItem(item.id);
  await refreshMenuItems();
  showToast('آیتم منو حذف شد', 'success');
}

async function toggleActive(item: MenuItem): Promise<void> {
  await db.updateMenuItem(item.id, { isActive: !item.isActive });
  await refreshMenuItems();
}

interface StatsPanelActions {
  onShowActive: () => void;
  onSortByFoodCost: () => void;
  onShowRiskyOnly: () => void;
  onJumpToWorst: (id: string) => void;
}

function renderStatsPanel(items: MenuItem[], ingById: Map<string, Ingredient>, actions: StatsPanelActions): HTMLElement {
  const active = items.filter((m) => m.isActive);
  const avgPct = avgFoodCostPct(items, ingById);
  const risky = active.filter((m) => foodCostStatus(foodCostPct(recipeCost(m.recipe, ingById), m.salePrice)) === 'red');
  const worst = [...active]
    .map((m) => ({ item: m, pct: foodCostPct(recipeCost(m.recipe, ingById), m.salePrice) }))
    .sort((a, b) => b.pct - a.pct)[0];

  return el('div', { class: 'kpi-grid' }, [
    kpiCard('utensils', 'آیتم‌های فعال', toPersian(active.length), undefined, actions.onShowActive),
    kpiCard('bar-chart', 'میانگین فودکاست', formatPct(avgPct), foodCostStatus(avgPct) === 'red' ? 'negative' : undefined, actions.onSortByFoodCost),
    kpiCard(
      'alert-triangle',
      'آیتم‌های پرخطر (فودکاست بالا)',
      toPersian(risky.length),
      risky.length > 0 ? 'warning' : undefined,
      actions.onShowRiskyOnly,
    ),
    kpiCard(
      'trending-up',
      'بالاترین فودکاست',
      worst ? `${worst.item.name} — ${formatPct(worst.pct)}` : '—',
      undefined,
      worst ? () => actions.onJumpToWorst(worst.item.id) : undefined,
    ),
  ]);
}

function renderRow(item: MenuItem, ingById: Map<string, Ingredient>, isHighlighted: boolean): HTMLElement {
  const cost = recipeCost(item.recipe, ingById);
  const pct = foodCostPct(cost, item.salePrice);
  const status = foodCostStatus(pct);
  const profit = grossProfit(item.salePrice, cost);

  return el('div', {
    class: `recipe-row${item.isActive ? '' : ' recipe-row--inactive'}${isHighlighted ? ' recipe-row--highlight' : ''}`,
    dataset: { menuItemId: item.id },
  }, [
    el('div', { class: 'recipe-row__main' }, [
      el('div', { class: 'recipe-row__title-row' }, [
        el('span', { class: 'recipe-row__name' }, [item.name]),
        el('span', { class: 'badge' }, [item.category]),
        !item.isActive ? el('span', { class: 'badge badge--muted' }, ['غیرفعال']) : null,
      ]),
      el('div', { class: 'recipe-row__meta' }, [
        `فروش: ${formatMoney(item.salePrice)} · بهای تمام‌شده: ${formatMoney(cost)} · سود ناخالص: ${formatMoney(profit)}`,
      ]),
    ]),
    el('div', { class: `recipe-row__pct recipe-row__pct--${status}` }, [formatPct(pct)]),
    hasFullAccess()
      ? el('div', { class: 'recipe-row__actions' }, [
          iconBtn('edit', 'ویرایش', () => openRecipeBuilderModal(item.id)),
          iconBtn(item.isActive ? 'eye' : 'eye-off', item.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی', () => toggleActive(item)),
          iconBtn('trash', 'حذف', () => handleDelete(item)),
        ])
      : null,
  ]);
}

export async function renderRecipes(container: HTMLElement): Promise<RouteCleanup> {
  const root = el('div', { class: 'view view-recipes' });
  container.appendChild(root);

  const statsContainer = el('div');
  const searchInput = el('input', { type: 'text', class: 'input', placeholder: 'جستجوی آیتم منو...' });
  const sortSelect = selectEl(
    [
      { value: 'name', label: 'مرتب‌سازی: نام' },
      { value: 'pct_desc', label: 'مرتب‌سازی: بیشترین فودکاست' },
      { value: 'profit_desc', label: 'مرتب‌سازی: بیشترین سود ناخالص' },
    ],
    'name',
  );
  const showInactiveCheckbox = el('input', { type: 'checkbox' });
  const listEl = el('div', { class: 'recipe-list' });

  let riskOnly = false;
  let highlightId: string | null = null;

  const intent = takeNavigationIntent();
  if (intent.sortBy === 'pct_desc') sortSelect.value = 'pct_desc';

  const actions: StatsPanelActions = {
    onShowActive: () => {
      riskOnly = false;
      showInactiveCheckbox.checked = false;
      searchInput.value = '';
      sortSelect.value = 'name';
      renderAll();
    },
    onSortByFoodCost: () => {
      riskOnly = false;
      sortSelect.value = 'pct_desc';
      renderAll();
    },
    onShowRiskyOnly: () => {
      riskOnly = true;
      sortSelect.value = 'pct_desc';
      renderAll();
    },
    onJumpToWorst: (id) => {
      riskOnly = false;
      highlightId = id;
      renderAll();
      const row = listEl.querySelector(`[data-menu-item-id="${id}"]`);
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => {
        highlightId = null;
        row?.classList.remove('recipe-row--highlight');
      }, 2000);
    },
  };

  root.append(
    el('div', { class: 'view-header' }, [
      el('h1', { class: 'view-header__title' }, ['منو و فودکاست']),
      el('div', { class: 'view-header__actions' }, [
        iconTextBtn('cpu', 'مهندسی منو', 'btn btn-secondary', () => navigate('/menu-engineering')),
        hasFullAccess()
          ? el('button', { class: 'btn btn-primary', type: 'button', onclick: () => openRecipeBuilderModal() }, ['+ افزودن آیتم منو'])
          : null,
      ]),
    ]),
    statsContainer,
    el('div', { class: 'toolbar' }, [
      searchInput,
      sortSelect,
      el('label', { class: 'toolbar__checkbox' }, [showInactiveCheckbox, ' نمایش آیتم‌های غیرفعال']),
    ]),
    listEl,
  );

  function renderAll(): void {
    const items = menuItems.get();
    const ingById = ingredientsById();

    statsContainer.innerHTML = '';
    statsContainer.appendChild(renderStatsPanel(items, ingById, actions));

    listEl.innerHTML = '';
    let list = showInactiveCheckbox.checked ? items : items.filter((m) => m.isActive);

    if (riskOnly) {
      list = list.filter((m) => foodCostStatus(foodCostPct(recipeCost(m.recipe, ingById), m.salePrice)) === 'red');
    }

    const term = searchInput.value.trim();
    if (term) list = list.filter((m) => m.name.includes(term));

    const sortBy = sortSelect.value;
    list = [...list].sort((a, b) => {
      if (sortBy === 'pct_desc') {
        return foodCostPct(recipeCost(b.recipe, ingById), b.salePrice) - foodCostPct(recipeCost(a.recipe, ingById), a.salePrice);
      }
      if (sortBy === 'profit_desc') {
        return grossProfit(b.salePrice, recipeCost(b.recipe, ingById)) - grossProfit(a.salePrice, recipeCost(a.recipe, ingById));
      }
      return a.name.localeCompare(b.name, 'fa');
    });

    if (!list.length) {
      listEl.appendChild(
        emptyState({
          icon: 'utensils',
          title: items.length ? 'نتیجه‌ای یافت نشد' : 'هنوز آیتمی به منو اضافه نشده است',
          message: items.length ? 'فیلترها را تغییر دهید.' : 'اولین آیتم منو را اضافه کنید.',
          ctaLabel: items.length || !hasFullAccess() ? undefined : 'افزودن آیتم منو',
          onCta: items.length || !hasFullAccess() ? undefined : () => openRecipeBuilderModal(),
        }),
      );
      return;
    }

    for (const item of list) listEl.appendChild(renderRow(item, ingById, item.id === highlightId));
  }

  searchInput.addEventListener('input', renderAll);
  sortSelect.addEventListener('change', renderAll);
  showInactiveCheckbox.addEventListener('change', renderAll);

  const unsubMenuItems = menuItems.subscribe(renderAll);
  const unsubIngredients = ingredients.subscribe(renderAll);

  return () => {
    unsubMenuItems();
    unsubIngredients();
  };
}
