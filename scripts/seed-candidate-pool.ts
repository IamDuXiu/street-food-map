import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '@/lib/server/db';
import { seedCandidateBatch } from '@/lib/candidate-pool';

export function seedNanshanCandidatePool(
  filePath = path.resolve(process.cwd(), 'tmp/nanshan-leads/consolidated.json'),
) {
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
