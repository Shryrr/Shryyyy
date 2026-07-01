import { confirmModal, openModal } from '../components/modal';
import { showToast } from '../components/toast';
import { el, emptyState, field, iconBtn, numberInput, parseNumberInput } from '../utils/dom';
import { formatDate, formatMoney, toPersian } from '../utils/format';
import { api } from '../utils/api';
import { currentUser } from '../auth';
import type { RouteCleanup } from '../router';
import type { Ingredient, PurchaseRequest, PurchaseRequestStatus } from '../types';

const STATUS_LABEL: Record<PurchaseRequestStatus, string> = {
  pending:   'در انتظار خریدار',
  accepted:  'پذیرفته‌شده',
  completed: 'تکمیل‌شده',
  cancelled: 'لغوشده',
};
const STATUS_CLASS: Record<PurchaseRequestStatus, string> = {
  pending:   'badge--warning',
  accepted:  'badge--primary',
  completed: 'badge--success',
  cancelled: 'badge--danger',
};

// ── 1. Creation modal ──────────────────────────────────────────────────────────

export function renderCreateRequestModal(ingredient: Ingredient, onDone?: () => void): void {
  const currentStock = Number(ingredient.currentStock ?? 0);
  const maxStock     = Number((ingredient as Record<string, unknown>).maxStock ?? ingredient.minStock ?? 0);
  const defaultQty   = Math.max(0, maxStock - currentStock);

  const stockDisplay = el('div', { class: 'field' }, [
    el('label', { class: 'field__label' }, ['موجودی فعلی']),
    el('div', { class: 'input input--readonly' }, [toPersian(currentStock) + ' ' + (ingredient.unit ?? '')]),
  ]);

  const qtyInput = numberInput(defaultQty);

  const dateInput = document.createElement('input');
  dateInput.type = 'datetime-local';
  dateInput.className = 'input';
  dateInput.required = true;

  const noteArea = document.createElement('textarea');
  noteArea.className = 'input';
  noteArea.rows = 2;
  noteArea.placeholder = 'اختیاری';

  const form = el('form', { class: 'form' }, [
    stockDisplay,
    field('مقدار درخواستی', qtyInput),
    field('نیاز تا', dateInput),
    field('توضیحات', noteArea),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, ['ثبت درخواست']),
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const qty = parseNumberInput(qtyInput);
    if (!qty || qty <= 0) { showToast('مقدار درخواستی را وارد کنید', 'error'); return; }
    if (!dateInput.value) { showToast('زمان نیاز را انتخاب کنید', 'error'); return; }
    try {
      await api.createPurchaseRequest({
        ingredientId: ingredient.id,
        requestedQty: qty,
        neededByDatetime: new Date(dateInput.value).toISOString(),
        note: noteArea.value.trim() || undefined,
      });
      showToast('درخواست خرید ثبت شد ✓', 'success');
      modal.close();
      onDone?.();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'خطا', 'error');
    }
  });

  const modal = openModal({ title: `درخواست خرید — ${ingredient.name}`, body: form });
}

// ── 2. Accept modal (buyer) ────────────────────────────────────────────────────

export function renderAcceptModal(request: PurchaseRequest, onDone?: () => void): void {
  const items = Array.isArray(request.items) ? request.items : [];
  const ingredientName = items[0]?.ingredientName ?? items[0]?.name ?? '—';
  const requestedQty = request.requestedQty ?? items[0]?.suggestedQty ?? items[0]?.requestedQty ?? 0;

  const estInput = document.createElement('input');
  estInput.type = 'datetime-local';
  estInput.className = 'input';

  const form = el('form', { class: 'form' }, [
    el('div', { class: 'pr-modal-info' }, [
      el('div', {}, [
        el('span', { class: 'pr-modal-info__label' }, ['ماده اولیه: ']),
        el('strong', {}, [ingredientName]),
      ]),
      el('div', {}, [
        el('span', { class: 'pr-modal-info__label' }, ['مقدار درخواستی: ']),
        el('strong', {}, [toPersian(requestedQty)]),
      ]),
      request.neededByDatetime
        ? el('div', {}, [
            el('span', { class: 'pr-modal-info__label' }, ['نیاز تا: ']),
            el('strong', {}, [formatDate(request.neededByDatetime)]),
          ])
        : null,
    ]),
    field('زمان تخمینی خرید', estInput),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, ['تأیید درخواست']),
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.acceptPurchaseRequest(
        request.id,
        estInput.value ? new Date(estInput.value).toISOString() : undefined,
      );
      showToast('درخواست تأیید شد ✓', 'success');
      modal.close();
      onDone?.();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'خطا', 'error');
    }
  });

  const modal = openModal({ title: 'تأیید درخواست خرید', body: form });
}

// ── 3. Completion modal (buyer) ────────────────────────────────────────────────

export function renderCompletionModal(request: PurchaseRequest, onDone?: () => void): void {
  const priceInput = numberInput(0);
  const qtyInput   = numberInput(request.requestedQty ?? 0);

  // payment method radios
  const rName   = `pm-${Date.now()}`;
  const cashR   = el('input', { type: 'radio', name: rName, value: 'cash'   }) as HTMLInputElement;
  cashR.checked = true;
  const creditR = el('input', { type: 'radio', name: rName, value: 'credit' }) as HTMLInputElement;
  const splitR  = el('input', { type: 'radio', name: rName, value: 'split'  }) as HTMLInputElement;

  const cashAmtInput   = numberInput(0);
  const creditAmtInput = numberInput(0);
  const cashAmtRow   = field('مبلغ نقدی (تومان)',   cashAmtInput);
  const creditAmtRow = field('مبلغ اعتباری (تومان)', creditAmtInput);
  cashAmtRow.style.display   = 'none';
  creditAmtRow.style.display = 'none';

  const updatePaymentRows = (): void => {
    const pm = creditR.checked ? 'credit' : splitR.checked ? 'split' : 'cash';
    cashAmtRow.style.display   = pm === 'ترکیبی' || pm === 'split' ? '' : 'none';
    creditAmtRow.style.display = pm === 'ترکیبی' || pm === 'split' || pm === 'credit' ? '' : 'none';
  };
  [cashR, creditR, splitR].forEach((r) => r.addEventListener('change', updatePaymentRows));

  // supplier select
  const supplierSel = el('select', { class: 'input' }) as HTMLSelectElement;
  supplierSel.appendChild(el('option', { value: '' }, ['— تأمین‌کننده (اختیاری) —']));
  void api.listSuppliers().then((list) => {
    for (const s of list) {
      supplierSel.appendChild(el('option', { value: s.id }, [s.name]));
    }
  });

  const invoiceInput = el('input', { type: 'text', class: 'input', placeholder: 'اختیاری' }) as HTMLInputElement;
  const noteInput    = el('input', { type: 'text', class: 'input', placeholder: 'اختیاری' }) as HTMLInputElement;

  const form = el('form', { class: 'form' }, [
    field('قیمت خرید جدید (تومان)', priceInput),
    field('مقدار خریداری‌شده', qtyInput),
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label' }, ['روش پرداخت']),
      el('div', { class: 'radio-group' }, [
        el('label', { class: 'radio-label' }, [cashR,   ' نقدی']),
        el('label', { class: 'radio-label' }, [creditR, ' اعتباری']),
        el('label', { class: 'radio-label' }, [splitR,  ' ترکیبی']),
      ]),
    ]),
    cashAmtRow,
    creditAmtRow,
    field('تأمین‌کننده', supplierSel),
    field('شماره فاکتور', invoiceInput),
    field('یادداشت', noteInput),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, ['ثبت خرید انجام‌شده']),
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pm: 'cash' | 'credit' | 'split' = creditR.checked ? 'credit' : splitR.checked ? 'split' : 'cash';
    try {
      await api.completePurchaseRequest(request.id, {
        actualPrice:   parseNumberInput(priceInput)    || undefined,
        actualQty:     parseNumberInput(qtyInput)      || undefined,
        paymentMethod: pm,
        cashAmount:    pm !== 'credit' ? (parseNumberInput(cashAmtInput)   || undefined) : undefined,
        creditAmount:  pm !== 'cash'   ? (parseNumberInput(creditAmtInput) || undefined) : undefined,
        supplierId:    supplierSel.value.trim() || undefined,
        invoiceRef:    invoiceInput.value.trim() || undefined,
        note:          noteInput.value.trim()   || undefined,
      });
      showToast('خرید انجام‌شده ثبت شد ✓', 'success');
      modal.close();
      onDone?.();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'خطا', 'error');
    }
  });

  const modal = openModal({ title: 'ثبت تکمیل خرید', body: form, maxWidth: '520px' });
}

// ── Route view ────────────────────────────────────────────────────────────────

export async function renderPurchaseRequests(container: HTMLElement): Promise<RouteCleanup> {
  const root = el('div', { class: 'view view-purchase-requests' });
  container.appendChild(root);

  const user    = currentUser.get();
  const role    = user?.role ?? '';
  const canAct  = role === 'buyer' || role === 'superadmin' || role === 'manager';
  const canCancel = role === 'superadmin' || role === 'manager';

  const selectedIds = new Set<string>();

  const batchBtn = el('button', { type: 'button', class: 'btn btn-primary', style: 'display:none' }, [
    'ثبت دسته‌ای خریدهای انجام‌شده',
  ]) as HTMLButtonElement;
  batchBtn.addEventListener('click', () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    // open a single completion modal for batch (reuse renderCompletionModal with a synthetic object)
    const synthetic = { id: ids[0], items: [], requestedQty: undefined } as unknown as PurchaseRequest;
    renderCompletionModal(synthetic, () => { selectedIds.clear(); void load(); });
  });

  const printBtn = el('button', { type: 'button', class: 'btn btn-secondary no-print', onclick: () => window.print() }, ['چاپ']);
  const listEl   = el('div', { class: 'expense-list' });

  root.append(
    el('div', { class: 'view-header' }, [
      el('h1', { class: 'view-header__title' }, ['درخواست‌های خرید']),
      el('div', { class: 'view-header__actions no-print' }, [batchBtn, printBtn]),
    ]),
    listEl,
  );

  async function load(): Promise<void> {
    listEl.innerHTML = '';
    selectedIds.clear();
    batchBtn.style.display = 'none';

    let requests: PurchaseRequest[];
    try {
      requests = await api.listPurchaseRequests();
    } catch {
      listEl.appendChild(emptyState({ icon: 'send', title: 'خطا در بارگذاری درخواست‌ها' }));
      return;
    }

    if (!requests.length) {
      listEl.appendChild(emptyState({
        icon: 'send',
        title: 'هنوز درخواست خریدی ثبت نشده است',
        message: 'از صفحه انبار مواد اولیه روی دکمه «درخواست خرید» کلیک کنید.',
      }));
      return;
    }

    for (const pr of requests) {
      const items          = Array.isArray(pr.items) ? pr.items : [];
      const ingredientLabel = items[0]?.ingredientName ?? items[0]?.name
        ?? (pr.requestedQty != null ? `${toPersian(pr.requestedQty)} واحد` : '—');
      const canAccept   = canAct  && pr.status === 'pending';
      const canComplete = canAct  && (pr.status === 'pending' || pr.status === 'accepted');
      const canSelect   = canAct  && (pr.status === 'pending' || pr.status === 'accepted');

      const wrap = el('div', { class: 'pr-row-wrap' });

      if (canSelect) {
        const cb = el('input', { type: 'checkbox', class: 'pr-checkbox' }) as HTMLInputElement;
        cb.addEventListener('change', () => {
          if (cb.checked) selectedIds.add(pr.id); else selectedIds.delete(pr.id);
          batchBtn.style.display = selectedIds.size > 0 ? '' : 'none';
        });
        wrap.appendChild(cb);
      }

      wrap.appendChild(
        el('div', { class: 'expense-row' }, [
          el('div', { class: 'expense-row__main' }, [
            el('div', { class: 'expense-row__title-row' }, [
              el('span', { class: 'expense-row__name' }, [ingredientLabel]),
              el('span', { class: `badge ${STATUS_CLASS[pr.status]}` }, [STATUS_LABEL[pr.status]]),
            ]),
            el('div', { class: 'expense-row__meta' }, [
              `درخواست‌دهنده: ${pr.createdByName} · ${formatDate(pr.createdAt)}`,
              pr.neededByDatetime ? ` · نیاز تا: ${formatDate(pr.neededByDatetime)}` : '',
            ]),
            pr.actualTotal
              ? el('div', { class: 'expense-row__meta' }, [
                  `پرداخت: ${formatMoney(pr.actualTotal)}`,
                  pr.paymentMethod === 'cash'   ? ' (نقدی)'    :
                  pr.paymentMethod === 'credit' ? ' (اعتباری)' :
                  pr.paymentMethod === 'split'  ? ' (ترکیبی)'  : '',
                  pr.invoiceRef ? ` · فاکتور: ${pr.invoiceRef}` : '',
                ])
              : null,
          ]),
          el('div', { class: 'expense-row__actions' }, [
            canAccept   ? iconBtn('check',     'تأیید',       () => renderAcceptModal(pr,     () => void load())) : null,
            canComplete ? iconBtn('clipboard', 'ثبت خرید',   () => renderCompletionModal(pr, () => void load())) : null,
            canCancel   ? iconBtn('x',         'لغو', async () => {
              const ok = await confirmModal({ title: 'لغو درخواست', message: 'این درخواست لغو شود؟', confirmLabel: 'لغو', danger: true });
              if (!ok) return;
              try { await api.cancelPurchaseRequest(pr.id); void load(); }
              catch { showToast('خطا در لغو درخواست', 'error'); }
            }) : null,
          ]),
        ]),
      );

      listEl.appendChild(wrap);
    }
  }

  void load();
}
