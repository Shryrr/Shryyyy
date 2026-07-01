import { api } from '../utils/api';
import { el } from '../utils/dom';
import { showToast } from './toast';

export interface ImageUploadOptions {
  label?: string;
  initialUrl?: string;
  onUploaded: (url: string) => void;
}

export function createImageUpload({ label = 'بارگذاری تصویر / رسید', initialUrl, onUploaded }: ImageUploadOptions): HTMLElement {
  const fileInput = el('input', { type: 'file', accept: 'image/*,application/pdf', style: 'display:none' }) as HTMLInputElement;

  const preview = el('img', { class: 'img-upload__preview', style: 'display:none', alt: 'پیش‌نمایش' }) as HTMLImageElement;
  if (initialUrl) {
    preview.src = initialUrl;
    preview.style.display = 'block';
  }

  const hint = el('p', { class: 'img-upload__hint' }, [label]);
  const spinner = el('span', { class: 'img-upload__spinner', style: 'display:none' }, ['در حال بارگذاری…']);

  const zone = el('div', { class: 'img-upload', tabindex: '0', role: 'button', 'aria-label': label }, [
    preview,
    hint,
    spinner,
    fileInput,
  ]);

  async function upload(file: File): Promise<void> {
    hint.style.display = 'none';
    spinner.style.display = '';
    try {
      const { url } = await api.uploadFile(file);
      preview.src = url;
      preview.style.display = 'block';
      onUploaded(url);
    } catch {
      showToast('خطا در بارگذاری فایل', 'error');
    } finally {
      spinner.style.display = 'none';
      hint.style.display = '';
    }
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void upload(file);
    fileInput.value = '';
  });

  zone.addEventListener('click', () => fileInput.click());
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('img-upload--drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('img-upload--drag'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('img-upload--drag');
    const file = e.dataTransfer?.files[0];
    if (file) void upload(file);
  });

  return zone;
}
