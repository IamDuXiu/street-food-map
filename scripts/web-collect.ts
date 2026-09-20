import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUDGET_PRICE_YUAN, CITIES } from '../lib/cities';
import { creatorImportRecordSchema } from '../lib/server/creator-import';
import { stripHtml } from './creator-collect';

/**
 * Search-engine web collector.
 *
 * Discovers cheap-fast-food articles via Bing (default) or Baidu, extracts
 * store/meal/price with MiniMax, and writes JSON that can be pasted into
 * `/admin/creator-import`.  Never writes to the database.  reviewNotes stay
 * on the collect record for human review and are stripped by the import schema.
 */

export const PUBLIC_CITIES = CITIES.filter((city) => city.public);

export const KEYWORD_STEMS = [
  '15元快餐',
  '10元吃饱',
  '20元以下 午餐',
  '穷鬼套餐',
  '平价食堂',
  '打工人 午餐',
  '学生党 便宜 吃饭',
  '盒饭 便宜',
  '社区食堂',
  '城中村 快餐',
  '工地餐',
  '大学城 便宜',
] as const;

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

export function defaultKeywords(limitPerCity = 2): string[] {
  return PUBLIC_CITIES.flatMap((city) =>
    KEYWORD_STEMS.slice(0, limitPerCity).map((stem) => `${city.label} ${stem}`),
  );
}

export interface SearchHit {
  url: string;
  title: string;
  snippet: string;
  engine: 'bing' | 'baidu';
  keyword: string;
}

export interface WebLeadRecord {
  storeName: string;
  mealName: string;
  priceYuan: number;
  address: string;
  city: string;
  placeCategory: string;
  accessType: string;
  platform: string;
  creatorName: string;
  contentUrl: string;
  contentTitle: string;
  observedAt?: string;
  reviewNotes?: string;
  collect: {
    needsStoreName: boolean;
    needsAddress: boolean;
    matchedCityAlias: string;
    sourceKeyword?: string;
    engine?: string;
  };
}

export interface MiniMaxExtractedShop {
  storeName?: string;
  address?: string;
  city?: string;
  mealName?: string;
  priceYuan?: number;
  recommended?: string;
  reviewNotes?: string;
  author?: string;
  site?: string;
  publishedAt?: string;
}

export function canonicalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    if (parsed.hostname.startsWith('www.'))
      parsed.hostname = parsed.hostname.slice(4);
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'web';
  }
}

const BLOCKED_HOSTS = [
  'microsoft.com',
  'bing.com',
  'baidu.com',
  'wikipedia.org',
];

export function isBlockedHost(url: string): boolean {
  const host = hostnameOf(url);
  return BLOCKED_HOSTS.some(
    (blocked) => host === blocked || host.endsWith(`.${blocked}`),
  );
}

export function parseBingHtml(html: string): Array<{
  url: string;
  title: string;
  snippet: string;
}> {
  const hits: Array<{ url: string; title: string; snippet: string }> = [];
  const blocks = html.split(/<li class="b_algo"/i).slice(1);
  for (const block of blocks) {
    const href = block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"/i)?.[1];
    const title = stripHtml(
      block.match(/<h2[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '',
    );
    const snippet = stripHtml(
      block.match(/<p[^>]*class="b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ??
        block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ??
        '',
    );
    if (!href || !title) continue;
    hits.push({ url: href, title, snippet });
  }
  return hits;
}

export function parseBaiduHtml(html: string): Array<{
  url: string;
  title: string;
  snippet: string;
}> {
  const hits: Array<{ url: string; title: string; snippet: string }> = [];
  const blocks = html.split(/<div class="result /).slice(1);
  for (const block of blocks) {
    const href = block.match(/<h3[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"/i)?.[1];
    const title = stripHtml(
      block.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '',
    );
    const snippet = stripHtml(
      block.match(/class="c-abstract"[^>]*>([\s\S]*?)<\/(?:span|div|p)>/i)?.[1] ??
        '',
    );
    if (!href || !title) continue;
    hits.push({ url: href, title, snippet });
  }
  return hits;
}

export function extractArticleText(html: string): string {
  const withoutChrome = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  const article =
    withoutChrome.match(/<article[\s\S]*?<\/article>/i)?.[0] ??
    withoutChrome.match(/<main[\s\S]*?<\/main>/i)?.[0] ??
    withoutChrome;
  return stripHtml(article).slice(0, 8000);
}

export function parseExtractedJson(text: string): MiniMaxExtractedShop[] {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced ?? trimmed).trim();
  const start = candidate.indexOf('[');
  const end = candidate.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  try {
    const parsed: unknown = JSON.parse(candidate.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is MiniMaxExtractedShop =>
        Boolean(item) && typeof item === 'object',
    );
  } catch {
    return [];
  }
}

export function minimaxExtractPrompt(input: {
  cityHint: string;
  title: string;
  url: string;
  text: string;
}): string {
  return `你是廉价快餐信息抽取器。只根据原文抽取，绝不臆造。
目标城市提示：${input.cityHint}
原文标题：${input.title}
原文链接：${input.url}
正文：
${input.text}

输出 JSON 数组，每家店一条。字段：
storeName, address, city（beijing/shanghai/guangzhou/shenzhen/hangzhou 之一）, mealName, priceYuan（数字，单人餐价格）, recommended, reviewNotes, author, site, publishedAt（YYYY-MM-DD）。
规则：
- 抽不到的字段省略，不要编造店名、地址或价格。
- 只保留能吃饱的单人餐；价格不明则省略该条。
- 评价原文放 reviewNotes，供人工参考。
- 只输出 JSON 数组。`;
}

export function shopToLead(
  shop: MiniMaxExtractedShop,
  hit: SearchHit,
): WebLeadRecord | undefined {
  const city = CITIES.find(
    (item) =>
      item.public &&
      (item.id === shop.city ||
        item.label === shop.city ||
        item.full === shop.city ||
        item.aliases.includes(shop.city ?? '')),
  );
  if (!city) return undefined;
  const priceYuan = Number(shop.priceYuan);
  if (!Number.isFinite(priceYuan) || priceYuan <= 0) return undefined;
  const storeName = shop.storeName?.trim();
  const address = shop.address?.trim();
  const mealName =
    shop.mealName?.trim() || shop.recommended?.trim() || '探店餐食';
  const site = (shop.site?.trim() || hostnameOf(hit.url)).slice(0, 40);
  const author = (shop.author?.trim() || site).slice(0, 120);
  const record: WebLeadRecord = {
    storeName: storeName || `${city.full}·${mealName}（待补店名）`,
    mealName,
    priceYuan,
    address: address || `${city.full}（待补地址）`,
    city: city.id,
    placeCategory: '街边快餐',
    accessType: 'public',
    platform: 'web',
    creatorName: author,
    contentUrl: hit.url,
    contentTitle: hit.title.slice(0, 200),
    ...(shop.publishedAt && /^\d{4}-\d{2}-\d{2}$/.test(shop.publishedAt)
      ? { observedAt: shop.publishedAt }
      : {}),
    ...(shop.reviewNotes?.trim()
      ? { reviewNotes: shop.reviewNotes.trim().slice(0, 500) }
      : {}),
    collect: {
      needsStoreName: !storeName,
      needsAddress: !address,
      matchedCityAlias: city.label,
      sourceKeyword: hit.keyword,
      engine: hit.engine,
    },
  };
  const parsed = creatorImportRecordSchema.safeParse(record);
  if (!parsed.success) return undefined;
  return record;
}

/**
 * Read the assistant text out of either MiniMax response shape:
 *  - OpenAI-compatible: `choices[0].message.content`
 *  - MiniMax native v2: `choices[0].messages[0].content` / `reply` / `data.reply`
 * `reasoning_content` is deliberately ignored (we only want the answer).
 */
export function extractMiniMaxText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const root = payload as Record<string, unknown>;
  const choices = root.choices;
  if (Array.isArray(choices) && choices.length) {
    const choice = choices[0] as Record<string, unknown>;
    const message = choice.message as Record<string, unknown> | undefined;
    if (message && typeof message.content === 'string') return message.content;
    const messages = choice.messages;
    if (Array.isArray(messages) && messages.length) {
      const first = messages[0] as Record<string, unknown>;
      if (typeof first.content === 'string') return first.content;
      if (typeof first.text === 'string') return first.text;
    }
    if (typeof choice.text === 'string') return choice.text;
  }
  if (typeof root.reply === 'string') return root.reply;
  const data = root.data as Record<string, unknown> | undefined;
  if (data && typeof data.reply === 'string') return data.reply;
  return '';
}

function miniMaxErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const baseResp = (payload as { base_resp?: { status_code?: number; status_msg?: string } })
    .base_resp;
  if (baseResp && typeof baseResp.status_code === 'number' && baseResp.status_code !== 0)
    return `MINIMAX_CODE_${baseResp.status_code}:${baseResp.status_msg ?? ''}`;
  const error = (payload as { error?: { message?: string } }).error;
  if (error?.message) return `MINIMAX_ERROR:${error.message}`;
  return undefined;
}

export async function callMiniMax(
  prompt: string,
  options: {
    apiKey: string;
    baseUrl?: string;
    model?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<string> {
  const doFetch = options.fetchImpl ?? fetch;
  const base = (options.baseUrl ?? 'https://api.minimaxi.com/v1').replace(
    /\/$/,
    '',
  );
  const response = await doFetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? 'MiniMax-M2',
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`MINIMAX_HTTP_${response.status}`);
  const payload: unknown = await response.json();
  const apiError = miniMaxErrorMessage(payload);
  if (apiError) throw new Error(apiError);
  return extractMiniMaxText(payload);
}

export interface WebCollectOptions {
  keywords?: string[];
  engine?: 'bing' | 'baidu';
  maxHits?: number;
  delayMs?: number;
  fetchImpl?: typeof fetch;
  extract?: (prompt: string) => Promise<string>;
  sleep?: (ms: number) => Promise<void>;
  userAgent?: string;
  now?: () => Date;
}

export interface WebCollectResult {
  generatedAt: string;
  records: WebLeadRecord[];
  skipped: Array<{ url?: string; title?: string; reason: string }>;
  stats: {
    keywords: number;
    fetched: number;
    records: number;
    skipped: number;
  };
}

function cityHintFromKeyword(keyword: string): string {
  return (
    PUBLIC_CITIES.find((city) => keyword.includes(city.label))?.label ??
    '未知城市'
  );
}

export async function collectWebLeads(
  options: WebCollectOptions = {},
): Promise<WebCollectResult> {
  const keywords = options.keywords?.length
    ? options.keywords
    : defaultKeywords(2);
  const engine = options.engine ?? 'bing';
  const maxHits = options.maxHits ?? 8;
  const delayMs = options.delayMs ?? 1500;
  const doFetch = options.fetchImpl ?? fetch;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const records: WebLeadRecord[] = [];
  const skipped: WebCollectResult['skipped'] = [];
  const seen = new Set<string>();
  let fetched = 0;

  for (const keyword of keywords) {
    const searchUrl =
      engine === 'baidu'
        ? `https://www.baidu.com/s?wd=${encodeURIComponent(keyword)}`
        : `https://cn.bing.com/search?q=${encodeURIComponent(keyword)}&count=20`;
    let html = '';
    try {
      const response = await doFetch(searchUrl, {
        headers: { 'user-agent': options.userAgent ?? DEFAULT_USER_AGENT },
      });
      if (!response.ok) throw new Error(`SEARCH_HTTP_${response.status}`);
      html = await response.text();
    } catch (error) {
      skipped.push({
        title: keyword,
        reason: error instanceof Error ? error.message : 'search_failed',
      });
      continue;
    }
    const hits = (engine === 'baidu' ? parseBaiduHtml(html) : parseBingHtml(html))
      .filter((hit) => !isBlockedHost(hit.url))
      .slice(0, maxHits);
    for (const raw of hits) {
      const url = canonicalUrl(raw.url);
      if (seen.has(url)) {
        skipped.push({ url, title: raw.title, reason: 'duplicate' });
        continue;
      }
      seen.add(url);
      fetched += 1;
      let body = raw.snippet;
      try {
        const page = await doFetch(url, {
          headers: { 'user-agent': options.userAgent ?? DEFAULT_USER_AGENT },
        });
        if (page.ok) body = extractArticleText(await page.text()) || raw.snippet;
      } catch {
        // Fall back to the search snippet.
      }
      if (!options.extract) {
        skipped.push({ url, title: raw.title, reason: 'no_extractor' });
        continue;
      }
      let extracted: MiniMaxExtractedShop[] = [];
      try {
        const content = await options.extract(
          minimaxExtractPrompt({
            cityHint: cityHintFromKeyword(keyword),
            title: raw.title,
            url,
            text: body,
          }),
        );
        extracted = parseExtractedJson(content);
      } catch (error) {
        skipped.push({
          url,
          title: raw.title,
          reason: error instanceof Error ? error.message : 'extract_failed',
        });
        continue;
      }
      const hit: SearchHit = {
        url,
        title: raw.title,
        snippet: raw.snippet,
        engine,
        keyword,
      };
      let kept = 0;
      for (const shop of extracted) {
        const record = shopToLead(shop, hit);
        if (!record) continue;
        records.push(record);
        kept += 1;
      }
      if (!kept)
        skipped.push({ url, title: raw.title, reason: 'no_shop_extracted' });
      if (delayMs) await sleep(delayMs);
    }
    if (delayMs) await sleep(delayMs);
  }

  const shops = new Map<string, WebLeadRecord[]>();
  for (const record of records) {
    const key = `${record.city}::${record.storeName}`;
    const group = shops.get(key) ?? [];
    group.push(record);
    shops.set(key, group);
  }
  const gated = records.filter((record) => {
    const group = shops.get(`${record.city}::${record.storeName}`) ?? [];
    return group.some((item) => item.priceYuan <= BUDGET_PRICE_YUAN);
  });
  for (const record of records) {
    if (gated.includes(record)) continue;
    skipped.push({
      url: record.contentUrl,
      title: record.storeName,
      reason: 'no_budget_meal',
    });
  }

  return {
    generatedAt: (options.now ?? (() => new Date()))().toISOString(),
    records: gated,
    skipped,
    stats: {
      keywords: keywords.length,
      fetched,
      records: gated.length,
      skipped: skipped.length,
    },
  };
}

function loadLocalEnv(file = '.env.local'): void {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

export async function runWebCollectCli(
  argv = process.argv.slice(2),
): Promise<void> {
  loadLocalEnv();
  let engine: 'bing' | 'baidu' = 'bing';
  let out = 'outputs/web-collect.json';
  let maxHits = 5;
  let delayMs = 1500;
  const keywords: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[(index += 1)] ?? '';
    if (arg === '--engine') engine = next() === 'baidu' ? 'baidu' : 'bing';
    else if (arg === '--out') out = next();
    else if (arg === '--hits') maxHits = Number(next()) || maxHits;
    else if (arg === '--delay-ms') delayMs = Number(next()) || delayMs;
    else if (arg === '--keywords')
      keywords.push(
        ...next()
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      );
    else if (arg === '--help' || arg === '-h') {
      console.log(`网页文章采集（搜索引擎 + MiniMax 抽取）

用法：
  npm run collect:web -- [选项]

选项：
  --engine bing|baidu     搜索引擎（默认 bing）
  --keywords "词1,词2"    覆盖默认小批量词表
  --hits N                每个关键词取前 N 条（默认 5）
  --delay-ms N            请求间隔（默认 1500）
  --out FILE              输出（默认 outputs/web-collect.json）

需要 MINIMAX_API_KEY；可选 MINIMAX_BASE_URL / MINIMAX_MODEL。`);
      return;
    }
  }
  const apiKey = process.env.MINIMAX_API_KEY ?? '';
  if (!apiKey) throw new Error('MINIMAX_API_KEY_MISSING');
  const result = await collectWebLeads({
    keywords: keywords.length ? keywords : defaultKeywords(2),
    engine,
    maxHits,
    delayMs,
    extract: (prompt) =>
      callMiniMax(prompt, {
        apiKey,
        baseUrl: process.env.MINIMAX_BASE_URL,
        model: process.env.MINIMAX_MODEL,
      }),
  });
  const outPath = path.resolve(process.cwd(), out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        out: path.relative(process.cwd(), outPath),
        fetched: result.stats.fetched,
        records: result.records.length,
        skipped: result.stats.skipped,
      },
      null,
      2,
    ),
  );
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  runWebCollectCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
