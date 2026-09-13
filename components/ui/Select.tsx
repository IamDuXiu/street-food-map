'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Custom listbox select. Keeps the value in a hidden input named `name`, so it
 * still participates in FormData, while the popup width is locked to the field
 * (native `<select>` popups grow to the widest option and cannot be constrained).
 */
export function Select({
  name,
  value,
  onChange,
  options,
  placeholder = '请选择',
  disabled = false,
  ariaLabel,
  ariaInvalid = false,
  ariaDescribedBy,
  id,
  className,
  variant = 'field',
}: {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  id?: string;
  className?: string;
  variant?: 'field' | 'compact' | 'bare';
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => document.removeEventListener('mousedown', onDocumentMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[activeIndex];
    active?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  function openMenu() {
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  }

  function commit(option: SelectOption) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function move(delta: number) {
    if (!options.length) return;
    setActiveIndex((index) => {
      let next = index;
      for (let step = 0; step < options.length; step += 1) {
        next = (next + delta + options.length) % options.length;
        if (!options[next]?.disabled) break;
      }
      return next;
    });
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(options.length - 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) commit(option);
    }
  }

  return (
    <div className={`ui-select ui-select--${variant}${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`} ref={rootRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="ui-select-trigger"
        role="combobox"
        data-value={value}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          if (open) setOpen(false);
          else openMenu();
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="ui-select-value">{selected ? selected.label : placeholder}</span>
        <span className="ui-select-caret" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      <ul id={listId} role="listbox" ref={listRef} className="ui-select-menu" hidden={!open}>
        {options.map((option, index) => (
          <li
            key={option.value || `__option-${index}`}
            role="option"
            data-value={option.value}
            aria-selected={option.value === value}
            aria-disabled={option.disabled || undefined}
            className={`ui-select-option${index === activeIndex ? ' is-active' : ''}${option.value === value ? ' is-selected' : ''}${option.disabled ? ' is-disabled' : ''}`}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={(event) => {
              event.preventDefault();
              commit(option);
            }}
          >
            <span className="ui-select-option-label">{option.label}</span>
            {option.value === value && (
              <span className="ui-select-check" aria-hidden="true">
                ✓
              </span>
            )}
          </li>
        ))}
      </ul>
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
