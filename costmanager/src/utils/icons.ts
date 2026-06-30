/** Inline SVG icon set (Feather-style, stroke-based) used in place of emoji across nav/headers/buttons. */

const PATHS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>',
  box: '<path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v9l9 5 9-5V8"/><path d="M12 13v9"/>',
  utensils: '<path d="M7 3v7a2 2 0 0 0 2 2v9"/><path d="M7 3v18"/><path d="M17 3c1.5 2 1.5 6 0 8s0 6 0 10"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z"/><path d="M9 8h6"/><path d="M9 12h6"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16" cy="14" r="1"/>',
  'bar-chart': '<path d="M5 21V10"/><path d="M12 21V4"/><path d="M19 21v-7"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M21 20c0-2.5-1.8-4.5-4-5.2"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2l2.2 11.2A2 2 0 0 0 9.2 17h8.6a2 2 0 0 0 2-1.6L21 8H6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V20a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.6V4a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.6 1H20a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1Z"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 1 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2Z"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 4-1.5 6-2 7h16c-.5-1-2-3-2-7Z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M5 5l14 14M19 5 5 19"/>',
  'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'wifi-off': '<path d="M2 8.8a16 16 0 0 1 5.6-3.3M22 8.8a16 16 0 0 0-9-4M6.3 13.6a10.6 10.6 0 0 1 4-2.1M17.7 13.6a10.6 10.6 0 0 0-2.6-1.7M9.5 17a5 5 0 0 1 5 0M3 3l18 18"/><circle cx="12" cy="20" r="1"/>',
  'refresh-cw': '<path d="M21 12a9 9 0 0 1-15.5 6.4M3 12a9 9 0 0 1 15.5-6.4"/><path d="M21 5v5h-5M3 19v-5h5"/>',
  check: '<path d="M5 12l5 5 9-11"/>',
  'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><circle cx="12" cy="16" r=".5"/>',
  'alert-triangle': '<path d="M12 3 2 20h20Z"/><path d="M12 9v5"/><circle cx="12" cy="17" r=".5"/>',
  download: '<path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  upload: '<path d="M12 21V9"/><path d="M7 13l5-5 5 5"/><path d="M4 4h16"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5Z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 4.22-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.6 18.6 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/>',
  undo: '<path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6 12 13 2 6"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 21v-4h6v4"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/>',
  truck: '<rect x="2" y="7" width="13" height="10" rx="1"/><path d="M15 11h4l3 3v3h-7z"/><circle cx="6.5" cy="19" r="1.5"/><circle cx="17.5" cy="19" r="1.5"/>',
  'credit-card': '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  'file-text': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
  tag: '<path d="M20.59 13.41 12 22l-9-9 8.59-8.59A2 2 0 0 1 13 4h6a2 2 0 0 1 2 2v6a2 2 0 0 1-.59 1.41Z"/><circle cx="16.5" cy="7.5" r="1"/>',
  calculator: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M12 10h2M16 10h2M8 14h2M12 14h2M16 14h2M8 18h2M12 18h2M16 18h2"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M9 13.5 7 22l5-3 5 3-2-8.5"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
  'trending-up': '<path d="M23 6 13.5 15.5 8.5 10.5 1 18"/><path d="M17 6h6v6"/>',
  'trending-down': '<path d="M23 18 13.5 8.5 8.5 13.5 1 6"/><path d="M17 18h6v-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  sparkles: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
  'x-circle': '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',
  smartphone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  megaphone: '<path d="M3 11v2a2 2 0 0 0 2 2h1l3 5h2l-1.5-5H13l7 3V6l-7 3H6a2 2 0 0 0-2 2Z"/>',
  zap: '<path d="M13 2 3 14h7l-1 8 10-12h-7Z"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2Z"/>',
  clipboard: '<rect x="6" y="4" width="12" height="18" rx="2"/><path d="M9 2h6v4H9z"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/>',
  hash: '<path d="M5 9h14M5 15h14M10 3 8 21M16 3l-2 18"/>',
  cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10Z"/>',
  radio: '<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
};

export type IconName = keyof typeof PATHS;

/** Builds an inline SVG element for the given icon name; falls back to an empty SVG for unknown names. */
export function svgIcon(name: IconName, size = 20): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = PATHS[name] ?? '';
  return svg;
}
