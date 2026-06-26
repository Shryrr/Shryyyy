function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadJSON(filename: string, data: unknown): void {
  downloadBlob(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
}

function escapeCSVCell(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function toCSV(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCSVCell).join(','));
  return '﻿' + lines.join('\r\n');
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  downloadBlob(filename, toCSV(headers, rows), 'text/csv;charset=utf-8');
}

export function readFileAsJSON<T = unknown>(file: File): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)) as T);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function shareOrCopyText(text: string): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    return navigator.share({ text }).then(() => 'shared' as const);
  }
  return navigator.clipboard.writeText(text).then(() => 'copied' as const);
}
