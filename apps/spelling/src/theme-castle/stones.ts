import type { BoxLevel } from '@word-castle/core';

export type StoneStage = BoxLevel | 'unseen';

export function getStoneStageLabel(stage: StoneStage): string {
  switch (stage) {
    case 'unseen':
      return 'Plan';
    case 0:
      return 'Quarried';
    case 1:
      return 'Chiseled';
    case 2:
      return 'Laid';
    case 3:
      return 'Mortared';
    case 4:
      return 'Polished';
    case 5:
      return 'Crowned';
  }
}

export function renderStoneSvgDefs(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';

  svg.innerHTML = `
    <defs>
      <symbol id="stone-unseen" viewBox="0 0 80 48">
        <rect x="4" y="6" width="72" height="36" rx="4" fill="none" stroke="var(--wc-stone-0)" stroke-width="2" stroke-dasharray="5 4" opacity="0.65"/>
      </symbol>
      <symbol id="stone-0" viewBox="0 0 80 48">
        <polygon points="8,10 24,6 58,8 74,13 71,40 42,43 10,39" fill="var(--wc-stone-0)" stroke="var(--wc-stone-2)" stroke-width="2"/>
      </symbol>
      <symbol id="stone-1" viewBox="0 0 80 48">
        <rect x="4" y="6" width="72" height="36" rx="3" fill="var(--wc-stone-1)" stroke="var(--wc-stone-3)" stroke-width="2"/>
        <line x1="16" y1="16" x2="26" y2="22" stroke="var(--wc-stone-3)" stroke-width="1.5"/>
        <line x1="50" y1="28" x2="62" y2="33" stroke="var(--wc-stone-3)" stroke-width="1.5"/>
      </symbol>
      <symbol id="stone-2" viewBox="0 0 80 48">
        <rect x="4" y="6" width="72" height="36" rx="3" fill="var(--wc-stone-2)" stroke="var(--wc-stone-3)" stroke-width="2"/>
      </symbol>
      <symbol id="stone-3" viewBox="0 0 80 48">
        <rect x="2" y="4" width="76" height="40" rx="2" fill="var(--wc-mortar)"/>
        <rect x="5" y="7" width="70" height="34" rx="2" fill="var(--wc-stone-3)"/>
      </symbol>
      <symbol id="stone-4" viewBox="0 0 80 48">
        <rect x="2" y="4" width="76" height="40" rx="2" fill="var(--wc-mortar)"/>
        <rect x="5" y="7" width="70" height="34" rx="2" fill="var(--wc-stone-2)"/>
        <line x1="10" y1="12" x2="68" y2="12" stroke="var(--wc-highlight)" stroke-width="3" stroke-linecap="round"/>
      </symbol>
      <symbol id="stone-5" viewBox="0 0 80 48">
        <rect x="2" y="4" width="76" height="40" rx="2" fill="var(--wc-mortar)"/>
        <rect x="5" y="7" width="70" height="34" rx="2" fill="var(--wc-stone-2)"/>
        <line x1="10" y1="12" x2="68" y2="12" stroke="var(--wc-highlight)" stroke-width="3" stroke-linecap="round"/>
        <polygon points="56,4 70,4 70,20 63,15 56,20" fill="var(--wc-gold)"/>
      </symbol>
      <symbol id="stone-dusty" viewBox="0 0 80 48">
        <rect x="4" y="6" width="72" height="36" rx="3" fill="var(--wc-bg)" opacity="0.38"/>
        <path d="M8,38 Q14,28 22,36 Q18,24 28,28" fill="none" stroke="var(--wc-primary)" stroke-width="2" stroke-linecap="round"/>
      </symbol>
    </defs>
  `;
  return svg;
}

export function createStoneUseSvg(stage: StoneStage, isDue: boolean): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 80 48');
  svg.setAttribute('class', 'wc-stone-svg');
  svg.setAttribute('aria-hidden', 'true');

  const baseUse = document.createElementNS(ns, 'use');
  baseUse.setAttribute('href', `#stone-${stage}`);
  svg.appendChild(baseUse);

  if (isDue) {
    const dustUse = document.createElementNS(ns, 'use');
    dustUse.setAttribute('href', '#stone-dusty');
    svg.appendChild(dustUse);
  }

  return svg;
}
