import { describe, it, expect } from 'vitest';
import { arrangePanels } from './layout';
import type { PanelSpec } from './panels.config';

describe('layout arrangePanels', () => {
  const sampleSpecs: PanelSpec[] = [
    { id: 1, title: 'Stat 1', kind: 'stat', span: 4, height: 120 },
    { id: 2, title: 'Stat 2', kind: 'stat', span: 4, height: 120 },
    { id: 3, title: 'Stat 3', kind: 'stat', span: 4, height: 120 },
    { id: 5, title: 'Timeline', kind: 'chart', span: 8, height: 280 },
    { id: 7, title: 'Breakdown', kind: 'chart', span: 4, height: 280 },
    { id: 8, title: 'Budget', kind: 'chart', span: 4, height: 280 },
    { id: 9, title: 'Users', kind: 'chart', span: 4, height: 280 },
    { id: 6, title: 'Skills', kind: 'chart', span: 4, height: 280 },
    { id: 99, title: 'Hidden Panel', kind: 'chart', span: 6, height: 280, hidden: true },
    { id: 10, title: 'Ledger', kind: 'table', span: 12, height: 360 },
  ];

  it('1. filters out stat panels when showStat is false', () => {
    const rows = arrangePanels(sampleSpecs, { showStat: false });
    const allPanels = rows.flat();

    expect(allPanels.some((p) => p.kind === 'stat')).toBe(false);
    expect(allPanels.map((p) => p.id)).toEqual([5, 7, 8, 9, 6, 10]);
  });

  it('2. includes stat panels when showStat is true and packs into 12 cols', () => {
    const rows = arrangePanels(sampleSpecs, { showStat: true });

    // First row should pack the 3 stats (4 + 4 + 4 = 12)
    expect(rows[0].map((p) => p.id)).toEqual([1, 2, 3]);
    const firstRowSpan = rows[0].reduce((acc, p) => acc + p.span, 0);
    expect(firstRowSpan).toBe(12);
  });

  it('3. packs chart panels into 12-column rows and wraps on overflow', () => {
    const rows = arrangePanels(sampleSpecs, { showStat: false });

    // Row 1: Timeline (8) + Breakdown (4) = 12
    expect(rows[0].map((p) => p.id)).toEqual([5, 7]);
    expect(rows[0].reduce((acc, p) => acc + p.span, 0)).toBe(12);

    // Row 2: Budget (4) + Users (4) + Skills (4) = 12
    expect(rows[1].map((p) => p.id)).toEqual([8, 9, 6]);
    expect(rows[1].reduce((acc, p) => acc + p.span, 0)).toBe(12);

    // Row 3: Ledger Table (12)
    expect(rows[2].map((p) => p.id)).toEqual([10]);
    expect(rows[2].reduce((acc, p) => acc + p.span, 0)).toBe(12);
  });

  it('4. filters out panels with hidden: true', () => {
    const rows = arrangePanels(sampleSpecs, { showStat: false });
    const allPanels = rows.flat();

    expect(allPanels.some((p) => p.id === 99)).toBe(false);
  });

  it('5. returns empty array when given empty specs', () => {
    expect(arrangePanels([], { showStat: false })).toEqual([]);
    expect(arrangePanels([], { showStat: true })).toEqual([]);
  });
});
