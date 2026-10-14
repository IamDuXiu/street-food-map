import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '@/lib/server/db';
import { seedCandidateBatch } from '@/lib/candidate-pool';

/**
 * 把「候选线索 JSON」灌进线索池。文件不在仓库里（线索数据属于运营数据，不入公开仓库），
 * 默认路径只是本机约定；用 `npm run seed:candidates -- <文件路径>` 指定自己的文件。
 */
export function seedNanshanCandidatePool(
  filePath = path.resolve(process.cwd(), 'tmp/nanshan-leads/consolidated.json'),
) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `找不到候选线索文件：${filePath}\n` +
        '请传入路径，例如：npm run seed:candidates -- ./my-leads/consolidated.json\n' +
        '文件需为 { "records": [...] } 结构，字段见 lib/candidate-pool.ts。',
    );
  }
  const input = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
    records: unknown[];
  };
  if (!Array.isArray(input.records)) throw new Error('CANDIDATE_RECORDS_REQUIRED');
  const result = seedCandidateBatch(openDatabase(), input.records, 'seed-script');
  if (result.count !== input.records.length)
    throw new Error('CANDIDATE_RECORD_COUNT_MISMATCH');
  return result;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const result = seedNanshanCandidatePool();
  console.log(
    JSON.stringify(
      {
        records: result.count,
        sourceLeads: result.sourceLeadIds.length,
        sourceLeadItems: result.sourceLeadItemIds.length,
        insertedLeads: result.insertedLeads.length,
        insertedItems: result.insertedItems.length,
      },
      null,
      2,
    ),
  );
}
