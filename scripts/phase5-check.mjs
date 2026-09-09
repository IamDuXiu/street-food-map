import fs from 'node:fs';
import path from 'node:path';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lanScript = fs.readFileSync(path.join('scripts', 'dev-lan.mjs'), 'utf8');
if (!packageJson.scripts['dev:lan'] || !lanScript.includes("'0.0.0.0'")) throw new Error('dev:lan must bind 0.0.0.0');

const csvSource = fs.readFileSync(path.join('lib', 'csv.ts'), 'utf8');
const match = csvSource.match(/export const BUDGET_IMPORT_HEADERS = \[([\s\S]*?)\] as const/);
if (!match) throw new Error('BUDGET_IMPORT_HEADERS not found');
const expected = [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
const displayMatch = csvSource.match(/export const BUDGET_IMPORT_DISPLAY_HEADERS = \[([\s\S]*?)\] as const/);
if (!displayMatch) throw new Error('BUDGET_IMPORT_DISPLAY_HEADERS not found');
const displayExpected = [...displayMatch[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
if (displayExpected.length !== expected.length) throw new Error('display and internal import header counts differ');
const importTemplate = fs.readFileSync(path.join('docs', 'templates', 'phase5-import-template.csv'));
if (!importTemplate.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) throw new Error('import template is missing UTF-8 BOM');
const importHeader = importTemplate.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].split(',');
if (importHeader.join('|') !== displayExpected.join('|')) throw new Error('import template does not match Chinese display headers');

const observation = fs.readFileSync(path.join('docs', 'templates', 'phase5-observations.csv'));
if (!observation.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) throw new Error('observation template is missing UTF-8 BOM');
const observationHeader = observation.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].split(',');
const required = ['anonymous_id', 'device', 'location_choice', 'starting_zone', 'found_within_30s', 'final_price_yuan', 'final_distance_meters', 'understood_verification', 'clicked_navigation', 'natural_submission', 'main_blocker', 'reuse_intention', 'notes'];
if (observationHeader.join('|') !== required.join('|')) throw new Error('observation template fields changed');
if (observationHeader.some((field) => /name|phone|wechat|email|openid/i.test(field))) throw new Error('observation template contains identity fields');

console.log(`Phase 5 preparation OK: dev:lan binding, ${expected.length} Chinese import headers, BOM and anonymous observation fields verified.`);
