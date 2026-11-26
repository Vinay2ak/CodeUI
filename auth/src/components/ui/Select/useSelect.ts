import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  endIndex,
  firstEnabledIndex,
  homeIndex,
  moveIndex,
  pageIndex,
  placement,
  type SelectOption,
  typeahead,
} from "./logic";

export interface UseSelectProps {
  options: readonly SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
}

export function useSelect({
  options,
  value,
  onChange,
  onBlur,
  disabled = false,
}: UseSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [side, setSide] = useState<"bottom" | "top">("bottom");
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const [highlightStyle, setHighlightStyle] = useState<CSSProperties>({ opacity: 0 });

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listboxRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const typeaheadTimerRef = useRef<number | null>(null);
  const typeaheadBufferRef = useRef<string>("");
  const closeTimerRef = useRef<number | null>(null);

  const selectedIndex = options.findIndex((opt) => opt.value === value);

  // Measure and position the popover
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Close if scrolled out of viewport
    if (triggerRect.bottom < 0 || triggerRect.top > viewportHeight) {
      setIsOpen(false);
      setIsClosing(false);
      return;
    }

    const listHeight = listboxRef.current?.scrollHeight || 200;
    const { side: nextSide, maxHeight } = placement({
      triggerRect,
      viewportHeight,
      listHeight,
      gap: 6,
      margin: 12,
      maxHeight: 280,
    });

    setSide(nextSide);

    const viewportWidth = window.innerWidth;
    const margin = 12;
    let finalWidth = Math.max(200, triggerRect.width);
    let finalLeft = triggerRect.left;

    if (finalLeft + finalWidth > viewportWidth - margin) {
      finalLeft = Math.max(margin, viewportWidth - margin - finalWidth);
    }
    if (finalWidth > viewportWidth - margin * 2) {
      finalWidth = viewportWidth - margin * 2;
      finalLeft = margin;
    }

    const top =
      nextSide === "bottom"
        ? triggerRect.bottom + 6
        : triggerRect.top - 6 - maxHeight;

    setPopoverStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${finalLeft}px`,
      width: `${finalWidth}px`,
      maxHeight: `${maxHeight}px`,
    });
  }, []);

  // Update sliding highlight
  const updateHighlight = useCallback((index: number) => {
    const optionEl = optionRefs.current[index];
    if (!optionEl) {
      setHighlightStyle({ opacity: 0 });
      return;
    }

    setHighlightStyle({
      opacity: 1,
      transform: `translateY(${optionEl.offsetTop}px)`,
      height: `${optionEl.offsetHeight}px`,
    });
  }, []);

  const open = useCallback(() => {
    if (disabled || isOpen) return;
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setIsClosing(false);
    setIsOpen(true);

    const initial =
      selectedIndex >= 0 && options[selectedIndex] && !options[selectedIndex]?.disabled
        ? selectedIndex
        : firstEnabledIndex(options);

    setActiveIndex(initial);
  }, [disabled, isOpen, options, selectedIndex]);

  const close = useCallback(
    (selectActive = false) => {
      if (!isOpen || isClosing) return;

      if (selectActive && activeIndex >= 0 && activeIndex < options.length) {
        const activeOpt = options[activeIndex];
        if (activeOpt && !activeOpt.disabled) {
          onChange(activeOpt.value);
        }
      }

      setIsClosing(true);
      closeTimerRef.current = window.setTimeout(() => {
        setIsOpen(false);
        setIsClosing(false);
        closeTimerRef.current = null;
        triggerRef.current?.focus();
      }, 120);
    },
    [activeIndex, isClosing, isOpen, onChange, options]
  );

  // Position updates on open, resize, scroll
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Keep active option in view and update highlight
  useEffect(() => {
    if (!isOpen || activeIndex < 0) {
      setHighlightStyle({ opacity: 0 });
      return;
    }

    updateHighlight(activeIndex);

    const el = optionRefs.current[activeIndex];
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, isOpen, updateHighlight]);

  // Outside click to close
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (
        triggerRef.current?.contains(target) ||
        listboxRef.current?.contains(target)
      ) {
        return;
      }
      close(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [close, isOpen]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (typeaheadTimerRef.current) window.clearTimeout(typeaheadTimerRef.current);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Enter" ||
        e.key === " "
      ) {
        e.preventDefault();
        open();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = moveIndex(options, activeIndex, 1);
        setActiveIndex(next);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = moveIndex(options, activeIndex, -1);
        setActiveIndex(prev);
        break;
      }
      case "Home": {
        e.preventDefault();
        const first = homeIndex(options);
        setActiveIndex(first);
        break;
      }
      case "End": {
        e.preventDefault();
        const last = endIndex(options);
        setActiveIndex(last);
        break;
      }
      case "PageDown": {
        e.preventDefault();
        const pageDown = pageIndex(options, activeIndex, 1);
        setActiveIndex(pageDown);
        break;
      }
      case "PageUp": {
        e.preventDefault();
        const pageUp = pageIndex(options, activeIndex, -1);
        setActiveIndex(pageUp);
        break;
      }
      case "Enter":
      case " ": {
        e.preventDefault();
        close(true);
        break;
      }
      case "Escape": {
        e.preventDefault();
        e.stopPropagation();
        close(false);
        break;
      }
      case "Tab": {
        // Tab selects active option, closes, and focus moves naturally
        close(true);
        break;
      }
      default: {
        // Printable character for typeahead
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          if (typeaheadTimerRef.current) {
            window.clearTimeout(typeaheadTimerRef.current);
          }
          typeaheadBufferRef.current += e.key;
          typeaheadTimerRef.current = window.setTimeout(() => {
            typeaheadBufferRef.current = "";
            typeaheadTimerRef.current = null;
          }, 500);

          const matched = typeahead(options, activeIndex, typeaheadBufferRef.current);
          if (matched >= 0) {
            setActiveIndex(matched);
          }
        }
        break;
      }
    }
  };

  const handleTriggerBlur = () => {
    onBlur?.();
  };

  return {
    isOpen,
    isClosing,
    side,
    activeIndex,
    selectedIndex,
    popoverStyle,
    highlightStyle,
    triggerRef,
    listboxRef,
    optionRefs,
    open,
    close,
    setActiveIndex,
    handleKeyDown,
    handleTriggerBlur,
  };
}
