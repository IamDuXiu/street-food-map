export function TrustBadge({ label = '现场核验', compact = false }: { label?: string; compact?: boolean }) {
  return <span className={`trust-badge ${compact ? 'trust-badge-compact' : ''}`}><span aria-hidden="true">✓</span>{label}</span>;
}
