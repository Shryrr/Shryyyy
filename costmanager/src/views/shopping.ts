import * as db from '../db';
import { showToast } from '../components/toast';
import { el, emptyState, numberInput, parseNumberInput } from '../utils/dom';
import { formatMoney, formatUnit, toPersian } from '../utils/format';
import { shareOrCopyText } from '../utils/export';
import type { RouteCleanup } from '../router';
import { refreshShoppingList, shoppingList } from '../store';
import type { ShoppingListItem } from '../types';

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

function renderShoppingRow(item: ShoppingListItem): HTMLElement {
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

  return el('div', { class: `shopping-row${item.checked ? ' shopping-row--checked' : ''}` }, [
    checkbox,
    el('div', { class: 'shopping-row__main' }, [
      el('div', { class: 'shopping-row__title-row' }, [
        el('span', { class: 'shopping-row__name' }, [item.ingredientName]),
        el('span', { class: 'shopping-row__stock' }, [
          `موجودی: ${toPersian(item.currentStock)} ${formatUnit(item.unit)} · حد آستانه: ${toPersian(item.minStock)} ${formatUnit(item.unit)}`,
        ]),
      ]),
      el('div', { class: 'shopping-row__controls' }, [qtyInput, el('span', { class: 'shopping-row__unit' }, [formatUnit(item.unit)]), noteInput]),
    ]),
    el('span', { class: 'shopping-row__cost' }, [formatMoney(item.estimatedCost)]),
  ]);
}

export async function renderShopping(container: HTMLElement): Promise<RouteCleanup> {
  const root = el('div', { class: 'view view-shopping' });
  container.appendChild(root);

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
    listEl,
    footerEl,
  );

  function render(): void {
    listEl.innerHTML = '';
    const items = [...shoppingList.get()].sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      return a.ingredientName.localeCompare(b.ingredientName, 'fa');
    });

    if (!items.length) {
      listEl.appendChild(
        emptyState({ icon: '🛒', title: 'لیست خرید خالی است', message: 'موجودی همهٔ مواد اولیه بالاتر از حد آستانه است.' }),
      );
      footerEl.innerHTML = '';
      return;
    }

    for (const item of items) listEl.appendChild(renderShoppingRow(item));

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
