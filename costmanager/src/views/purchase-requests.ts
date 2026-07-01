import { confirmModal, openModal } from '../components/modal';
import { showToast } from '../components/toast';
import { createImageUpload } from '../components/image-upload';
import { el, emptyState, field, iconBtn, numberInput, parseNumberInput } from '../utils/dom';
import { formatDate, formatMoney, toPersian } from '../utils/format';
import { api } from '../utils/api';
import { currentUser } from '../auth';
import type { RouteCleanup } from '../router';
import type { PurchaseRequest, PurchaseRequestStatus } from '../types';

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

// ── shared payment form ────────────────────────────────────────────────────────

function buildPaymentForm(prefillSupplierId?: string): {
  formEl: HTMLElement;
  getValues: () => {
    actualPrice?: number;
    actualQty?: number;
    paymentMethod: 'cash' | 'credit' | 'split';
    cashAmount?: number;
    creditAmount?: number;
    supplierId?: string;
    invoiceRef?: string;
    invoiceImageUrl?: string;
    note?: string;
  };
} {
  const priceInput = numberInput(0);
  const qtyInput = numberInput(0);

  const rName = `pm-${Date.now()}`;
  const cashR   = el('input', { type: 'radio', name: rName, value: 'cash'   }) as HTMLInputElement;
  cashR.checked = true;
  const creditR = el('input', { type: 'radio', name: rName, value: 'credit' }) as HTMLInputElement;
  const splitR  = el('input', { type: 'radio', name: rName, value: 'split'  }) as HTMLInputElement;

  const cashRow   = field('مبلغ نقدی (تومان)',  numberInput(0));
  const creditRow = field('مبلغ نسیه (تومان)', numberInput(0));
  const cashAmtEl   = cashRow.querySelector('input')   as HTMLInputElement;
  const creditAmtEl = creditRow.querySelector('input') as HTMLInputElement;
  creditRow.style.display = 'none';

  const updateRows = (): void => {
    const pm = creditR.checked ? 'credit' : splitR.checked ? 'split' : 'cash';
    cashRow.style.display   = pm === 'credit' ? 'none' : '';
    creditRow.style.display = pm === 'cash'   ? 'none' : '';
  };
  cashR.addEventListener('change', updateRows);
  creditR.addEventListener('change', updateRows);
  splitR.addEventListener('change', updateRows);

  const supplierSel = el('select', { class: 'input' }) as HTMLSelectElement;
  supplierSel.appendChild(el('option', { value: '' }, ['— تامین‌کننده (اختیاری) —']));
  void api.listSuppliers().then((list) => {
    for (const s of list) {
      const opt = el('option', { value: s.id }, [s.name]) as HTMLOptionElement;
      supplierSel.appendChild(opt);
    }
    if (prefillSupplierId) supplierSel.value = prefillSupplierId;
  });

  const invRefInput = el('input', { type: 'text', class: 'input', placeholder: 'اختیاری' }) as HTMLInputElement;
  let invoiceImageUrl = '';
  const imgUpload = createImageUpload({
    label: 'تصویر فاکتور (اختیاری)',
    onUploaded: (url) => { invoiceImageUrl = url; },
  });
  const noteInput = el('input', { type: 'text', class: 'input', placeholder: 'اختیاری' }) as HTMLInputElement;

  const formEl = el('div', {}, [
    field('قیمت واقعی هر واحد (تومان)', priceInput),
    field('مقدار خریداری‌شده', qtyInput),
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label' }, ['روش پرداخت']),
      el('div', { class: 'radio-group' }, [
        el('label', { class: 'radio-label' }, [cashR,   ' نقد']),
        el('label', { class: 'radio-label' }, [creditR, ' نسیه']),
        el('label', { class: 'radio-label' }, [splitR,  ' ترکیبی']),
      ]),
    ]),
    cashRow,
    creditRow,
    field('تامین‌کننده', supplierSel),
    field('شماره فاکتور', invRefInput),
    el('div', { class: 'field' }, [el('label', { class: 'field__label' }, ['تصویر فاکتور']), imgUpload]),
    field('یادداشت', noteInput),
  ]);

  return {
    formEl,
    getValues: () => {
      const pm: 'cash' | 'credit' | 'split' = creditR.checked ? 'credit' : splitR.checked ? 'split' : 'cash';
      return {
        actualPrice:    parseNumberInput(priceInput)  || undefined,
        actualQty:      parseNumberInput(qtyInput)    || undefined,
        paymentMethod:  pm,
        cashAmount:   pm !== 'credit' ? (parseNumberInput(cashAmtEl)   || undefined) : undefined,
        creditAmount: pm !== 'cash'   ? (parseNumberInput(creditAmtEl) || undefined) : undefined,
        supplierId:   supplierSel.value.trim() || undefined,
        invoiceRef:   invRefInput.value.trim() || undefined,
        invoiceImageUrl: invoiceImageUrl || undefined,
        note:         noteInput.value.trim()   || undefined,
      };
    },
  };
}

// ── modals ─────────────────────────────────────────────────────────────────────

function prItemLabel(pr: PurchaseRequest): string {
  const items = Array.isArray(pr.items) ? pr.items : [];
  if (items.length > 0) return `${items[0].ingredientName} — ${toPersian(items[0].suggestedQty ?? 0)} واحد`;
  if (pr.requestedQty != null) return `${toPersian(pr.requestedQty)} واحد`;
  return '—';
}

function prInfoBadge(pr: PurchaseRequest): HTMLElement {
  return el('div', { class: 'pr-modal-info' }, [
    el('span', { class: 'pr-modal-info__label' }, ['قلم درخواست:']),
    el('span', { class: 'pr-modal-info__value' }, [prItemLabel(pr)]),
  ]);
}

function openAcceptModal(pr: PurchaseRequest, onDone: () => void): void {
  const estInput = el('input', { type: 'datetime-local', class: 'input' }) as HTMLInputElement;
  const body = el('form', { class: 'form' }, [
    prInfoBadge(pr),
    field('زمان تخمینی خرید (اختیاری)', estInput),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit',  class: 'btn btn-primary'  }, ['پذیرفتن درخواست']),
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

function openCompleteModal(pr: PurchaseRequest, onDone: () => void): void {
  const { formEl, getValues } = buildPaymentForm(pr.supplierId ?? undefined);
  const body = el('form', { class: 'form' }, [
    prInfoBadge(pr),
    formEl,
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit',  class: 'btn btn-primary'  }, ['ثبت تکمیل خرید']),
    ]),
  ]);
  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.completePurchaseRequest(pr.id, getValues());
      showToast('خرید ثبت شد ✓', 'success');
      modal.close();
      onDone();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'خطا', 'error');
    }
  });
  const modal = openModal({ title: 'تکمیل درخواست خرید', body, maxWidth: '520px' });
}

function openBatchCompleteModal(ids: string[], onDone: () => void): void {
  const { formEl, getValues } = buildPaymentForm();
  const body = el('form', { class: 'form' }, [
    el('p', { class: 'field__hint' }, [`تکمیل ${toPersian(ids.length)} درخواست خرید`]),
    formEl,
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit',  class: 'btn btn-primary'  }, ['ثبت برای همه']),
    ]),
  ]);
  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = getValues();
    try {
      const result = await api.batchCompletePurchaseRequests(ids.map((id) => ({ id, ...v })));
      showToast(`${toPersian(result.completed.length)} درخواست تکمیل شد ✓`, 'success');
      modal.close();
      onDone();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'خطا', 'error');
    }
  });
  const modal = openModal({ title: 'تکمیل دسته‌ای درخواست‌های خرید', body, maxWidth: '520px' });
}

// ── main view ──────────────────────────────────────────────────────────────────

export async function renderPurchaseRequests(container: HTMLElement): Promise<RouteCleanup> {
  const root = el('div', { class: 'view view-purchase-requests' });
  container.appendChild(root);

  const user = currentUser.get();
  const role = user?.role ?? '';
  const canManage = role === 'buyer' || role === 'superadmin' || role === 'manager';

  const selectedIds = new Set<string>();

  const batchBtn = el('button', { type: 'button', class: 'btn btn-primary', style: 'display:none' }, [
    'تأیید انجام خرید برای موارد انتخاب‌شده',
  ]);
  batchBtn.addEventListener('click', () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    openBatchCompleteModal(ids, () => { selectedIds.clear(); void load(); });
  });

  const printBtn = el('button', { type: 'button', class: 'btn btn-secondary no-print', onclick: () => window.print() }, ['چاپ']);

  const listEl = el('div', { class: 'expense-list' });

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
      const canAccept  = canManage && pr.status === 'pending';
      const canComplete = canManage && (pr.status === 'pending' || pr.status === 'accepted');
      const canCancel  = (role === 'superadmin' || role === 'manager') && pr.status !== 'completed' && pr.status !== 'cancelled';
      const canSelect  = canManage && (pr.status === 'pending' || pr.status === 'accepted');

      const wrap = el('div', { class: 'pr-row-wrap' });

      if (canSelect) {
        const cb = el('input', { type: 'checkbox', class: 'pr-checkbox' }) as HTMLInputElement;
        cb.addEventListener('change', () => {
          if (cb.checked) selectedIds.add(pr.id); else selectedIds.delete(pr.id);
          batchBtn.style.display = selectedIds.size > 0 ? '' : 'none';
        });
        wrap.appendChild(cb);
      }

      const items = Array.isArray(pr.items) ? pr.items : [];
      const ingredientLabel = items.length > 0
        ? `${items[0].ingredientName} — ${toPersian(items[0].suggestedQty ?? 0)} واحد`
        : pr.requestedQty != null ? `${toPersian(pr.requestedQty)} واحد` : '—';

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
              pr.estimatedTotal ? ` · تخمین: ${formatMoney(pr.estimatedTotal)}` : '',
            ]),
            pr.actualTotal
              ? el('div', { class: 'expense-row__meta' }, [
                  `پرداخت: ${formatMoney(pr.actualTotal)}`,
                  pr.paymentMethod === 'cash'   ? ' (نقد)'   :
                  pr.paymentMethod === 'credit' ? ' (نسیه)'  :
                  pr.paymentMethod === 'split'  ? ' (ترکیبی)' : '',
                  pr.invoiceRef ? ` · فاکتور: ${pr.invoiceRef}` : '',
                  pr.completionNote ? ` · ${pr.completionNote}` : '',
                ])
              : null,
          ]),
          el('div', { class: 'expense-row__actions' }, [
            canAccept  ? iconBtn('check',     'پذیرفتن',    () => openAcceptModal(pr,   () => void load())) : null,
            canComplete ? iconBtn('clipboard', 'ثبت تکمیل', () => openCompleteModal(pr, () => void load())) : null,
            canCancel  ? iconBtn('x',          'لغو',       async () => {
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
