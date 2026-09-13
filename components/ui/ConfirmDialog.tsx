'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Notice } from './Notice';

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = '确认',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const onConfirmRef = useRef(onConfirm);
  const confirmingRef = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const errorId = `${titleId}-error`;

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);
  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);
  useEffect(() => {
    confirmingRef.current = confirming;
  }, [confirming]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const resetError = window.setTimeout(() => setError(null), 0);
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!confirmingRef.current) onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [closeRef.current, cancelRef.current, ...(confirmingRef.current ? [] : [confirmRef.current])].filter(
        (element): element is HTMLButtonElement => Boolean(element && !element.disabled),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const currentIndex = focusable.indexOf(document.activeElement as HTMLButtonElement);
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
        : (currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
      if (currentIndex === -1 || (event.shiftKey && currentIndex === 0) || (!event.shiftKey && currentIndex === focusable.length - 1)) {
        event.preventDefault();
        focusable[nextIndex]?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(resetError);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (confirming) dialogRef.current?.focus();
    else if (error) confirmRef.current?.focus();
  }, [confirming, error]);

  if (!open) return null;
  async function handleConfirm() {
    if (confirming) return;
    setError(null);
    setConfirming(true);
    try {
      await onConfirmRef.current();
    } catch {
      setError('操作未完成，请检查后重试。');
    } finally {
      setConfirming(false);
    }
  }
  return (
    <div
      className="ui-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !confirming) onCancelRef.current();
      }}
    >
      <section
        ref={dialogRef}
        className="ui-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={error ? errorId : undefined}
        aria-busy={confirming}
        tabIndex={-1}
      >
        <div className="ui-dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button ref={closeRef} className="ui-dialog-close" type="button" onClick={() => { if (!confirming) onCancelRef.current(); }} disabled={confirming} aria-label="关闭">
            ×
          </button>
        </div>
        {children ? <div className="ui-dialog-body">{children}</div> : null}
        {error ? <div className="ui-dialog-body" id={errorId}><Notice tone="error">{error}</Notice></div> : null}
        <div className="ui-dialog-actions">
          <button ref={cancelRef} className="secondary-button" type="button" onClick={() => { if (!confirming) onCancelRef.current(); }} disabled={confirming}>
            {cancelLabel}
          </button>
          <button ref={confirmRef} className="primary-button" type="button" onClick={handleConfirm} disabled={confirming}>
            {confirming ? '处理中…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
