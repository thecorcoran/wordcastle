export type Child = HTMLElement | SVGElement | Text | string | number | null | undefined | false;

export interface ElementProps {
  className?: string;
  id?: string;
  textContent?: string;
  innerHTML?: string;
  type?: string;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  checked?: boolean;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  role?: string;
  tabIndex?: number;
  title?: string;
  autocomplete?: string;
  autocorrect?: string;
  autocapitalize?: string;
  spellcheck?: boolean;
  style?: Partial<CSSStyleDeclaration>;
  dataset?: Record<string, string>;
  attrs?: Record<string, string>;
  onClick?: (e: MouseEvent) => void;
  onInput?: (e: Event) => void;
  onChange?: (e: Event) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: ElementProps | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    if (props.className) el.className = props.className;
    if (props.id) el.id = props.id;
    if (props.textContent !== undefined) el.textContent = props.textContent;
    if (props.innerHTML !== undefined) el.innerHTML = props.innerHTML;
    if (props.type !== undefined && 'type' in el) (el as HTMLInputElement).type = props.type;
    if (props.value !== undefined && 'value' in el) (el as HTMLInputElement).value = props.value;
    if (props.placeholder !== undefined && 'placeholder' in el) {
      (el as HTMLInputElement).placeholder = props.placeholder;
    }
    if (props.disabled !== undefined && 'disabled' in el) {
      (el as HTMLButtonElement).disabled = props.disabled;
    }
    if (props.checked !== undefined && 'checked' in el) {
      (el as HTMLInputElement).checked = props.checked;
    }
    if (props.min !== undefined && 'min' in el) (el as HTMLInputElement).min = String(props.min);
    if (props.max !== undefined && 'max' in el) (el as HTMLInputElement).max = String(props.max);
    if (props.step !== undefined && 'step' in el) (el as HTMLInputElement).step = String(props.step);
    if (props.role) el.setAttribute('role', props.role);
    if (props.tabIndex !== undefined) el.tabIndex = props.tabIndex;
    if (props.title) el.title = props.title;
    if (props.autocomplete) el.setAttribute('autocomplete', props.autocomplete);
    if (props.autocorrect) el.setAttribute('autocorrect', props.autocorrect);
    if (props.autocapitalize) el.setAttribute('autocapitalize', props.autocapitalize);
    if (props.spellcheck !== undefined) el.spellcheck = props.spellcheck;
    if (props.style) Object.assign(el.style, props.style);
    if (props.dataset) {
      for (const [k, v] of Object.entries(props.dataset)) {
        el.dataset[k] = v;
      }
    }
    if (props.attrs) {
      for (const [k, v] of Object.entries(props.attrs)) {
        el.setAttribute(k, v);
      }
    }
    if (props.onClick) el.addEventListener('click', props.onClick as EventListener);
    if (props.onInput) el.addEventListener('input', props.onInput);
    if (props.onChange) el.addEventListener('change', props.onChange);
    if (props.onKeyDown) el.addEventListener('keydown', props.onKeyDown as EventListener);
  }

  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      el.appendChild(document.createTextNode(String(child)));
    } else {
      el.appendChild(child);
    }
  }
  return el;
}

export function clearEl(el: HTMLElement): void {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

export function btn(
  label: string,
  onClick: (e: MouseEvent) => void,
  variant: 'primary' | 'secondary' | 'ghost' | 'calm' = 'secondary',
  extra: ElementProps = {},
): HTMLButtonElement {
  return h(
    'button',
    {
      type: 'button',
      className: `wc-btn wc-btn-${variant} ${extra.className ?? ''}`.trim(),
      onClick,
      ...extra,
    },
    label,
  );
}
