# UI guidelines

## Foundation

The product uses a restrained light foundation: `--surface` (`#fff`) for cards and controls, `--paper` (`#f7f7f8`) for page chrome, `--ink` (`#242526`) for primary text, and `--muted` (`#64686d`) for secondary text. Borders are 1px `--line`; standard radii are 8–12px. Coral (`--brand`, `#ef806c`) is a small brand accent only; do not use it as a paragraph colour on white.

Desktop page titles are 28–32px and mobile titles 24px. Body copy is 14–16px; important helper text is at least 12px. Buttons and form controls are 40–44px high, with a visible keyboard focus ring.

## Shared component contract

Use `Notice` from `components/ui/Notice` for recoverable feedback:

- `tone="error"` → `.ui-notice-error` (muted red surface, readable dark text)
- `tone="success"` → `.ui-notice-success` (muted green surface, readable dark text)
- `tone="info"` → `.ui-notice-info` (muted blue-grey surface, readable dark text)

ARIA roles (`alert`/`status`) are for announcements only and must not determine visual tone. For legacy markup, add the matching `ui-notice-*` class explicitly.

Use `ConfirmDialog` from `components/ui/ConfirmDialog` for destructive or irreversible confirmation. It provides `.ui-dialog-backdrop`, `.ui-dialog`, `.ui-dialog-header`, `.ui-dialog-body`, and `.ui-dialog-actions`; keep actions as `.secondary-button` then `.primary-button`. `onConfirm` may return a Promise: the dialog locks all dismissal while it is pending, shows a generic retryable error on rejection, and the caller should close its `open` state only after success.

The map SDK container and Tencent logo are adapter-owned and must remain intact. Keep mobile admin back-to-user and logout controls reachable; reserve bottom padding when a fixed action bar is present.
