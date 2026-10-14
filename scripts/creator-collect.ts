import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUDGET_PRICE_YUAN, CITIES, type CityDefinition } from '../lib/cities';
import { loadLocalEnv } from './load-env';

/**
 * Creator content collector (PLAN-CREATOR-DATA.md §6 layer A).
 *
 * Fetches public Bilibili search results (and optional YouTube channel RSS),
 * then normalises them into records shaped like `creatorImportRecordSchema`
 * (`lib/server/creator-import.ts`) so they can be pasted into
 * `/admin/creator-import` for preview and human-confirmed import.
 *
 * Everything here is best-effort *discovery*: prices come from titles and are
 * never verified; store names / addresses are frequently missing and are
 * flagged in `collect.*` rather than invented. The collector never writes to
 * the database, never needs a paid key, and never logs credentials.
 */

export type CollectPlatform = 'bilibili' | 'youtube';

export { BUDGET_PRICE_YUAN };

export type PearlRiverCity = Pick<
  CityDefinition,
  'id' | 'label' | 'full' | 'aliases'
>;

export const PEARL_RIVER_CITIES: PearlRiverCity[] = CITIES.map((city) => ({
  id: city.id,
  label: city.label,
  full: city.full,
  aliases: city.aliases,
}));

export const DEFAULT_KEYWORDS: string[] = [
  '北京 15元快餐',
  '上海 10元吃饱',
  '广州 平价快餐',
  '深圳 穷鬼套餐',
  '杭州 大学城 便宜',
  '北京 工地餐',
  '上海 盒饭 便宜',
  '广州 学生党 便宜 吃饭',
  '深圳 城中村 快餐',
  '杭州 平价食堂',
];

const BILIBILI_SEARCH_ENDPOINT =
  'https://api.bilibili.com/x/web-interface/search/type';
const YOUTUBE_FEED_ENDPOINT =
  'https://www.youtube.com/feeds/videos.xml?channel_id=';
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

/** A video as returned by a platform adapter, before normalisation. */
export interface RawCreatorVideo {
  platform: CollectPlatform;
  creatorName: string;
  contentUrl: string;
  contentTitle: string;
  description?: string;
  publishedAt?: string;
  sourceKeyword?: string;
}

export interface CreatorCollectFlags {
  needsStoreName: boolean;
  needsAddress: boolean;
  matchedCityAlias: string;
  sourceKeyword?: string;
}

/** A normalised record; extra `collect` metadata is ignored by the import schema. */
export interface CreatorLeadRecord {
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
  collect: CreatorCollectFlags;
}

export interface CollectSkip {
  platform: CollectPlatform | 'unknown';
  contentUrl?: string;
  title?: string;
  reason: string;
}

export interface LeadConversion {
  record?: CreatorLeadRecord;
  reason?: string;
}

export interface CollectFetchOptions {
  fetchImpl?: typeof fetch;
  userAgent?: string;
  cookie?: string;
}

/* ------------------------------------------------------------------ text -- */

export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const PRICE_PATTERNS: RegExp[] = [
  /(\d+(?:\.\d+)?)\s*(?:元|块钱|块|蚊)/g,
  /人均\s*(\d+(?:\.\d+)?)/g,
  /(\d+(?:\.\d+)?)\s*元?\s*一位/g,
  /[¥￥]\s*(\d+(?:\.\d+)?)/g,
];

export function extractPrices(text: string): number[] {
  const prices: number[] = [];
  for (const pattern of PRICE_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) prices.push(value);
    }
  }
  return prices;
}

export function pickBudgetPrice(text: string): number | undefined {
  const candidates = extractPrices(text).filter(
    (value) => value > 0 && value <= BUDGET_PRICE_YUAN,
  );
  return candidates.length ? Math.min(...candidates) : undefined;
}

// "中山路"/"中山八"/"中山大学" are Guangzhou landmarks, not Zhongshan city.
const ALIAS_BLOCKLIST_AFTER: Record<string, string[]> = {
  中山: ['路', '大道', '八', '纪念', '大学', '医'],
};

function aliasIndex(text: string, alias: string): number {
  let from = 0;
  for (;;) {
    const index = text.indexOf(alias, from);
    if (index < 0) return -1;
    const after = text.slice(index + alias.length, index + alias.length + 2);
    const blocked = (ALIAS_BLOCKLIST_AFTER[alias] ?? []).some((token) =>
      after.startsWith(token),
    );
    if (!blocked) return index;
    from = index + alias.length;
  }
}

function detectCityInText(text: string): PearlRiverCity | undefined {
  let best: { city: PearlRiverCity; index: number } | undefined;
  for (const city of PEARL_RIVER_CITIES) {
    for (const alias of city.aliases) {
      const index = aliasIndex(text, alias);
      if (index < 0) continue;
      if (!best || index < best.index) best = { city, index };
    }
  }
  return best?.city;
}

/** Detect the first explicitly mentioned Pearl-River city, in priority order. */
export function detectCity(...texts: Array<string | undefined>): PearlRiverCity | undefined {
  for (const text of texts) {
    if (!text) continue;
    const city = detectCityInText(text);
    if (city) return city;
  }
  return undefined;
}

const MEAL_KEYWORDS = [
  '自助餐',
  '自助',
  '快餐',
  '早茶',
  '肠粉',
  '盒饭',
  '牛杂',
  '烧鹅饭',
  '烧鹅',
  '煲仔饭',
  '砂锅粥',
  '茶餐厅',
  '点心',
  '糖水',
  '早餐',
  '早点',
  '夜宵',
  '宵夜',
  '云吞',
  '水饺',
  '卤味',
  '烧腊',
  '小炒',
  '火锅',
  '面',
  '粉',
];

export function deriveMealName(title: string): string {
  let best: { keyword: string; index: number } | undefined;
  for (const keyword of MEAL_KEYWORDS) {
    const index = title.indexOf(keyword);
    if (index < 0) continue;
    if (!best || index < best.index) best = { keyword, index };
  }
  return best?.keyword ?? '探店餐食';
}

const GENERIC_STORE_WORDS = new Set([
  '自助餐',
  '自助',
  '快餐',
  '早茶',
  '盒饭',
  '茶餐厅',
  '餐厅',
  '食堂',
  '饭店',
  '大排档',
  '快餐店',
  '小吃',
  '美食',
]);

// Modifiers that describe a meal/price rather than a shop name. A candidate
// that becomes empty once these (and city names) are removed is not a store.
const GENERIC_STORE_TOKENS = [
  '平价',
  '便宜',
  '最便宜',
  '超便宜',
  '实惠',
  '宝藏',
  '合集',
  '攻略',
  '推荐',
  '盘点',
  '测评',
  '试吃',
  '探店',
  '人气',
  '网红',
  '天花板',
  '实在',
  '良心',
  '好吃',
  '美食',
  '小吃',
  '快餐',
  '自助',
  '盒饭',
  '食堂',
  '早茶',
  '点心',
  '餐',
  '菜',
  '饭',
];

const CITY_STRIP_TOKENS = [
  '广东',
  ...PEARL_RIVER_CITIES.flatMap((city) => [city.label, city.full]),
];

const BRACKET_STORE_PATTERNS: RegExp[] = [
  /《([^》]{2,20})》/,
  /【([^】]{2,20})】/,
  /「([^」]{2,20})」/,
  /“([^”]{2,20})”/,
  /〈([^〉]{2,20})〉/,
];

const STORE_SUFFIX_PATTERN =
  /([\u4e00-\u9fa5A-Za-z0-9]{2,10}(?:餐厅|茶餐厅|快餐店|自助餐|食堂|小馆|饭店|大排档|牛杂店|烧腊店|烧鹅店|粉面店|面店|粉店|酒楼|酒家|茶楼|糖水店|肠粉店))/;

function looksLikeStoreName(candidate: string, creatorName?: string): boolean {
  const name = candidate.trim();
  if (name.length < 2 || name.length > 20) return false;
  if (GENERIC_STORE_WORDS.has(name)) return false;
  if (/\d/.test(name)) return false;
  if (/[！!？?，,。.、；;：:（）()【】「」《》]/.test(name)) return false;
  if (/[元块蚊]/.test(name)) return false;
  if (
    creatorName &&
    (creatorName.includes(name) || name.includes(creatorName))
  )
    return false;
  let stripped = name;
  for (const token of [...CITY_STRIP_TOKENS, ...GENERIC_STORE_TOKENS]) {
    stripped = stripped.split(token).join('');
  }
  stripped = stripped.replace(/[的了在有个和与及之最·\-—–~]/g, '');
  if (stripped.length < 2) return false;
  return /[店记楼馆居轩吃食面粉饭菜茶餐牛鸡鸭鹅鱼烧肉粥酒家]/.test(stripped);
}

export function extractStoreName(
  title: string,
  creatorName?: string,
): string | undefined {
  const accept = (candidate: string) =>
    looksLikeStoreName(candidate, creatorName);
  for (const pattern of BRACKET_STORE_PATTERNS) {
    const match = title.match(pattern);
    if (match && accept(match[1])) return match[1].trim();
  }
  const suffix = title.match(STORE_SUFFIX_PATTERN);
  if (suffix) {
    const segment = suffix[1].split(/[丨|｜]/).pop() ?? suffix[1];
    if (accept(segment)) return segment.trim();
  }
  return undefined;
}

const ADDRESS_PATTERN =
  /([\u4e00-\u9fa5]{2,10}(?:市|区|镇|街道)[\u4e00-\u9fa5A-Za-z0-9]{0,20}(?:路|街|巷|道|号|村|大厦|广场|市场|工业区|科技园|花园|新村|苑)[^\s，,。；;！!]{0,10})/;

export function extractAddress(text: string): string | undefined {
  const match = text.match(ADDRESS_PATTERN);
  if (!match) return undefined;
  const value = match[1].trim();
  if (/[！!？?]/.test(value) || value.includes('的')) return undefined;
  return value;
}

// Bus/metro POV, cooking-cost challenges and travel vlogs contain prices but
// are not store探店 content; reject them before any name/address extraction.
const NON_FOOD_TITLE_PATTERN =
  /(?:POV|第一视角|视角展望|公交|地铁|线路|展望|旅游|攻略|做饭|做菜|买菜|成本挑战|吃一周|教程|开箱|试用|vlog)/i;

/* --------------------------------------------------------------- adapters -- */

export interface BilibiliSearchOptions extends CollectFetchOptions {
  page?: number;
}

interface BilibiliSearchItem {
  bvid?: unknown;
  title?: unknown;
  author?: unknown;
  pubdate?: unknown;
  description?: unknown;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isoDateFromEpoch(value: unknown): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return new Date(value * 1000).toISOString().slice(0, 10);
}

export function parseBilibiliSearch(payload: unknown): RawCreatorVideo[] {
  const result =
    payload &&
    typeof payload === 'object' &&
    (payload as { data?: unknown }).data &&
    typeof (payload as { data?: { result?: unknown } }).data === 'object'
      ? (payload as { data: { result?: unknown } }).data.result
      : undefined;
  if (!Array.isArray(result)) return [];
  return result.flatMap((raw): RawCreatorVideo[] => {
    const item = raw as BilibiliSearchItem;
    const bvid = asString(item.bvid);
    const title = stripHtml(asString(item.title));
    if (!bvid || !title) return [];
    const contentUrl = `https://www.bilibili.com/video/${bvid}/`;
    return [
      {
        platform: 'bilibili',
        creatorName: asString(item.author) || '未知创作者',
        contentUrl,
        contentTitle: title,
        description: stripHtml(asString(item.description)) || undefined,
        publishedAt: isoDateFromEpoch(item.pubdate),
      },
    ];
  });
}

export async function searchBilibiliVideos(
  keyword: string,
  options: BilibiliSearchOptions = {},
): Promise<RawCreatorVideo[]> {
  const doFetch = options.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    search_type: 'video',
    keyword,
    page: String(options.page ?? 1),
  });
  const headers: Record<string, string> = {
    accept: 'application/json',
    'user-agent': options.userAgent ?? DEFAULT_USER_AGENT,
    referer: 'https://www.bilibili.com/',
  };
  if (options.cookie) headers.cookie = options.cookie;
  const response = await doFetch(
    `${BILIBILI_SEARCH_ENDPOINT}?${params.toString()}`,
    { headers },
  );
  if (!response.ok) throw new Error(`BILIBILI_HTTP_${response.status}`);
  const payload: unknown = await response.json();
  const code =
    payload && typeof payload === 'object'
      ? (payload as { code?: unknown }).code
      : undefined;
  if (code !== undefined && code !== 0) throw new Error(`BILIBILI_CODE_${code}`);
  return parseBilibiliSearch(payload).map((video) => ({
    ...video,
    sourceKeyword: keyword,
  }));
}

export function parseYoutubeFeed(xml: string): RawCreatorVideo[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  return entries.flatMap((entry): RawCreatorVideo[] => {
    const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]?.trim();
    const title = stripHtml(entry.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
    if (!videoId || !title) return [];
    const creatorName = stripHtml(
      entry.match(/<name>([^<]*)<\/name>/)?.[1] ?? '未知创作者',
    );
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
    const description = stripHtml(
      entry.match(/<media:description>([^<]*)<\/media:description>/)?.[1] ?? '',
    );
    return [
      {
        platform: 'youtube',
        creatorName: creatorName || '未知创作者',
        contentUrl: `https://www.youtube.com/watch?v=${videoId}`,
        contentTitle: title,
        description: description || undefined,
        publishedAt: published ? published.slice(0, 10) : undefined,
      },
    ];
  });
}

export async function fetchYoutubeChannelVideos(
  channelId: string,
  options: CollectFetchOptions = {},
): Promise<RawCreatorVideo[]> {
  const doFetch = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    'user-agent': options.userAgent ?? DEFAULT_USER_AGENT,
  };
  if (options.cookie) headers.cookie = options.cookie;
  const response = await doFetch(
    `${YOUTUBE_FEED_ENDPOINT}${encodeURIComponent(channelId)}`,
    { headers },
  );
  if (!response.ok) throw new Error(`YOUTUBE_HTTP_${response.status}`);
  return parseYoutubeFeed(await response.text());
}

/* ------------------------------------------------------------ normalise -- */

export function videoToLead(video: RawCreatorVideo): LeadConversion {
  if (NON_FOOD_TITLE_PATTERN.test(video.contentTitle)) {
    return { reason: 'not_food_content' };
  }
  const haystack = [video.contentTitle, video.description]
    .filter(Boolean)
    .join(' ');
  const priceYuan = pickBudgetPrice(haystack);
  if (priceYuan === undefined) return { reason: 'no_budget_price' };
  const city =
    detectCity(video.contentTitle, video.description) ??
    detectCity(video.sourceKeyword);
  if (!city) return { reason: 'city_unknown' };
  const mealName = deriveMealName(video.contentTitle);
  const extractedStore = extractStoreName(video.contentTitle, video.creatorName);
  const extractedAddress = extractAddress(haystack);
  const needsStoreName = !extractedStore;
  const needsAddress = !extractedAddress;
  return {
    record: {
      storeName: extractedStore ?? `${city.full}·${mealName}（待补店名）`,
      mealName,
      priceYuan,
      address: extractedAddress ?? `${city.full}（待补地址）`,
      city: city.id,
      placeCategory: '街边快餐',
      accessType: 'public',
      platform: video.platform,
      creatorName: video.creatorName,
      contentUrl: video.contentUrl,
      contentTitle: video.contentTitle,
      ...(video.publishedAt ? { observedAt: video.publishedAt } : {}),
      collect: {
        needsStoreName,
        needsAddress,
        matchedCityAlias: city.label,
        ...(video.sourceKeyword ? { sourceKeyword: video.sourceKeyword } : {}),
      },
    },
  };
}

/* ---------------------------------------------------------------- runner -- */

export interface CollectRunOptions {
  keywords?: string[];
  youtubeChannelIds?: string[];
  maxPages?: number;
  strict?: boolean;
  delayMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  cookie?: string;
  userAgent?: string;
  now?: () => Date;
}

export interface CollectRunResult {
  generatedAt: string;
  records: CreatorLeadRecord[];
  skipped: CollectSkip[];
  stats: {
    keywords: number;
    youtubeChannels: number;
    requests: number;
    fetched: number;
    records: number;
    skipped: number;
  };
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RATE_LIMIT_ATTEMPTS = 3;

function isRateLimited(error: unknown): boolean {
  return error instanceof Error && error.message.includes('412');
}

/** Retry the anonymous-request `-412` rate limit with linear backoff. */
async function fetchWithRetry<T>(
  run: () => Promise<T>,
  sleep: (ms: number) => Promise<void>,
  backoffMs: number,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RATE_LIMIT_ATTEMPTS; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isRateLimited(error) || attempt === RATE_LIMIT_ATTEMPTS) throw error;
      await sleep(Math.max(backoffMs, 3000) * attempt);
    }
  }
  throw lastError;
}

function canonicalUrl(url: string): string {
  return url.replace(/\?.*$/, '').replace(/\/+$/, '');
}

export async function collectCreatorLeads(
  options: CollectRunOptions = {},
): Promise<CollectRunResult> {
  const keywords = options.keywords?.length ? options.keywords : DEFAULT_KEYWORDS;
  const youtubeChannelIds = options.youtubeChannelIds ?? [];
  const maxPages = Math.max(1, Math.min(options.maxPages ?? 1, 5));
  const delayMs = options.delayMs ?? 0;
  const sleep = options.sleep ?? defaultSleep;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const seen = new Set<string>();
  const records: CreatorLeadRecord[] = [];
  const skipped: CollectSkip[] = [];
  let requests = 0;
  let fetched = 0;

  const accept = (video: RawCreatorVideo) => {
    fetched += 1;
    const key = canonicalUrl(video.contentUrl);
    if (seen.has(key)) {
      skipped.push({
        platform: video.platform,
        contentUrl: video.contentUrl,
        title: video.contentTitle,
        reason: 'duplicate',
      });
      return;
    }
    seen.add(key);
    const conversion = videoToLead(video);
    if (!conversion.record) {
      skipped.push({
        platform: video.platform,
        contentUrl: video.contentUrl,
        title: video.contentTitle,
        reason: conversion.reason ?? 'invalid',
      });
      return;
    }
    if (
      options.strict &&
      (conversion.record.collect.needsStoreName ||
        conversion.record.collect.needsAddress)
    ) {
      skipped.push({
        platform: video.platform,
        contentUrl: video.contentUrl,
        title: video.contentTitle,
        reason: 'incomplete_strict',
      });
      return;
    }
    records.push(conversion.record);
  };

  for (const keyword of keywords) {
    for (let page = 1; page <= maxPages; page += 1) {
      try {
        requests += 1;
        const videos = await fetchWithRetry(
          () =>
            searchBilibiliVideos(keyword, {
              page,
              fetchImpl,
              cookie: options.cookie,
              userAgent: options.userAgent,
            }),
          sleep,
          delayMs,
        );
        if (!videos.length) break;
        videos.forEach(accept);
      } catch (error) {
        skipped.push({
          platform: 'bilibili',
          reason: `request_failed:${error instanceof Error ? error.message : 'unknown'}`,
        });
        break;
      }
      if (delayMs > 0) await sleep(delayMs);
    }
  }

  for (const channelId of youtubeChannelIds) {
    try {
      requests += 1;
      const videos = await fetchWithRetry(
        () =>
          fetchYoutubeChannelVideos(channelId, {
            fetchImpl,
            userAgent: options.userAgent,
          }),
        sleep,
        delayMs,
      );
      videos.forEach(accept);
    } catch (error) {
      skipped.push({
        platform: 'youtube',
        reason: `request_failed:${error instanceof Error ? error.message : 'unknown'}`,
      });
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  records.sort(
    (a, b) =>
      a.priceYuan - b.priceYuan ||
      a.city.localeCompare(b.city) ||
      a.contentUrl.localeCompare(b.contentUrl),
  );

  return {
    generatedAt: now().toISOString(),
    records,
    skipped,
    stats: {
      keywords: keywords.length,
      youtubeChannels: youtubeChannelIds.length,
      requests,
      fetched,
      records: records.length,
      skipped: skipped.length,
    },
  };
}

export function mergeCollectRecords(
  existing: CreatorLeadRecord[],
  incoming: CreatorLeadRecord[],
): CreatorLeadRecord[] {
  const seen = new Set<string>();
  const merged: CreatorLeadRecord[] = [];
  for (const record of [...existing, ...incoming]) {
    const key = canonicalUrl(record.contentUrl);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(record);
  }
  return merged;
}

/* ------------------------------------------------------------------- cli -- */

interface ParsedArgs {
  keywords: string[];
  youtubeChannelIds: string[];
  out?: string;
  maxPages?: number;
  delayMs?: number;
  strict: boolean;
  noMerge: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    keywords: [],
    youtubeChannelIds: [],
    strict: false,
    noMerge: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[(index += 1)] ?? '';
    if (arg === '--keywords') {
      parsed.keywords.push(
        ...next()
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      );
    } else if (arg === '--youtube') {
      parsed.youtubeChannelIds.push(
        ...next()
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      );
    } else if (arg === '--out') {
      parsed.out = next();
    } else if (arg === '--pages') {
      parsed.maxPages = Number(next());
    } else if (arg === '--delay-ms') {
      parsed.delayMs = Number(next());
    } else if (arg === '--strict') {
      parsed.strict = true;
    } else if (arg === '--no-merge') {
      parsed.noMerge = true;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (!arg.startsWith('--')) {
      parsed.keywords.push(arg);
    }
  }
  return parsed;
}

const HELP = `创作者内容采集（B站关键词检索 + YouTube 频道 RSS）

用法：
  npm run collect:creators -- [选项]

选项：
  --keywords "关键词1,关键词2"  B站检索词（默认内置 5 城低价餐食词表）
  --youtube  "频道ID1,频道ID2"  YouTube 频道 ID（RSS，可选）
  --pages N                    B站每个关键词抓取页数（1-5，默认 1）
  --delay-ms N                 请求间隔毫秒（默认 1500；遇 B站 -412 自动退避重试）
  --out FILE                   输出文件（默认 outputs/creator-collect.json）
  --strict                     只保留已能抽出店名与地址的记录
  --no-merge                   不合并已存在的输出文件

输出为可粘贴到 /admin/creator-import 的 JSON。价格来自标题，未核验；
storeName/address 缺失时会写成「待补」占位并在 collect.* 标记。`;

export async function runCollectCli(argv = process.argv.slice(2)): Promise<void> {
  loadLocalEnv();
  const args = parseArgs(argv);
  if (args.help) {
    console.log(HELP);
    return;
  }
  const outPath = path.resolve(
    process.cwd(),
    args.out ?? 'outputs/creator-collect.json',
  );
  const result = await collectCreatorLeads({
    keywords: args.keywords,
    youtubeChannelIds: args.youtubeChannelIds,
    maxPages: Number.isFinite(args.maxPages) ? args.maxPages : undefined,
    delayMs: Number.isFinite(args.delayMs) ? args.delayMs : 1500,
    strict: args.strict,
    cookie: process.env.BILIBILI_COOKIE,
  });

  let records = result.records;
  if (!args.noMerge && fs.existsSync(outPath)) {
    const existingRaw = JSON.parse(fs.readFileSync(outPath, 'utf8')) as {
      records?: CreatorLeadRecord[];
    };
    records = mergeCollectRecords(existingRaw.records ?? [], result.records);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        generatedAt: result.generatedAt,
        stats: { ...result.stats, records: records.length },
        skipped: result.skipped,
        records,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    JSON.stringify(
      {
        out: path.relative(process.cwd(), outPath),
        fetched: result.stats.fetched,
        records: records.length,
        skipped: result.stats.skipped,
      },
      null,
      2,
    ),
  );
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  runCollectCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
