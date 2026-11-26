import { PanelSpec } from './panels.config';

export interface ArrangePanelsOptions {
  showStat: boolean;
}

/**
 * Arranges panel specifications into grid rows of at most 12 columns.
 * - Filters out hidden panels.
 * - Filters out stat panels if showStat is false.
 * - Packs panels into rows until adding the next panel would exceed 12 columns.
 */
export function arrangePanels(
  specs: PanelSpec[],
  { showStat }: ArrangePanelsOptions
): PanelSpec[][] {
  if (!specs || specs.length === 0) {
    return [];
  }

  const filtered = specs.filter((s) => {
    if (s.hidden) return false;
    if (!showStat && s.kind === 'stat') return false;
    return true;
  });

  const rows: PanelSpec[][] = [];
  let currentRow: PanelSpec[] = [];
  let currentSpan = 0;

  for (const panel of filtered) {
    const span = panel.span || 12;

    if (currentSpan + span > 12) {
      if (currentRow.length > 0) {
        rows.push(currentRow);
      }
      currentRow = [panel];
      currentSpan = span;
    } else {
      currentRow.push(panel);
      currentSpan += span;
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}
