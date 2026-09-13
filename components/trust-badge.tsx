function trustClass(label: string): string {
  if (label === '中高可信' || label === '中可信') return 'trust-mid';
  if (label === '低可信' || label === '可能过期' || label === '已过期' || label === '超过 180 天')
    return 'trust-low';
  return '';
}

export function TrustBadge({
  label = '现场核验',
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  const extra = trustClass(label);
  return (
    <span
      className={`trust-badge ${extra} ${compact ? 'trust-badge-compact' : ''}`}
    >
      <span aria-hidden="true">✓</span>
      {label}
    </span>
  );
}
