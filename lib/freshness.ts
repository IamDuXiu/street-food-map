/** Pure freshness helpers shared by server (repository) and client (cards). */

export type FreshnessTier = 'recent' | 'valid' | 'stale' | 'expired';
export type FreshnessLabel = '近期核验' | '有效' | '可能过期' | '已过期';

export function ageInDays(observedAt: string, now = new Date()): number {
  return Math.floor((now.getTime() - new Date(observedAt).getTime()) / 86400000);
}

/** The single tiering function: recent <=30d, valid <=90d, stale <=180d, else expired. */
export function freshness(observedAt: string, now = new Date()): FreshnessTier {
  const days = ageInDays(observedAt, now);
  if (days <= 30) return 'recent';
  if (days <= 90) return 'valid';
  if (days <= 180) return 'stale';
  return 'expired';
}

export function freshnessLabel(tier: FreshnessTier): FreshnessLabel {
  switch (tier) {
    case 'recent':
      return '近期核验';
    case 'valid':
      return '有效';
    case 'stale':
      return '可能过期';
    default:
      return '已过期';
  }
}

/** 0 -> 今天核验；1 -> 1 天前核验；其余 -> N 天前核验。 */
export function relativeVerificationLabel(
  meal: { observedAt: string; ageDays?: number },
  now = new Date(),
): string {
  const days = meal.ageDays ?? ageInDays(meal.observedAt, now);
  if (days <= 0) return '今天核验';
  if (days === 1) return '1 天前核验';
  return `${days} 天前核验`;
}

/** Same window, but for creator-sourced (not independently verified) entries. */
export function relativePublishedLabel(
  meal: { observedAt: string; ageDays?: number },
  now = new Date(),
): string {
  const days = meal.ageDays ?? ageInDays(meal.observedAt, now);
  if (days <= 0) return '今天发布';
  if (days === 1) return '1 天前发布';
  return `${days} 天前发布`;
}
