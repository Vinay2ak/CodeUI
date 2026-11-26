import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import {
  SelectOption,
  firstEnabledIndex,
  moveIndex,
  homeIndex,
  endIndex,
  pageIndex,
  typeahead,
  placement,
  PlacementResult,
} from './logic';

export interface UseSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  options: SelectOption[];
  disabled?: boolean;
}

export interface PopoverCoords {
  side: 'bottom' | 'top';
  top?: number;
  bottom?: number;
  left: number;
  minWidth: number;
  maxHeight: number;
}

export interface HighlightStyle {
  top: number;
  height: number;
  opacity: number;
  snap: boolean;
}

const EXIT_DURATION_MS = 110;

export function useSelect({
  value,
  onChange,
  onBlur,
  options,
  disabled = false,
}: UseSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [snapHighlight, setSnapHighlight] = useState(true);
  const [popoverCoords, setPopoverCoords] = useState<PopoverCoords | null>(null);
  const [placementResult, setPlacementResult] = useState<PlacementResult>({
    side: 'bottom',
    maxHeight: 280,
  });

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const typeaheadBufferRef = useRef('');
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  // Compute popover coordinates based on trigger position
  const updatePlacement = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const listHeight = popoverRef.current?.offsetHeight || Math.min(options.length * 40 + 8, 280);

    const result = placement({
      triggerRect: rect,
      viewportHeight: window.innerHeight,
      listHeight,
      gap: 6,
      margin: 12,
      maxHeight: 280,
    });

    setPlacementResult(result);
    setPopoverCoords({
      side: result.side,
      top: result.side === 'bottom' ? rect.bottom + 6 : undefined,
      bottom: result.side === 'top' ? window.innerHeight - rect.top + 6 : undefined,
      left: Math.max(12, Math.min(rect.left, window.innerWidth - (rect.width || 200) - 12)),
      minWidth: rect.width,
      maxHeight: result.maxHeight,
    });
  }, [options.length]);

  const open = useCallback(() => {
    if (disabled || isOpen) return;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsClosing(false);
    setSnapHighlight(true);

    const initialActive = selectedIndex >= 0 && !options[selectedIndex]?.disabled
      ? selectedIndex
      : firstEnabledIndex(options);

    setActiveIndex(initialActive);
    setIsOpen(true);
  }, [disabled, isOpen, selectedIndex, options]);

  const close = useCallback(() => {
    if (!isOpen && !isClosing) return;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      closeTimerRef.current = null;
    }, EXIT_DURATION_MS);

    if (onBlur) {
      onBlur();
    }
  }, [isOpen, isClosing, onBlur]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, close, open]);

  const selectOption = useCallback(
    (val: string) => {
      const opt = options.find((o) => o.value === val);
      if (opt && !opt.disabled) {
        onChange?.(val);
        close();
        triggerRef.current?.focus();
      }
    },
    [options, onChange, close]
  );

  // Measure and position popover when opened, resized, or scrolled
  useLayoutEffect(() => {
    if (isOpen) {
      updatePlacement();
    }
  }, [isOpen, updatePlacement]);

  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updatePlacement();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePlacement]);

  // Click outside detection
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, close]);

  // Scroll active option into view when activeIndex changes
  useEffect(() => {
    if (isOpen && activeIndex >= 0 && optionRefs.current[activeIndex]) {
      optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, activeIndex]);

  // Disable snap highlight after initial layout
  useEffect(() => {
    if (isOpen && snapHighlight) {
      const id = requestAnimationFrame(() => {
        setSnapHighlight(false);
      });
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen, snapHighlight]);

  // Typeahead key handler
  const handleTypeahead = useCallback(
    (char: string) => {
      if (typeaheadTimerRef.current) {
        clearTimeout(typeaheadTimerRef.current);
      }
      const newBuffer = typeaheadBufferRef.current + char;
      typeaheadBufferRef.current = newBuffer;

      typeaheadTimerRef.current = setTimeout(() => {
        typeaheadBufferRef.current = '';
        typeaheadTimerRef.current = null;
      }, 500);

      const matchIdx = typeahead(options, activeIndex, newBuffer);
      if (matchIdx !== -1) {
        setActiveIndex(matchIdx);
      }
    },
    [options, activeIndex]
  );

  // Keyboard navigation on trigger button
  const handleTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;

      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
          return;
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          open();
          handleTypeahead(e.key);
          return;
        }
        return;
      }

      // Popover is open
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setActiveIndex((curr) => moveIndex(options, curr, 1));
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setActiveIndex((curr) => moveIndex(options, curr, -1));
          break;
        }
        case 'Home': {
          e.preventDefault();
          setActiveIndex(homeIndex(options));
          break;
        }
        case 'End': {
          e.preventDefault();
          setActiveIndex(endIndex(options));
          break;
        }
        case 'PageDown': {
          e.preventDefault();
          setActiveIndex((curr) => pageIndex(options, curr, 'down'));
          break;
        }
        case 'PageUp': {
          e.preventDefault();
          setActiveIndex((curr) => pageIndex(options, curr, 'up'));
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          if (activeIndex >= 0 && options[activeIndex] && !options[activeIndex].disabled) {
            selectOption(options[activeIndex].value);
          } else {
            close();
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          e.stopPropagation();
          close();
          triggerRef.current?.focus();
          break;
        }
        case 'Tab': {
          // Tab selects the active option, closes, and lets focus advance
          if (activeIndex >= 0 && options[activeIndex] && !options[activeIndex].disabled) {
            onChange?.(options[activeIndex].value);
          }
          close();
          break;
        }
        default: {
          if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            handleTypeahead(e.key);
          }
          break;
        }
      }
    },
    [disabled, isOpen, options, activeIndex, open, close, selectOption, handleTypeahead, onChange]
  );

  // Compute highlight position from active option element
  const getHighlightStyle = useCallback((): HighlightStyle => {
    if (!isOpen || activeIndex < 0 || !optionRefs.current[activeIndex]) {
      return { top: 0, height: 0, opacity: 0, snap: true };
    }
    const el = optionRefs.current[activeIndex];
    if (!el) return { top: 0, height: 0, opacity: 0, snap: true };

    return {
      top: el.offsetTop,
      height: el.offsetHeight,
      opacity: 1,
      snap: snapHighlight,
    };
  }, [isOpen, activeIndex, snapHighlight]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return {
    isOpen,
    isClosing,
    activeIndex,
    setActiveIndex,
    open,
    close,
    toggle,
    selectOption,
    selectedOption,
    triggerRef,
    popoverRef,
    optionRefs,
    popoverCoords,
    placementResult,
    handleTriggerKeyDown,
    getHighlightStyle,
  };
}
