import { btn, clearEl, h } from './kit.js';
import { focusElement } from './a11y.js';

export function renderParentGate(
  root: HTMLElement,
  pin: string | null,
  onSuccess: () => void,
  onCancel: () => void,
): void {
  clearEl(root);

  const a = 6 + Math.floor(Math.random() * 4);
  const b = 7 + Math.floor(Math.random() * 5);
  const expected = pin && pin.trim().length > 0 ? pin.trim() : String(a * b);
  const promptText =
    pin && pin.trim().length > 0
      ? 'Enter your Parent PIN to open the Parent Area:'
      : `Quick check for grown-ups: What is ${a} × ${b}?`;

  const errorEl = h('p', { className: 'wc-gate-error', attrs: { 'aria-live': 'polite' } });
  const input = h('input', {
    type: pin ? 'password' : 'number',
    className: 'wc-input',
    placeholder: pin ? 'PIN' : 'Answer',
    autocomplete: 'off',
    attrs: { 'aria-label': promptText },
  });

  const submit = () => {
    if (input.value.trim() === expected) {
      onSuccess();
    } else {
      errorEl.textContent = 'Not quite — try again.';
      input.value = '';
      focusElement(input);
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });

  const card = h(
    'div',
    { className: 'wc-card wc-gate-card' },
    h('h2', null, 'Parent Area'),
    h('p', { className: 'wc-muted' }, 'This is a simple kid-gate (not a security lock).'),
    h('p', null, promptText),
    input,
    errorEl,
    h(
      'div',
      { className: 'wc-row-actions' },
      btn('Cancel', onCancel, 'ghost'),
      btn('Open Parent Area', submit, 'primary'),
    ),
  );

  root.appendChild(card);
  focusElement(input);
}
