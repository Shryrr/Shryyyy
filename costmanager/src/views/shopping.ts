import * as db from '../db';
import { currentUser } from '../auth';
import { confirmModal, openModal } from '../components/modal';
import { showToast } from '../components/toast';
import { el, emptyState, field, iconBtn, iconTextBtn, kpiCard, numberInput, parseNumberInput } from '../utils/dom';
import { formatDate, formatDateTime, formatIngredientCategory, formatMoney, formatUnit, toPersian, todayISO } from '../utils/format';
import { shareOrCopyText } from '../utils/export';
import type { RouteCleanup } from '../router';
import { ingredientsById, refreshIngredients, refreshNotifications, refreshShoppingList, settings, shoppingList } from '../store';
import { scheduleRecalculation } from '../utils/inventory-engine';
import type { AppUser, Ingredient, IngredientCategory, PurchaseRequest, PurchaseRequestStatus, ShoppingListItem } from '../types';
import { api } from '../utils/api';

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
  const days = Math.max(0, Math.floor((Date.now() - new Date(latest.date).getTime()) / 86_400_000));
  return `آخرین خرید: ${toPersian(days)} روز پیش — قیمت: ${formatMoney(latest.pricePerUnit)}/واحد`;
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
    kpiCard('wallet', 'مجموع بودجه خرید', formatMoney(total), budgetTone(total)),
    ...Array.from(byCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => kpiCard('box', formatIngredientCategory(category), formatMoney(amount), budgetTone(amount))),
  ];

  container.appendChild(
    el('div', { class: 'chart-card' }, [
      el('h3', { class: 'chart-card__title' }, ['بودجه خرید بر اساس دسته‌بندی']),
      el('div', { class: 'kpi-grid' }, cards),
    ]),
  );
}

function openRecordPurchaseModal(item: ShoppingListItem, onDone: () => void): void {
  const qtyInput = numberInput(item.suggestedQty);
  const priceInput = numberInput(ingredientsById().get(item.ingredientId)?.pricePerUnit ?? 0);
  const dateInput = el('input', { type: 'date', class: 'input', value: todayISO().slice(0, 10) });
  const supplierInput = el('input', { type: 'text', class: 'input' });
  const noteInput = el('input', { type: 'text', class: 'input', value: item.note ?? '' });

  const body = el('form', { class: 'form' }, [
    field(`مقدار خرید (${formatUnit(item.unit)})`, qtyInput),
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
    await db.recordPurchase(item.ingredientId, {
      quantity,
      pricePerUnit,
      date: dateInput.value ? new Date(dateInput.value).toISOString() : todayISO(),
      supplier: supplierInput.value.trim() || undefined,
      note: noteInput.value.trim() || undefined,
    });
    if (!item.checked) await db.toggleShoppingItemChecked(item.id);
    await refreshIngredients();
    await refreshShoppingList();
    scheduleRecalculation();
    showToast('خرید ثبت شد', 'success');
    modal.close();
    onDone();
  });

  const modal = openModal({ title: `ثبت خرید — ${item.ingredientName}`, body });
}

function renderShoppingRow(item: ShoppingListItem, ingredient?: Ingredient): HTMLElement {
  const purchaseBtn = iconBtn('cart', 'ثبت خرید', () => openRecordPurchaseModal(item, () => {}));

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
    purchaseBtn,
  ]);
}

function buildPurchaseRequestText(businessName: string, userName: string, items: ShoppingListItem[], total: number): string {
  const lines = [
    `📋 درخواست خرید — ${businessName}`,
    `📅 تاریخ: ${formatDate(new Date().toISOString())}`,
    `👤 درخواست‌دهنده: ${userName}`,
    '',
    'اقلام مورد نیاز:',
    ...items.map((i) => `• ${i.ingredientName}: ${toPersian(i.suggestedQty)} ${formatUnit(i.unit)} — ~${formatMoney(i.estimatedCost)}`),
    '',
    `💰 مجموع تخمینی: ${formatMoney(total)}`,
    '',
    'ارسال از منوبان 📱',
  ];
  return lines.join('\n');
}

const PR_STATUS_LABELS: Record<PurchaseRequestStatus, string> = {
  pending: 'در انتظار خریدار',
  accepted: 'پذیرفته‌شده',
  completed: 'تکمیل‌شده',
  cancelled: 'لغوشده',
};

const PR_STATUS_TONE: Record<PurchaseRequestStatus, string> = {
  pending: 'badge--warning',
  accepted: 'badge--primary',
  completed: 'badge--success',
  cancelled: 'badge--danger',
};

function openCreatePurchaseRequestModal(items: ShoppingListItem[], onDone: () => void): void {
  const total = items.reduce((sum, i) => sum + i.estimatedCost, 0);
  const neededByInput = el('input', { type: 'datetime-local', class: 'input' });
  const noteInput = el('input', { type: 'text', class: 'input', placeholder: 'اختیاری' });

  const body = el('form', { class: 'form' }, [
    el('p', { class: 'field__hint' }, [`${toPersian(items.length)} قلم · مجموع تخمینی: ${formatMoney(total)}`]),
    field('نیاز تا تاریخ (اختیاری)', neededByInput),
    field('یادداشت (اختیاری)', noteInput),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, ['ارسال درخواست']),
    ]),
  ]);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.createPurchaseRequest({
        items: items.map((i) => ({ ingredientId: i.ingredientId, ingredientName: i.ingredientName, suggestedQty: i.suggestedQty, unit: i.unit, estimatedCost: i.estimatedCost })),
        neededByDatetime: neededByInput.value ? new Date(neededByInput.value).toISOString() : undefined,
        estimatedTotal: total,
        note: noteInput.value.trim() || undefined,
      });
      await db.createNotification({ type: 'purchase_request', title: 'درخواست خرید جدید', message: `${toPersian(items.length)} قلم · ${formatMoney(total)}`, targetRole: 'buyer', createdBy: currentUser.get()?.id ?? '' });
      await refreshNotifications();
      showToast('درخواست خرید ارسال شد ✓', 'success');
      modal.close();
      onDone();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'خطا در ارسال', 'error');
    }
  });

  const modal = openModal({ title: 'ارسال درخواست خرید', body });
}

function openAcceptPRModal(pr: PurchaseRequest, onDone: () => void): void {
  const estInput = el('input', { type: 'datetime-local', class: 'input' });
  const body = el('form', { class: 'form' }, [
    field('زمان تخمینی خرید (اختیاری)', estInput),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, ['پذیرفتن درخواست']),
    ]),
  ]);
  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.acceptPurchaseRequest(pr.id, estInput.value ? new Date(estInput.value).toISOString() : undefined);
      showToast('درخواست پذیرفته شد', 'success');
      modal.close();
      onDone();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'خطا', 'error');
    }
  });
  const modal = openModal({ title: 'پذیرفتن درخواست خرید', body });
}

function openCompletePRModal(pr: PurchaseRequest, onDone: () => void): void {
  const actualInput = numberInput(pr.estimatedTotal ?? 0);
  const noteInput = el('input', { type: 'text', class: 'input', placeholder: 'اختیاری' });

  const body = el('form', { class: 'form' }, [
    field('مبلغ واقعی خرید (تومان)', actualInput),
    field('یادداشت تکمیل (اختیاری)', noteInput),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, ['ثبت تکمیل خرید']),
    ]),
  ]);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.completePurchaseRequest(pr.id, { actualTotal: parseNumberInput(actualInput) || undefined, completionNote: noteInput.value.trim() || undefined });
      showToast('خرید ثبت شد ✓', 'success');
      modal.close();
      onDone();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'خطا', 'error');
    }
  });
  const modal = openModal({ title: 'تکمیل درخواست خرید', body });
}

function renderPurchaseRequestRow(pr: PurchaseRequest, role: string, onDone: () => void): HTMLElement {
  const canAccept = (role === 'buyer' || role === 'superadmin' || role === 'manager') && pr.status === 'pending';
  const canComplete = (role === 'buyer' || role === 'superadmin' || role === 'manager') && (pr.status === 'pending' || pr.status === 'accepted');
  const canCancel = (role === 'superadmin' || role === 'manager') && pr.status !== 'completed' && pr.status !== 'cancelled';

  return el('div', { class: 'expense-row' }, [
    el('div', { class: 'expense-row__main' }, [
      el('div', { class: 'expense-row__title-row' }, [
        el('span', { class: 'expense-row__name' }, [`درخواست خرید — ${pr.createdByName}`]),
        el('span', { class: `badge ${PR_STATUS_TONE[pr.status]}` }, [PR_STATUS_LABELS[pr.status]]),
      ]),
      el('div', { class: 'expense-row__meta' }, [
        `${toPersian(pr.items.length)} قلم · تخمین: ${formatMoney(pr.estimatedTotal ?? 0)} · ${formatDate(pr.createdAt)}`,
        pr.neededByDatetime ? ` · نیاز تا: ${formatDate(pr.neededByDatetime)}` : '',
        pr.actualTotal ? ` · پرداخت‌شده: ${formatMoney(pr.actualTotal)}` : '',
        pr.completionNote ? ` · ${pr.completionNote}` : '',
      ]),
    ]),
    el('div', { class: 'expense-row__actions' }, [
      canAccept ? iconBtn('check', 'پذیرفتن', () => openAcceptPRModal(pr, onDone)) : null,
      canComplete ? iconBtn('clipboard', 'ثبت تکمیل', () => openCompletePRModal(pr, onDone)) : null,
      canCancel ? iconBtn('x', 'لغو', async () => {
        const ok = await confirmModal({ title: 'لغو درخواست', message: 'این درخواست خرید لغو شود؟', confirmLabel: 'لغو', danger: true });
        if (!ok) return;
        try { await api.cancelPurchaseRequest(pr.id); onDone(); } catch {}
      }) : null,
    ]),
  ]);
}

async function handlePurchaseRequest(onDone: () => void): Promise<void> {
  const items = [...shoppingList.get()].sort((a, b) => a.ingredientName.localeCompare(b.ingredientName, 'fa'));
  if (!items.length) { showToast('لیست خرید خالی است', 'error'); return; }
  openCreatePurchaseRequestModal(items, onDone);
}

export async function renderShopping(container: HTMLElement): Promise<RouteCleanup> {
  const root = el('div', { class: 'view view-shopping' });
  container.appendChild(root);

  await db.regenerateShoppingList();
  await refreshShoppingList();

  const user = currentUser.get();
  const role = user?.role ?? '';

  const budgetEl = el('div');
  const listEl = el('div', { class: 'shopping-list' });
  const footerEl = el('div', { class: 'shopping-footer' });
  const prListEl = el('div', { class: 'expense-list' });

  async function handleRegenerate(): Promise<void> {
    await db.regenerateShoppingList();
    await refreshShoppingList();
    showToast('لیست خرید بازسازی شد', 'success');
  }

  async function handleShare(): Promise<void> {
    const items = shoppingList.get();
    if (!items.length) { showToast('لیست خرید خالی است', 'error'); return; }
    try {
      const result = await shareOrCopyText(buildShareText(items));
      showToast(result === 'shared' ? 'لیست خرید به اشتراک گذاشته شد' : 'لیست خرید در کلیپ‌بورد کپی شد', 'success');
    } catch {
      showToast('خطا در اشتراک‌گذاری', 'error');
    }
  }

  async function renderPRs(): Promise<void> {
    prListEl.innerHTML = '';
    try {
      const requests = await api.listPurchaseRequests();
      if (!requests.length) {
        prListEl.appendChild(emptyState({ icon: 'send', title: 'هنوز درخواست خریدی ثبت نشده است' }));
        return;
      }
      for (const pr of requests) prListEl.appendChild(renderPurchaseRequestRow(pr, role, () => void renderPRs()));
    } catch {
      prListEl.appendChild(emptyState({ icon: 'send', title: 'خطا در بارگذاری درخواست‌ها' }));
    }
  }

  root.append(
    el('div', { class: 'view-header' }, [
      el('h1', { class: 'view-header__title' }, ['لیست خرید']),
      el('div', { class: 'view-header__actions' }, [
        el('button', { class: 'btn btn-secondary', type: 'button', onclick: handleShare }, ['اشتراک‌گذاری']),
        iconTextBtn('refresh-cw', 'بروزرسانی', 'btn btn-primary', handleRegenerate),
      ]),
    ]),
  );

  if (role !== 'buyer' && role !== 'accountant') {
    root.appendChild(
      iconTextBtn('send', 'ارسال درخواست خرید به مسئول خرید', 'btn btn-primary purchase-request-btn', () => void handlePurchaseRequest(() => void renderPRs())),
    );
  }

  root.append(
    budgetEl,
    listEl,
    footerEl,
    el('div', { class: 'chart-card' }, [
      el('h3', { class: 'chart-card__title' }, ['درخواست‌های خرید']),
      prListEl,
    ]),
  );

  function render(): void {
    listEl.innerHTML = '';
    const items = [...shoppingList.get()].sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      return a.ingredientName.localeCompare(b.ingredientName, 'fa');
    });

    renderBudgetSection(budgetEl, items);

    if (!items.length) {
      listEl.appendChild(emptyState({ icon: 'cart', title: 'لیست خرید خالی است', message: 'موجودی همهٔ مواد اولیه بالاتر از حد آستانه است.' }));
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

  void renderPRs();
  const unsub = shoppingList.subscribe(render);
  return () => unsub();
}

function buildBuyerReportText(user: AppUser, items: ShoppingListItem[], total: number): string {
  const lines = [
    `📋 گزارش خرید — ${formatDate(new Date().toISOString())}`,
    `مسئول خرید: ${user.name}`,
    '',
    'اقلام مورد نیاز:',
    ...items.map((item) => `• ${item.ingredientName}: ${toPersian(item.suggestedQty)} ${formatUnit(item.unit)} — ${formatMoney(item.estimatedCost)}`),
    '',
    `مجموع تخمینی: ${formatMoney(total)}`,
    '',
    'ارسال‌شده از منوبان',
  ];
  return lines.join('\n');
}

/** Shows the unmissable buyer low-stock alert if any item needs purchasing; returns whether it was shown. */
export function maybeShowBuyerLowStockAlert(user: AppUser): boolean {
  const items = [...shoppingList.get()].sort((a, b) => a.ingredientName.localeCompare(b.ingredientName, 'fa'));
  if (!items.length) return false;

  const total = items.reduce((sum, i) => sum + i.estimatedCost, 0);

  const listEl = el(
    'ul',
    { class: 'low-stock-alert-list' },
    items.map((item) =>
      el('li', { class: 'low-stock-alert-list__item' }, [
        `${item.ingredientName} — موجودی: ${toPersian(item.currentStock)} ${formatUnit(item.unit)} — پیشنهاد خرید: ${toPersian(item.suggestedQty)} ${formatUnit(item.unit)} — ~${formatMoney(item.estimatedCost)}`,
      ]),
    ),
  );

  async function handleSendReport(): Promise<void> {
    try {
      await navigator.clipboard.writeText(buildBuyerReportText(user, items, total));
      showToast('متن گزارش در کلیپ‌بورد کپی شد ✓', 'success');
    } catch {
      showToast('خطا در کپی گزارش', 'error');
    }
  }

  function handleConfirm(): void {
    modal.close();
    location.hash = '#/shopping';
  }

  const body = el('div', { class: 'form low-stock-alert' }, [
    listEl,
    el('div', { class: 'low-stock-alert__footer' }, [`مجموع تخمینی هزینه خرید: ${formatMoney(total)}`]),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: handleSendReport }, ['ارسال گزارش به مدیر']),
      el('button', { type: 'button', class: 'btn btn-primary', onclick: handleConfirm }, ['تأیید — فردا می‌روم برای خرید']),
    ]),
  ]);

  const modal = openModal({ title: 'لیست خرید آماده است', body, maxWidth: '480px', dismissible: false });
  return true;
}
