import type { VerificationLevel } from './types';

const RANK: Record<VerificationLevel, number> = {
  高可信: 3,
  中高可信: 2,
  中可信: 1,
  近期核验: 1,
  低可信: 0,
};

/** Map a price report verification method to its public trust level. */
export function verificationLevelForMethod(method: string): VerificationLevel {
  switch (method) {
    case 'onsite_menu':
    case 'receipt':
      return '高可信';
    case 'official_menu':
    case 'community_confirmed':
      return '中高可信';
    case 'external_lead':
      return '低可信';
    default:
      return '中可信';
  }
}

/** Human-facing label for a verification method. */
export function methodLabel(method: string): string {
  switch (method) {
    case 'onsite_menu':
      return '现场价签';
    case 'receipt':
      return '消费小票';
    case 'official_menu':
      return '官方菜单';
    case 'phone_check':
      return '电话核验';
    case 'community_confirmed':
      return '双人确认';
    case 'external_lead':
      return '线索';
    default:
      return '线索';
  }
}

/** Highest trust level among a place's meals, plus the number of verified meals. */
export function placeTrust(meals: Array<{ method: string }>): {
  level: VerificationLevel;
  verifiedCount: number;
} {
  if (meals.length === 0) return { level: '中可信', verifiedCount: 0 };
  let level: VerificationLevel = '低可信';
  let verifiedCount = 0;
  for (const meal of meals) {
    const candidate = verificationLevelForMethod(meal.method);
    if (RANK[candidate] > RANK[level]) level = candidate;
    if (candidate !== '低可信') verifiedCount += 1;
  }
  return { level, verifiedCount };
}
