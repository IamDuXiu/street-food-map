/** Pick a food emoji from candidate category strings; falls back to 🍚. */

const KEYWORDS: Array<[string[], string]> = [
  [['咖喱'], '🍛'],
  [['米线', '面', '粉'], '🍜'],
  [['食堂'], '🍲'],
  [['便利店', '打包'], '🥡'],
  [['档口', '小吃'], '🥘'],
  [['快餐', '米饭', '盖饭', '便当'], '🍚'],
];

export function categoryEmoji(
  ...candidates: Array<string | undefined | null>
): string {
  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const [keywords, emoji] of KEYWORDS) {
      if (keywords.some((keyword) => candidate.includes(keyword))) return emoji;
    }
  }
  return '🍚';
}
