import {
  btn,
  clearEl,
  h,
  type Item,
  type ProgressHandlers,
  type ProgressView,
  type Theme,
} from '@word-castle/core';
import type { WordMeta } from '../pack/fry/first100.js';
import { createStoneUseSvg, getStoneStageLabel, renderStoneSvgDefs, type StoneStage } from './stones.js';
import { CASTLE_WINGS, getWingInfo } from './wings.js';

export interface CastleViewState {
  level: 'overview' | 'wing' | 'room';
  wingId?: string;
  roomId?: string;
}

function getSkyClass(): string {
  const hr = new Date().getHours();
  if (hr >= 6 && hr < 11) return 'wc-sky-morning';
  if (hr >= 11 && hr < 17) return 'wc-sky-day';
  if (hr >= 17 && hr < 21) return 'wc-sky-evening';
  return 'wc-sky-night';
}

export function computeBadges(view: ProgressView): Array<{ label: string; earned: boolean }> {
  const placedStones = view.totalItems - view.unseenCount;
  const completedRooms = view.groups.filter((g) => g.completed).length;
  const completedWings = view.superGroups.filter((sg) => sg.completed).length;

  return [
    { label: 'First Stone', earned: placedStones >= 1 },
    { label: '3 Days Building', earned: view.streakDays >= 3 },
    { label: 'First Room', earned: completedRooms >= 1 },
    { label: '50 Stones', earned: placedStones >= 50 },
    { label: 'First Wing', earned: completedWings >= 1 },
    { label: '250 Stones', earned: placedStones >= 250 },
    { label: '500 Stones', earned: placedStones >= 500 },
    { label: 'All 1,000', earned: view.masteredCount >= 1000 },
  ];
}

export function createCastleTheme(
  navState: CastleViewState = { level: 'overview' },
): Theme {
  const ensureDefs = (root: HTMLElement) => {
    if (!document.getElementById('stone-0')) {
      root.appendChild(renderStoneSvgDefs());
    }
  };

  return {
    id: 'castle',

    renderHomePreview(root: HTMLElement, view: ProgressView) {
      clearEl(root);
      ensureDefs(root);

      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 400 120');
      svg.setAttribute('class', `wc-castle-preview ${getSkyClass()}`);
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Your Word Castle preview');

      // Render 10 stylized wing towers
      CASTLE_WINGS.forEach((wing, i) => {
        const sg = view.superGroups.find((s) => s.superGroupId === wing.superGroupId);
        const total = sg?.total ?? 100;
        const built = total - (sg?.byBox.unseen ?? total);
        const ratio = total > 0 ? built / total : 0;

        const x = 10 + i * 38;
        const maxH = 72 + (i === 8 || i === 9 ? 16 : 0);
        const yBase = 108;

        // Outline
        const outline = document.createElementNS(ns, 'rect');
        outline.setAttribute('x', String(x));
        outline.setAttribute('y', String(yBase - maxH));
        outline.setAttribute('width', '32');
        outline.setAttribute('height', String(maxH));
        outline.setAttribute('rx', '2');
        outline.setAttribute('fill', 'none');
        outline.setAttribute('stroke', 'var(--wc-stone-1)');
        outline.setAttribute('stroke-dasharray', '3 3');
        svg.appendChild(outline);

        // Filled built portion
        if (ratio > 0) {
          const fillH = Math.max(6, Math.round(maxH * ratio));
          const fill = document.createElementNS(ns, 'rect');
          fill.setAttribute('x', String(x));
          fill.setAttribute('y', String(yBase - fillH));
          fill.setAttribute('width', '32');
          fill.setAttribute('height', String(fillH));
          fill.setAttribute('rx', '2');
          fill.setAttribute('fill', sg?.completed ? 'var(--wc-stone-3)' : 'var(--wc-stone-2)');
          svg.appendChild(fill);
        }

        // Pennant if completed
        if (sg?.completed) {
          const flag = document.createElementNS(ns, 'polygon');
          flag.setAttribute('points', `${x + 16},${yBase - maxH - 12} ${x + 28},${yBase - maxH - 7} ${x + 16},${yBase - maxH - 2}`);
          flag.setAttribute('fill', 'var(--wc-gold)');
          svg.appendChild(flag);
        }
      });

      const placed = view.totalItems - view.unseenCount;
      root.appendChild(
        h(
          'div',
          { className: 'wc-castle-preview-wrap' },
          svg,
          h('p', { className: 'wc-muted', style: { textAlign: 'center', margin: '0.4rem 0 0' } }, `${placed} of ${view.totalItems} stones placed`),
        ),
      );
    },

    renderProgress(root: HTMLElement, view: ProgressView, handlers: ProgressHandlers) {
      clearEl(root);
      ensureDefs(root);

      const renderOverview = () => {
        navState.level = 'overview';
        clearEl(root);
        ensureDefs(root);

        const badges = computeBadges(view);
        const badgeRow = h(
          'div',
          { className: 'wc-badge-row' },
          ...badges.map((b) =>
            h(
              'span',
              { className: `wc-badge ${b.earned ? 'wc-badge-earned' : ''}` },
              b.earned ? `★ ${b.label}` : b.label,
            ),
          ),
        );

        const grid = h('div', { className: 'wc-wings-grid' });
        for (const wing of CASTLE_WINGS) {
          const sg = view.superGroups.find((s) => s.superGroupId === wing.superGroupId);
          const total = sg?.total ?? 100;
          const placed = total - (sg?.byBox.unseen ?? total);
          const crowned = sg?.byBox[5] ?? 0;

          const card = h(
            'button',
            {
              type: 'button',
              className: `wc-card wc-wing-card ${sg?.completed ? 'wc-wing-complete' : ''}`,
              onClick: () => {
                navState.wingId = wing.superGroupId;
                handlers.onSelectSuperGroup?.(wing.superGroupId);
                renderWing(wing.superGroupId);
              },
            },
            h('div', { className: 'wc-wing-title' }, `${wing.number}. ${wing.name}`),
            h('div', { className: 'wc-muted' }, `${placed}/${total} stones • ${crowned} crowned`),
            sg?.completed ? h('span', { className: 'wc-wing-flag' }, '⚑ Wing Complete') : null,
          );
          grid.appendChild(card);
        }

        root.appendChild(h('div', { className: `wc-castle-shell ${getSkyClass()}` }, badgeRow, grid));
      };

      const renderWing = (wingId: string) => {
        navState.level = 'wing';
        navState.wingId = wingId;
        clearEl(root);
        ensureDefs(root);

        const wing = getWingInfo(wingId);
        if (!wing) {
          renderOverview();
          return;
        }

        const header = h(
          'div',
          { className: 'wc-row-actions', style: { marginBottom: '1rem' } },
          btn('← All Wings', renderOverview, 'secondary'),
          h('h2', { style: { margin: '0' } }, `${wing.number}. ${wing.name}`),
        );

        const roomsGrid = h('div', { className: 'wc-rooms-grid' });
        for (const room of wing.rooms) {
          const gp = view.groups.find((g) => g.groupId === room.groupId);
          const total = gp?.total ?? 25;
          const placed = total - (gp?.byBox.unseen ?? total);
          const card = h(
            'button',
            {
              type: 'button',
              className: `wc-card wc-room-card ${gp?.completed ? 'wc-room-complete' : ''}`,
              onClick: () => {
                navState.roomId = room.groupId;
                handlers.onSelectGroup?.(room.groupId);
                renderRoom(wingId, room.groupId, room.name);
              },
            },
            h('h3', { style: { margin: '0 0 0.25rem' } }, room.name),
            h('p', { className: 'wc-muted', style: { margin: '0' } }, `${placed}/${total} stones`),
            gp?.completed ? h('span', { className: 'wc-wing-flag' }, '⚑ Roof Raised') : null,
          );
          roomsGrid.appendChild(card);
        }

        root.appendChild(h('div', { className: `wc-castle-shell ${getSkyClass()}` }, header, roomsGrid));
      };

      const renderRoom = (wingId: string, roomId: string, roomName: string) => {
        navState.level = 'room';
        navState.wingId = wingId;
        navState.roomId = roomId;
        clearEl(root);
        ensureDefs(root);

        const roomItems = view.items
          .filter((entry) => entry.item.groupId === roomId)
          .sort((a, b) => a.item.order - b.item.order);

        const header = h(
          'div',
          { className: 'wc-row-actions', style: { marginBottom: '1rem' } },
          btn('← Back to Wing', () => renderWing(wingId), 'secondary'),
          h('h2', { style: { margin: '0' } }, roomName),
        );

        const wall = h('div', { className: 'wc-stone-wall' });
        for (const entry of roomItems) {
          const word = (entry.item.meta as unknown as WordMeta).word;
          const stage: StoneStage = entry.state ? entry.state.box : 'unseen';
          const stageLabel = getStoneStageLabel(stage);
          const stoneBtn = h(
            'button',
            {
              type: 'button',
              className: 'wc-stone-btn',
              title: entry.isDue ? 'This stone is waiting for a visit.' : `${word} (${stageLabel})`,
              attrs: {
                'aria-label': `${word}, ${stageLabel}${entry.isDue ? ', waiting for a visit' : ''}`,
              },
              onClick: () => handlers.onSelectItem?.(entry.item),
            },
            createStoneUseSvg(stage, entry.isDue),
            h('span', { className: 'wc-stone-word' }, entry.state ? word : '· · ·'),
          );
          wall.appendChild(stoneBtn);
        }

        root.appendChild(h('div', { className: `wc-castle-shell ${getSkyClass()}` }, header, wall));
      };

      if (navState.level === 'room' && navState.wingId && navState.roomId) {
        const wing = getWingInfo(navState.wingId);
        const room = wing?.rooms.find((r) => r.groupId === navState.roomId);
        renderRoom(navState.wingId, navState.roomId, room?.name ?? navState.roomId);
      } else if (navState.level === 'wing' && navState.wingId) {
        renderWing(navState.wingId);
      } else {
        renderOverview();
      }
    },

    onItemAdvance(_item: Item, _from: number, to: number, root: HTMLElement) {
      root.classList.remove('wc-stone-settle', 'wc-stone-crown');
      void root.offsetWidth;
      root.classList.add(to === 5 ? 'wc-stone-crown' : 'wc-stone-settle');
    },
  };
}
