import { h } from './kit.js';

export function renderProgressBar(
  current: number,
  total: number,
  label?: string,
): HTMLElement {
  const safeTotal = Math.max(1, total);
  const pct = Math.min(100, Math.max(0, Math.round((current / safeTotal) * 100)));

  return h(
    'div',
    {
      className: 'wc-progress-wrap',
      role: 'progressbar',
      attrs: {
        'aria-valuemin': '0',
        'aria-valuemax': String(safeTotal),
        'aria-valuenow': String(current),
        'aria-label': label ?? `Progress: ${current} of ${total}`,
      },
    },
    h('div', {
      className: 'wc-progress-fill',
      style: { width: `${pct}%` },
    }),
    label ? h('span', { className: 'wc-progress-label' }, label) : null,
  );
}
