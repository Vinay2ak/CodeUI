export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  tone?: "success" | "primary" | "muted";
}

export interface PlacementOptions {
  triggerRect: { top: number; bottom: number; height?: number; left?: number; width?: number };
  viewportHeight: number;
  listHeight: number;
  gap?: number;
  margin?: number;
  maxHeight?: number;
}

export interface PlacementResult {
  side: "bottom" | "top";
  maxHeight: number;
}

/**
 * Returns the index of the first enabled option, or -1 if none exists.
 */
export function firstEnabledIndex(options: readonly SelectOption[]): number {
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    if (opt && !opt.disabled) return i;
  }
  return -1;
}

/**
 * Returns the index of the last enabled option, or -1 if none exists.
 */
export function endIndex(options: readonly SelectOption[]): number {
  for (let i = options.length - 1; i >= 0; i--) {
    const opt = options[i];
    if (opt && !opt.disabled) return i;
  }
  return -1;
}

/**
 * Returns the index of the first enabled option (alias for firstEnabledIndex).
 */
export function homeIndex(options: readonly SelectOption[]): number {
  return firstEnabledIndex(options);
}

/**
 * Moves from a given index by delta (+1 or -1).
 * Skips disabled options, clamps at both ends, and does NOT wrap.
 */
export function moveIndex(
  options: readonly SelectOption[],
  from: number,
  delta: number
): number {
  if (!options.length) return -1;
  const step = delta > 0 ? 1 : delta < 0 ? -1 : 0;
  if (step === 0) {
    const currentOpt = options[from];
    return from >= 0 && from < options.length && currentOpt && !currentOpt.disabled
      ? from
      : firstEnabledIndex(options);
  }

  if (from < 0) {
    return step > 0 ? firstEnabledIndex(options) : endIndex(options);
  }

  let curr = from + step;
  while (curr >= 0 && curr < options.length) {
    const opt = options[curr];
    if (opt && !opt.disabled) {
      return curr;
    }
    curr += step;
  }

  // Clamped at edge: return original if valid and enabled, else nearest enabled
  const fromOpt = options[from];
  if (fromOpt && !fromOpt.disabled) return from;
  return step > 0 ? endIndex(options) : firstEnabledIndex(options);
}

/**
 * Jumps 10 steps in the given direction (1 = down, -1 = up).
 * Clamps at boundaries and skips disabled options.
 */
export function pageIndex(
  options: readonly SelectOption[],
  from: number,
  direction: 1 | -1
): number {
  if (!options.length) return -1;

  const base = from < 0 ? (direction > 0 ? 0 : options.length - 1) : from;
  const target = direction > 0 ? Math.min(options.length - 1, base + 10) : Math.max(0, base - 10);
  const targetOpt = options[target];

  if (targetOpt && !targetOpt.disabled) {
    return target;
  }

  // Search forward in movement direction first, then backward
  if (direction > 0) {
    for (let i = target + 1; i < options.length; i++) {
      const opt = options[i];
      if (opt && !opt.disabled) return i;
    }
    for (let i = target - 1; i >= 0; i--) {
      const opt = options[i];
      if (opt && !opt.disabled) return i;
    }
  } else {
    for (let i = target - 1; i >= 0; i--) {
      const opt = options[i];
      if (opt && !opt.disabled) return i;
    }
    for (let i = target + 1; i < options.length; i++) {
      const opt = options[i];
      if (opt && !opt.disabled) return i;
    }
  }

  return -1;
}

/**
 * Case-insensitive prefix match on the label starting after the current index and wrapping.
 * The same letter typed repeatedly cycles through options starting with it.
 * Disabled options are skipped; returns -1 when nothing matches.
 */
export function typeahead(
  options: readonly SelectOption[],
  from: number,
  buffer: string
): number {
  if (!options.length || !buffer) return -1;
  const clean = buffer.trim().toLowerCase();
  if (!clean) return -1;

  const len = options.length;
  const firstChar = clean[0] ?? "";
  const isRepeatedLetter =
    clean.length > 1 && clean.split("").every((c) => c === firstChar);

  // Repeated letter or single letter: cycle strictly after 'from'
  if (clean.length === 1 || isRepeatedLetter) {
    const char = firstChar;
    const start = from >= 0 ? (from + 1) % len : 0;
    for (let i = 0; i < len; i++) {
      const idx = (start + i) % len;
      const opt = options[idx];
      if (opt && !opt.disabled && opt.label.trim().toLowerCase().startsWith(char)) {
        return idx;
      }
    }
    return -1;
  }

  // Multi-letter string: search starting from current option (stay if already matching), then wrap
  const start = from >= 0 ? from : 0;
  for (let i = 0; i < len; i++) {
    const idx = (start + i) % len;
    const opt = options[idx];
    if (opt && !opt.disabled && opt.label.trim().toLowerCase().startsWith(clean)) {
      return idx;
    }
  }

  return -1;
}

/**
 * Calculates popover placement and max height.
 * - Bottom by default.
 * - Top only when the room below is smaller than min(listHeight, maxHeight) AND room above is larger.
 * - MaxHeight is limited by the room on the chosen side minus the margin.
 */
export function placement({
  triggerRect,
  viewportHeight,
  listHeight,
  gap = 6,
  margin = 12,
  maxHeight = 280,
}: PlacementOptions): PlacementResult {
  const roomBelow = viewportHeight - triggerRect.bottom - gap;
  const roomAbove = triggerRect.top - gap;
  const requiredHeight = Math.min(listHeight, maxHeight);

  const shouldFlip = roomBelow < requiredHeight && roomAbove > roomBelow;
  const side: "bottom" | "top" = shouldFlip ? "top" : "bottom";
  const room = side === "top" ? roomAbove : roomBelow;
  const limitedMaxHeight = Math.max(0, Math.min(maxHeight, room - margin));

  return {
    side,
    maxHeight: limitedMaxHeight,
  };
}
