import {
  forwardRef,
  useId,
  useImperativeHandle,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import type { SelectOption } from "./logic";
import { useSelect } from "./useSelect";

export interface SelectProps {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  size?: "md" | "sm";
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  className?: string;
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      id,
      value,
      onChange,
      onBlur,
      name,
      options,
      placeholder = "Select…",
      disabled = false,
      invalid = false,
      required = false,
      size = "md",
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      "aria-describedby": ariaDescribedBy,
      className = "",
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const listboxId = `${selectId}-listbox`;

    const {
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
    } = useSelect({
      options,
      value,
      onChange,
      onBlur,
      disabled,
    });

    useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement);

    const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;
    const activeOptionId =
      isOpen && activeIndex >= 0 ? `${selectId}-opt-${activeIndex}` : undefined;

    const portalTarget =
      typeof document !== "undefined"
        ? triggerRef.current?.closest('[role="dialog"]') || document.body
        : null;

    const triggerClasses = [
      "cb-select-trigger",
      size === "sm" ? "cb-select-trigger--sm" : "",
      isOpen ? "cb-select-trigger--open" : "",
      invalid ? "cb-select-trigger--invalid" : "",
      disabled ? "cb-select-trigger--disabled" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <>
        {name && (
          <input
            type="hidden"
            name={name}
            value={value || ""}
            disabled={disabled}
            required={required}
          />
        )}
        <button
          ref={triggerRef}
          type="button"
          id={selectId}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          disabled={disabled}
          onClick={() => (isOpen ? close(false) : open())}
          onKeyDown={handleKeyDown}
          onBlur={handleTriggerBlur}
          className={triggerClasses}
        >
          <span className="cb-select-value">
            {selectedOption?.tone && (
              <span
                className={`cb-select-tone-dot cb-select-tone-dot--${selectedOption.tone}`}
                aria-hidden="true"
              />
            )}
            {selectedOption ? (
              <span key={selectedOption.value} className="cb-select-label-text">
                {selectedOption.label}
              </span>
            ) : (
              <span className="cb-select-placeholder">{placeholder}</span>
            )}
          </span>
          <ChevronDown className="cb-select-chevron" aria-hidden="true" />
        </button>

        {portalTarget &&
          (isOpen || isClosing) &&
          createPortal(
            <div
              ref={listboxRef}
              id={listboxId}
              role="listbox"
              tabIndex={-1}
              aria-labelledby={ariaLabelledBy || selectId}
              className={[
                "cb-select-popover",
                `cb-select-popover--side-${side}`,
                isOpen && !isClosing ? "cb-select-popover--open" : "",
                isClosing ? "cb-select-popover--closing" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={popoverStyle as CSSProperties}
            >
              <div
                className="cb-select-highlight"
                style={highlightStyle as CSSProperties}
                aria-hidden="true"
              />

              {options.map((opt, idx) => {
                const optId = `${selectId}-opt-${idx}`;
                const isSelected = opt.value === value;
                const isActive = activeIndex === idx;
                const isDisabled = Boolean(opt.disabled);

                return (
                  <div
                    key={opt.value}
                    ref={(el) => {
                      optionRefs.current[idx] = el;
                    }}
                    id={optId}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={isDisabled || undefined}
                    data-active={isActive || undefined}
                    onPointerEnter={() => {
                      if (!isDisabled) setActiveIndex(idx);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isDisabled) {
                        onChange(opt.value);
                        close(false);
                      }
                    }}
                    className={[
                      "cb-select-option",
                      isActive ? "cb-select-option--active" : "",
                      isSelected ? "cb-select-option--selected" : "",
                      isDisabled ? "cb-select-option--disabled" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="cb-select-option-content">
                      {opt.tone && (
                        <span
                          className={`cb-select-tone-dot cb-select-tone-dot--${opt.tone}`}
                          aria-hidden="true"
                        />
                      )}
                      <div className="cb-select-option-text-group">
                        <span className="cb-select-option-label">{opt.label}</span>
                        {opt.description && (
                          <span className="cb-select-option-desc">
                            {opt.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="cb-select-check" aria-hidden="true" />
                    )}
                  </div>
                );
              })}
            </div>,
            portalTarget
          )}
      </>
    );
  }
);

Select.displayName = "Select";
