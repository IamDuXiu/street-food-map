/**
 * 这个实例是不是「演示数据实例」。
 *
 * 用途：公开页面上的演示提示、`npm run preflight` 的提醒。判断依据是演示数据自己写入
 * 的片区行——全国演示片区 id 以 `demo-` 开头，深圳样板区用两个固定 id；这些都是演示
 * 数据独有的，真实部署（`SEED_DEMO=0`）不会产生。
 *
 * 为什么不用环境变量判断：`SEED_DEMO` 只决定「要不要写演示数据」，改回 0 并不会删除
 * 已经写进库里的门店。用库里的行判断，才不会把「库里有假数据、但环境变量说没有」
 * 的状态显示成正常。
 */
import type { SqliteDatabase } from './db';

/** 深圳样板区的两个固定片区 id（`lib/fixtures.ts` 的 VIEWPORTS）。 */
const SAMPLE_ZONE_IDS = ['sz university', 'science park'];

export function hasDemoData(db: SqliteDatabase): boolean {
  const placeholders = SAMPLE_ZONE_IDS.map(() => '?').join(',');
  const row = db
    .prepare(
      `SELECT 1 FROM pilot_zones WHERE id LIKE 'demo-%' OR id IN (${placeholders}) LIMIT 1`,
    )
    .get(...SAMPLE_ZONE_IDS);
  return Boolean(row);
}
