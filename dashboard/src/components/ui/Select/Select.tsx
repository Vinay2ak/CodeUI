import React, { useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { SelectOption } from './logic';
import { useSelect } from './useSelect';

export interface SelectProps {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  size?: 'md' | 'sm';
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  id,
  value,
  onChange,
  onBlur,
  name,
  options,
  placeholder = 'Select…',
  disabled = false,
  invalid = false,
  required = false,
  size = 'md',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  'aria-describedby': ariaDescribedby,
  className = '',
}) => {
  const generatedId = useId();
  const triggerId = id || `select-trigger-${generatedId}`;
  const listboxId = `select-listbox-${generatedId}`;

  const {
    isOpen,
    isClosing,
    activeIndex,
    setActiveIndex,
    toggle,
    selectOption,
    selectedOption,
    triggerRef,
    popoverRef,
    optionRefs,
    popoverCoords,
    handleTriggerKeyDown,
    getHighlightStyle,
  } = useSelect({
    value,
    onChange,
    onBlur,
    options,
    disabled,
  });

  const highlight = getHighlightStyle();

  // Find nearest role="dialog" or fallback to document.body
  const portalTarget =
    typeof document !== 'undefined'
      ? (triggerRef.current?.closest('[role="dialog"]') as HTMLElement) || document.body
      : null;

  const showPopover = (isOpen || isClosing) && portalTarget && popoverCoords;

  return (
    <>
      {name && <input type="hidden" name={name} value={value ?? ''} />}

      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={
          isOpen && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
        }
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={handleTriggerKeyDown}
        className={`cb-select-trigger cb-select-trigger--${size} ${
          isOpen ? 'cb-select-trigger--open' : ''
        } ${invalid ? 'cb-select-trigger--invalid' : ''} ${className}`}
      >
        <div className="cb-select-trigger-content">
          {selectedOption?.tone && (
            <span
              className={`cb-select-tone-dot cb-select-tone-dot--${selectedOption.tone}`}
              aria-hidden="true"
            />
          )}
          {selectedOption ? (
            <span className="cb-select-trigger-label">{selectedOption.label}</span>
          ) : (
            <span className="cb-select-trigger-label cb-select-placeholder">
              {placeholder}
            </span>
          )}
        </div>

        <ChevronDown
          className={`cb-select-chevron ${isOpen ? 'cb-select-chevron--open' : ''}`}
          aria-hidden="true"
        />
      </button>

      {showPopover &&
        createPortal(
          <div
            ref={popoverRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={ariaLabelledby || triggerId}
            className={`cb-select-popover cb-select-popover--side-${
              popoverCoords.side
            } ${isClosing ? 'cb-select-popover--exit' : 'cb-select-popover--enter'}`}
            style={{
              top: popoverCoords.top != null ? `${popoverCoords.top}px` : undefined,
              bottom:
                popoverCoords.bottom != null ? `${popoverCoords.bottom}px` : undefined,
              left: `${popoverCoords.left}px`,
              minWidth: `${popoverCoords.minWidth}px`,
              maxHeight: `${popoverCoords.maxHeight}px`,
            }}
          >
            <div className="cb-select-list">
              <div
                className="cb-select-highlight"
                style={{
                  top: `${highlight.top}px`,
                  height: `${highlight.height}px`,
                  opacity: highlight.opacity,
                  transition: highlight.snap ? 'none' : undefined,
                }}
                aria-hidden="true"
              />

              {options.map((opt, index) => {
                const isSelected = opt.value === value;
                const optId = `${listboxId}-opt-${index}`;

                return (
                  <div
                    key={opt.value}
                    ref={(el) => {
                      optionRefs.current[index] = el;
                    }}
                    id={optId}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled || undefined}
                    className={`cb-select-option ${
                      isSelected ? 'cb-select-option--selected' : ''
                    } ${opt.disabled ? 'cb-select-option--disabled' : ''}`}
                    onPointerMove={() => {
                      if (!opt.disabled && activeIndex !== index) {
                        setActiveIndex(index);
                      }
                    }}
                    onClick={() => {
                      if (!opt.disabled) {
                        selectOption(opt.value);
                      }
                    }}
                  >
                    <div className="cb-select-option-content">
                      <div className="cb-select-option-main">
                        {opt.tone && (
                          <span
                            className={`cb-select-tone-dot cb-select-tone-dot--${opt.tone}`}
                            aria-hidden="true"
                          />
                        )}
                        <span className="cb-select-option-label">{opt.label}</span>
                      </div>
                      {opt.description && (
                        <span className="cb-select-option-desc">{opt.description}</span>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="cb-select-check-icon" aria-hidden="true" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>,
          portalTarget
        )}
    </>
  );
};
