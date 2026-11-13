import { h } from './kit.js';

export class LiveAnnouncer {
  private el: HTMLElement;

  constructor(container: HTMLElement = document.body) {
    this.el = h('div', {
      className: 'wc-sr-only',
      attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' },
    });
    container.appendChild(this.el);
  }

  announce(message: string): void {
    this.el.textContent = '';
    requestAnimationFrame(() => {
      this.el.textContent = message;
    });
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function focusElement(el: HTMLElement | null): void {
  if (!el) return;
  requestAnimationFrame(() => {
    el.focus();
  });
}
