export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  tone?: 'success' | 'primary' | 'muted';
}

export interface TriggerRect {
  top: number;
  bottom: number;
  left?: number;
  right?: number;
  width?: number;
  height?: number;
}

export interface PlacementArgs {
  triggerRect: TriggerRect;
  viewportHeight: number;
  listHeight: number;
  gap?: number;
  margin?: number;
  maxHeight?: number;
}

export interface PlacementResult {
  side: 'bottom' | 'top';
  maxHeight: number;
}

/**
 * Returns the index of the first enabled option, or -1 if none exist.
 */
export function firstEnabledIndex(options: SelectOption[]): number {
  for (let i = 0; i < options.length; i++) {
    if (!options[i].disabled) return i;
  }
  return -1;
}

/**
 * Returns the index of the first enabled option (alias for home key).
 */
export function homeIndex(options: SelectOption[]): number {
  return firstEnabledIndex(options);
}

/**
 * Returns the index of the last enabled option, or -1 if none exist.
 */
export function endIndex(options: SelectOption[]): number {
  for (let i = options.length - 1; i >= 0; i--) {
    if (!options[i].disabled) return i;
  }
  return -1;
}

/**
 * Moves the active index by delta, skipping disabled options and clamping at boundaries (no wrap).
 */
export function moveIndex(options: SelectOption[], from: number, delta: number): number {
  if (options.length === 0) return -1;
  const step = delta > 0 ? 1 : delta < 0 ? -1 : 0;
  if (step === 0) {
    return from >= 0 && from < options.length && !options[from].disabled
      ? from
      : firstEnabledIndex(options);
  }

  let stepsRemaining = Math.abs(delta);
  let curr = from;
  let lastValid = from >= 0 && from < options.length && !options[from].disabled ? from : -1;

  if (curr < 0 && step > 0) {
    const first = firstEnabledIndex(options);
    if (first === -1) return -1;
    curr = first;
    lastValid = first;
    stepsRemaining--;
  } else if (curr >= options.length && step < 0) {
    const last = endIndex(options);
    if (last === -1) return -1;
    curr = last;
    lastValid = last;
    stepsRemaining--;
  }

  while (stepsRemaining > 0) {
    curr += step;
    if (curr < 0 || curr >= options.length) {
      break; // Clamped at boundary (no wrap)
    }
    if (!options[curr].disabled) {
      lastValid = curr;
      stepsRemaining--;
    }
  }

  if (lastValid !== -1) return lastValid;
  return from >= 0 && from < options.length && !options[from].disabled
    ? from
    : firstEnabledIndex(options);
}

/**
 * Moves index by 10 in direction (skips disabled, clamps at edges).
 */
export function pageIndex(
  options: SelectOption[],
  from: number,
  direction: 'up' | 'down' | 1 | -1
): number {
  const delta = direction === 'down' || direction === 1 ? 10 : -10;
  return moveIndex(options, from, delta);
}

/**
 * Case-insensitive typeahead prefix match on option labels.
 * - Starting after current index and wrapping.
 * - Single letter or repeated same letter cycles through matching options.
 * - Multi-letter prefix matches sequentially.
 * - Disabled options are skipped.
 * - Returns -1 if no match found.
 */
export function typeahead(options: SelectOption[], from: number, buffer: string): number {
  const trimmed = buffer.toLowerCase();
  if (!trimmed || options.length === 0) return -1;

  const isRepeatedLetter = trimmed.split('').every((c) => c === trimmed[0]);
  const searchStr = isRepeatedLetter ? trimmed[0] : trimmed;

  const len = options.length;
  // If single character or repeated same character: cycle starting AFTER from
  // If distinct multi-letter prefix: check starting at from or from+1 if current doesn't match
  const startIndex = isRepeatedLetter
    ? (from + 1) % len
    : from >= 0 && from < len && options[from].label.toLowerCase().startsWith(searchStr)
    ? from
    : (from + 1) % len;

  for (let i = 0; i < len; i++) {
    const idx = (startIndex + i) % len;
    const opt = options[idx];
    if (opt && !opt.disabled && opt.label.toLowerCase().startsWith(searchStr)) {
      return idx;
    }
  }

  return -1;
}

/**
 * Calculates popover placement (bottom vs top) and available maxHeight.
 * - Bottom by default.
 * - Top only when room below < min(listHeight, maxHeight) AND room above > room below.
 * - maxHeight is limited by room on chosen side minus margin.
 */
export function placement({
  triggerRect,
  viewportHeight,
  listHeight,
  gap = 6,
  margin = 12,
  maxHeight = 280,
}: PlacementArgs): PlacementResult {
  const roomBelow = viewportHeight - triggerRect.bottom - gap;
  const roomAbove = triggerRect.top - gap;
  const needed = Math.min(listHeight, maxHeight);

  const flipToTop = roomBelow < needed && roomAbove > roomBelow;
  const side: 'bottom' | 'top' = flipToTop ? 'top' : 'bottom';

  const chosenRoom = side === 'bottom' ? roomBelow : roomAbove;
  const availableHeight = Math.max(0, chosenRoom - margin);
  const calculatedMaxHeight = Math.min(maxHeight, availableHeight);

  return {
    side,
    maxHeight: calculatedMaxHeight,
  };
}
