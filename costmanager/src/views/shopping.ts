import * as db from '../db';
import { openModal } from '../components/modal';
import { showToast } from '../components/toast';
import { el, emptyState, kpiCard, numberInput, parseNumberInput } from '../utils/dom';
import { formatDateShort, formatIngredientCategory, formatMoney, formatUnit, toPersian } from '../utils/format';
import { shareOrCopyText } from '../utils/export';
import type { RouteCleanup } from '../router';
import { ingredientsById, refreshShoppingList, shoppingList } from '../store';
import type { Ingredient, IngredientCategory, ShoppingListItem } from '../types';

function buildShareText(items: ShoppingListItem[]): string {
  const lines = ['🛒 لیست خرید مواد اولیه', ''];
  for (const item of items) {
    const mark = item.checked ? '✓' : '◻';
    const note = item.note ? ` (${item.note})` : '';
    lines.push(`${mark} ${item.ingredientName} — ${toPersian(item.suggestedQty)} ${formatUnit(item.unit)}${note}`);
  }
  const total = items.reduce((sum, i) => sum + i.estimatedCost, 0);
  lines.push('', `مجموع برآورد: ${formatMoney(total)}`);
  return lines.join('\n');
}

function lastPurchaseLabel(ingredient: Ingredient | undefined): string | null {
  if (!ingredient?.purchaseHistory?.length) return null;
  const latest = [...ingredient.purchaseHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  return `آخرین خرید: ${formatDateShort(latest.date)} · ${formatMoney(latest.pricePerUnit)}`;
}

function budgetTone(amount: number): 'positive' | 'warning' | 'negative' {
  if (amount > 10_000_000) return 'negative';
  if (amount >= 5_000_000) return 'warning';
  return 'positive';
}

function renderBudgetSection(container: HTMLElement, items: ShoppingListItem[]): void {
  container.innerHTML = '';
  if (!items.length) return;

  const idMap = ingredientsById();
  const byCategory = new Map<IngredientCategory, number>();
  for (const item of items) {
    const category = idMap.get(item.ingredientId)?.category ?? 'other';
    byCategory.set(category, (byCategory.get(category) ?? 0) + item.estimatedCost);
  }
  const total = items.reduce((sum, i) => sum + i.estimatedCost, 0);

  const cards = [
    kpiCard('💰', 'مجموع بودجه خرید', formatMoney(total), budgetTone(total)),
    ...Array.from(byCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => kpiCard('📦', formatIngredientCategory(category), formatMoney(amount), budgetTone(amount))),
  ];

  container.appendChild(
    el('div', { class: 'chart-card' }, [
      el('h3', { class: 'chart-card__title' }, ['بودجه خرید بر اساس دسته‌بندی']),
      el('div', { class: 'kpi-grid' }, cards),
    ]),
  );
}

function renderShoppingRow(item: ShoppingListItem, ingredient?: Ingredient): HTMLElement {
  const checkbox = el('input', { type: 'checkbox', checked: item.checked });
  checkbox.addEventListener('change', async () => {
    await db.toggleShoppingItemChecked(item.id);
    await refreshShoppingList();
  });

  const qtyInput = numberInput(item.suggestedQty, 'input--sm');
  qtyInput.addEventListener('change', async () => {
    await db.updateShoppingItem(item.id, { suggestedQty: parseNumberInput(qtyInput) });
    await refreshShoppingList();
  });

  const noteInput = el('input', {
    type: 'text',
    class: 'input input--sm',
    placeholder: 'یادداشت (اختیاری)',
    value: item.note ?? '',
  });
  noteInput.addEventListener('change', async () => {
    await db.updateShoppingItem(item.id, { note: noteInput.value.trim() || undefined });
    await refreshShoppingList();
  });

  const lastPurchase = lastPurchaseLabel(ingredient);

  return el('div', { class: `shopping-row${item.checked ? ' shopping-row--checked' : ''}` }, [
    checkbox,
    el('div', { class: 'shopping-row__main' }, [
      el('div', { class: 'shopping-row__title-row' }, [
        el('span', { class: 'shopping-row__name' }, [item.ingredientName]),
        el('span', { class: 'shopping-row__stock' }, [
          `موجودی: ${toPersian(item.currentStock)} ${formatUnit(item.unit)} · حد آستانه: ${toPersian(item.minStock)} ${formatUnit(item.unit)}`,
        ]),
      ]),
      lastPurchase ? el('div', { class: 'shopping-row__last-purchase' }, [lastPurchase]) : null,
      el('div', { class: 'shopping-row__controls' }, [qtyInput, el('span', { class: 'shopping-row__unit' }, [formatUnit(item.unit)]), noteInput]),
    ]),
    el('span', { class: 'shopping-row__cost' }, [formatMoney(item.estimatedCost)]),
  ]);
}

export async function renderShopping(container: HTMLElement): Promise<RouteCleanup> {
  const root = el('div', { class: 'view view-shopping' });
  container.appendChild(root);

  const budgetEl = el('div');
  const listEl = el('div', { class: 'shopping-list' });
  const footerEl = el('div', { class: 'shopping-footer' });

  async function handleRegenerate(): Promise<void> {
    await db.regenerateShoppingList();
    await refreshShoppingList();
    showToast('لیست خرید بازسازی شد', 'success');
  }

  async function handleShare(): Promise<void> {
    const items = shoppingList.get();
    if (!items.length) {
      showToast('لیست خرید خالی است', 'error');
      return;
    }
    try {
      const result = await shareOrCopyText(buildShareText(items));
      showToast(result === 'shared' ? 'لیست خرید به اشتراک گذاشته شد' : 'لیست خرید در کلیپ‌بورد کپی شد', 'success');
    } catch {
      showToast('خطا در اشتراک‌گذاری', 'error');
    }
  }

  root.append(
    el('div', { class: 'view-header' }, [
      el('h1', { class: 'view-header__title' }, ['لیست خرید']),
      el('div', { class: 'view-header__actions' }, [
        el('button', { class: 'btn btn-secondary', type: 'button', onclick: handleShare }, ['اشتراک‌گذاری']),
        el('button', { class: 'btn btn-primary', type: 'button', onclick: handleRegenerate }, ['↻ بازسازی لیست']),
      ]),
    ]),
    budgetEl,
    listEl,
    footerEl,
  );

  function render(): void {
    listEl.innerHTML = '';
    const items = [...shoppingList.get()].sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      return a.ingredientName.localeCompare(b.ingredientName, 'fa');
    });

    renderBudgetSection(budgetEl, items);

    if (!items.length) {
      listEl.appendChild(
        emptyState({ icon: '🛒', title: 'لیست خرید خالی است', message: 'موجودی همهٔ مواد اولیه بالاتر از حد آستانه است.' }),
      );
      footerEl.innerHTML = '';
      return;
    }

    const idMap = ingredientsById();
    for (const item of items) listEl.appendChild(renderShoppingRow(item, idMap.get(item.ingredientId)));

    const totalCost = items.reduce((sum, i) => sum + i.estimatedCost, 0);
    const checkedCount = items.filter((i) => i.checked).length;
    footerEl.innerHTML = '';
    footerEl.append(
      el('span', { class: 'shopping-footer__progress' }, [`${toPersian(checkedCount)} از ${toPersian(items.length)} مورد تهیه شده`]),
      el('span', { class: 'shopping-footer__total' }, [`مجموع برآورد: ${formatMoney(totalCost)}`]),
    );
  }

  const unsub = shoppingList.subscribe(render);
  return () => unsub();
}

export function openBuyerShoppingModal(): void {
  const items = [...shoppingList.get()].sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    return a.ingredientName.localeCompare(b.ingredientName, 'fa');
  });
  const idMap = ingredientsById();

  const listBody = items.length
    ? el('div', { class: 'shopping-list' }, items.map((item) => renderShoppingRow(item, idMap.get(item.ingredientId))))
    : emptyState({ icon: '🛒', title: 'لیست خرید خالی است' });

  async function handleSendToManager(): Promise<void> {
    try {
      const result = await shareOrCopyText(buildShareText(items));
      showToast(result === 'shared' ? 'لیست خرید به اشتراک گذاشته شد' : 'لیست خرید در کلیپ‌بورد کپی شد', 'success');
    } catch {
      showToast('خطا در اشتراک‌گذاری', 'error');
    }
  }

  const body = el('div', { class: 'form' }, [
    listBody,
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: handleSendToManager }, ['ارسال به مدیر']),
      el('button', { type: 'button', class: 'btn btn-primary', onclick: () => modal.close() }, ['تأیید']),
    ]),
  ]);

  const modal = openModal({ title: '🛒 لیست خرید امروز', body, maxWidth: '480px' });
}
