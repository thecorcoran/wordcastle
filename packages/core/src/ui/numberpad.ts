import { h } from './kit.js';

const QWERTY_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

export function renderOnScreenKeyboard(handlers: {
  onChar: (ch: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  includeSpace?: boolean;
}): HTMLElement {
  const container = h('div', {
    className: 'wc-osk',
    role: 'group',
    attrs: { 'aria-label': 'On-screen keyboard' },
  });

  QWERTY_ROWS.forEach((row, idx) => {
    const rowEl = h('div', { className: 'wc-osk-row' });
    for (const ch of row) {
      rowEl.appendChild(
        h(
          'button',
          {
            type: 'button',
            className: 'wc-osk-key',
            attrs: { 'aria-label': ch },
            onClick: () => handlers.onChar(ch),
          },
          ch,
        ),
      );
    }
    if (idx === QWERTY_ROWS.length - 1) {
      rowEl.appendChild(
        h(
          'button',
          {
            type: 'button',
            className: 'wc-osk-key wc-osk-wide',
            attrs: { 'aria-label': 'Backspace' },
            onClick: handlers.onBackspace,
          },
          '⌫',
        ),
      );
    }
    container.appendChild(rowEl);
  });

  const bottomRow = h('div', { className: 'wc-osk-row' });
  if (handlers.includeSpace) {
    bottomRow.appendChild(
      h(
        'button',
        {
          type: 'button',
          className: 'wc-osk-key wc-osk-space',
          attrs: { 'aria-label': 'Space' },
          onClick: () => handlers.onChar(' '),
        },
        'space',
      ),
    );
  }
  bottomRow.appendChild(
    h(
      'button',
      {
        type: 'button',
        className: 'wc-osk-key wc-osk-enter',
        attrs: { 'aria-label': 'Check answer' },
        onClick: handlers.onEnter,
      },
      'Check ↵',
    ),
  );
  container.appendChild(bottomRow);
  return container;
}
