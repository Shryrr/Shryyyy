import { Chart, registerables, type ChartConfiguration } from 'chart.js';

Chart.register(...registerables);
Chart.defaults.font.family = "Vazirmatn, 'Vazirmatn Fallback', sans-serif";
Chart.defaults.locale = 'fa-IR';

/** Reads a CSS custom property's current value so charts follow the active light/dark theme. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export const palette = {
  primary: '#5C4FD4',
  primaryD: '#4A3FB8',
  coral: '#FF7A59',
  mint: '#13C7A6',
  amber: '#F5A623',
  red: '#E5484D',
  blue: '#3D9BFF',
};

export function applyChartTheme(): void {
  Chart.defaults.color = cssVar('--ink-2') || '#46436A';
  Chart.defaults.borderColor = cssVar('--line') || 'rgba(21,19,46,.09)';
}

const instances = new WeakMap<HTMLCanvasElement, Chart>();

export function renderChart(canvas: HTMLCanvasElement, config: ChartConfiguration): Chart {
  const existing = instances.get(canvas);
  if (existing) existing.destroy();
  const chart = new Chart(canvas, config);
  instances.set(canvas, chart);
  return chart;
}

export function destroyChart(canvas: HTMLCanvasElement): void {
  const existing = instances.get(canvas);
  if (existing) {
    existing.destroy();
    instances.delete(canvas);
  }
}
