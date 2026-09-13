import type { ReactNode } from 'react';

export type NoticeTone = 'error' | 'success' | 'info';

/**
 * Shared, explicit status messaging. The tone is intentionally encoded in a
 * class so styling never depends on an ARIA role (role="status" is not a
 * visual signal).
 */
export function Notice({
  tone = 'info',
  children,
  className = '',
  role,
}: {
  tone?: NoticeTone;
  children: ReactNode;
  className?: string;
  role?: 'alert' | 'status' | 'log';
}) {
  const defaultRole = tone === 'error' ? 'alert' : 'status';
  return (
    <div
      className={`ui-notice ui-notice-${tone}${className ? ` ${className}` : ''}`}
      role={role ?? defaultRole}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      {children}
    </div>
  );
}
