export interface ModalHandle {
  close: () => void;
  el: HTMLElement;
}

export interface ModalOptions {
  title: string;
  body: HTMLElement;
  maxWidth?: string;
  onClose?: () => void;
}

let openCount = 0;

export function openModal(opts: ModalOptions): ModalHandle {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog';
  if (opts.maxWidth) dialog.style.maxWidth = opts.maxWidth;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'modal-header';
  const titleEl = document.createElement('h3');
  titleEl.className = 'modal-title';
  titleEl.textContent = opts.title;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('aria-label', 'بستن');
  closeBtn.textContent = '✕';
  header.append(titleEl, closeBtn);

  const body = document.createElement('div');
  body.className = 'modal-body';
  body.appendChild(opts.body);

  dialog.append(header, body);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  openCount += 1;
  document.body.classList.add('modal-open');

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }

  function close(): void {
    overlay.classList.remove('modal-overlay--visible');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      overlay.remove();
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.body.classList.remove('modal-open');
    }, 150);
    opts.onClose?.();
  }

  document.addEventListener('keydown', onKey);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });

  requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));
  return { close, el: dialog };
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  details?: string[];
}

export function confirmModal(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const body = document.createElement('div');

    const msg = document.createElement('p');
    msg.className = 'modal-message';
    msg.textContent = opts.message;
    body.appendChild(msg);

    if (opts.details?.length) {
      const list = document.createElement('ul');
      list.className = 'modal-details-list';
      for (const d of opts.details) {
        const li = document.createElement('li');
        li.textContent = d;
        list.appendChild(li);
      }
      body.appendChild(list);
    }

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = opts.cancelLabel ?? 'انصراف';
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = opts.danger ? 'btn btn-danger' : 'btn btn-primary';
    confirmBtn.textContent = opts.confirmLabel ?? 'تایید';
    actions.append(cancelBtn, confirmBtn);
    body.appendChild(actions);

    const modal = openModal({ title: opts.title, body, maxWidth: '400px' });
    cancelBtn.addEventListener('click', () => {
      modal.close();
      resolve(false);
    });
    confirmBtn.addEventListener('click', () => {
      modal.close();
      resolve(true);
    });
  });
}
