import { describe, expect, it, vi } from 'vitest';
import {
  collectCreatorLeads,
  detectCity,
  deriveMealName,
  extractAddress,
  extractPrices,
  extractStoreName,
  mergeCollectRecords,
  parseBilibiliSearch,
  parseYoutubeFeed,
  pickBudgetPrice,
  searchBilibiliVideos,
  videoToLead,
  type CreatorLeadRecord,
  type RawCreatorVideo,
} from '@/scripts/creator-collect';
import { creatorImportRecordSchema } from '@/lib/server/creator-import';

function biliPayload(item: Record<string, unknown>) {
  return { code: 0, data: { result: [item] } };
}

function jsonResponse(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload } as Response;
}

function textResponse(text: string) {
  return { ok: true, status: 200, text: async () => text } as Response;
}

const sampleVideo: RawCreatorVideo = {
  platform: 'bilibili',
  creatorName: '赤赤吃啥呢',
  contentUrl: 'https://www.bilibili.com/video/BV1dxdxYjEa4/',
  contentTitle: '深圳市中心2元肠粉，这价格全国求挑战',
};

describe('标题文本抽取', () => {
  it('抽取金额并只保留 ≤15 元的最低值', () => {
    expect(extractPrices('广州6元自助餐，人均15吃到撑')).toEqual([6, 15]);
    expect(pickBudgetPrice('广州6元自助餐，人均15吃到撑')).toBe(6);
    expect(pickBudgetPrice('128元豪华自助')).toBeUndefined();
    expect(pickBudgetPrice('肇庆0元旅游攻略')).toBeUndefined();
  });

  it('识别公开城市并排除歧义地名', () => {
    expect(detectCity('广州6元自助餐')?.id).toBe('guangzhou');
    expect(detectCity('北京10元盒饭')?.id).toBe('beijing');
    expect(detectCity('杭州大学城便宜快餐')?.id).toBe('hangzhou');
    expect(detectCity('中山最大城中村，快餐10元')?.id).toBe('zhongshan');
    expect(detectCity('广州中山八路附近快餐')?.id).toBe('guangzhou');
    expect(detectCity('厦门3元面线糊')).toBeUndefined();
  });

  it('从标题推导菜品名', () => {
    expect(deriveMealName('广州6元自助餐')).toBe('自助餐');
    expect(deriveMealName('深圳市中心2元肠粉')).toBe('肠粉');
    expect(deriveMealName('超值探店合集')).toBe('探店餐食');
  });

  it('保守抽取店名，拒绝通用词、含价格片段与创作者名', () => {
    expect(extractStoreName('广州 杨记任随吃自助快餐店 6元')).toBe(
      '杨记任随吃自助快餐店',
    );
    expect(extractStoreName('【桥底卤肉饭】广州海珠')).toBe('桥底卤肉饭');
    expect(extractStoreName('东莞宝藏肠粉店！6元一份超多肉')).toBe(
      '东莞宝藏肠粉店',
    );
    expect(extractStoreName('广州6元自助餐')).toBeUndefined();
    expect(extractStoreName('珠海最便宜盒饭自助餐?15元烧鸭任吃')).toBeUndefined();
    expect(extractStoreName('福州仓山学生街 平价食堂！15元随便吃')).toBeUndefined();
    expect(
      extractStoreName('12款单品试吃测评【快餐踩雷者23】'),
    ).toBeUndefined();
    expect(
      extractStoreName('探店福州最便宜自助餐：10元吃到饱！'),
    ).toBeUndefined();
    expect(
      extractStoreName('老广食广州丨宏兴茶餐厅丨番禺人均20元！'),
    ).toBe('宏兴茶餐厅');
    expect(
      extractStoreName('【品城记】广州人均14元的古早味茶楼', '品城记本地版'),
    ).toBeUndefined();
  });

  it('抽取地址，否则留给人工补齐', () => {
    expect(extractAddress('深圳市南山区科技园科智西路5号')).toBe(
      '深圳市南山区科技园科智西路5号',
    );
    expect(extractAddress('深圳市中心2元肠粉')).toBeUndefined();
    expect(
      extractAddress('工业区的不冷不热的线路！东莞公交47路全程第一'),
    ).toBeUndefined();
  });
});

describe('视频归一化', () => {
  it('生成可被导入 schema 接受的记录并标记待补字段', () => {
    const { record, reason } = videoToLead(sampleVideo);
    expect(reason).toBeUndefined();
    expect(record).toBeDefined();
    expect(record?.priceYuan).toBe(2);
    expect(record?.city).toBe('shenzhen');
    expect(record?.collect.needsStoreName).toBe(true);
    expect(record?.collect.needsAddress).toBe(true);
    expect(creatorImportRecordSchema.safeParse(record).success).toBe(true);
  });

  it('超过预算或无城市线索的视频被跳过', () => {
    expect(
      videoToLead({ ...sampleVideo, contentTitle: '128元豪华自助' }).reason,
    ).toBe('no_budget_price');
    expect(
      videoToLead({ ...sampleVideo, contentTitle: '厦门3元面线糊' }).reason,
    ).toBe('city_unknown');
  });

  it('公交 POV / 挑战类非探店内容被跳过', () => {
    expect(
      videoToLead({
        ...sampleVideo,
        contentTitle: '【POV–59】东莞公交47路全程第一视角展望',
        description: '2元',
      }).reason,
    ).toBe('not_food_content');
    expect(
      videoToLead({
        ...sampleVideo,
        contentTitle: '【省钱做饭挑战】挑战10元在广州吃一周',
      }).reason,
    ).toBe('not_food_content');
  });
});

describe('平台适配器', () => {
  it('解析 B站搜索结果并清理高亮标签', () => {
    const videos = parseBilibiliSearch(
      biliPayload({
        bvid: 'BV1dxdxYjEa4',
        title: '<em class="keyword">深圳</em>市中心2元肠粉',
        author: '赤赤吃啥呢',
        pubdate: 1_700_000_000,
        description: '上沙某店',
      }),
    );
    expect(videos).toHaveLength(1);
    expect(videos[0].contentTitle).toBe('深圳市中心2元肠粉');
    expect(videos[0].contentUrl).toBe(
      'https://www.bilibili.com/video/BV1dxdxYjEa4/',
    );
    expect(videos[0].publishedAt).toBe('2023-11-14');
  });

  it('检索时携带关键词并标记来源词', async () => {
    const fetchImpl = vi.fn(async (_url: string) =>
      jsonResponse(
        biliPayload({
          bvid: 'BV1',
          title: '深圳2元肠粉',
          author: '某人',
          pubdate: 1_700_000_000,
        }),
      ),
    );
    const videos = await searchBilibiliVideos('深圳 平价快餐', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const url = String(fetchImpl.mock.calls[0][0]);
    expect(new URL(url).searchParams.get('search_type')).toBe('video');
    expect(new URL(url).searchParams.get('keyword')).toBe('深圳 平价快餐');
    expect(videos[0].sourceKeyword).toBe('深圳 平价快餐');
  });

  it('解析 YouTube 频道 RSS', () => {
    const xml = `<feed><entry>
      <yt:videoId>abc123</yt:videoId>
      <title>深圳 10元 快餐</title>
      <author><name>某频道</name></author>
      <published>2024-01-02T00:00:00+00:00</published>
    </entry></feed>`;
    const videos = parseYoutubeFeed(xml);
    expect(videos).toHaveLength(1);
    expect(videos[0].platform).toBe('youtube');
    expect(videos[0].contentUrl).toBe('https://www.youtube.com/watch?v=abc123');
    expect(videos[0].publishedAt).toBe('2024-01-02');
  });
});

describe('采集运行', () => {
  it('跨关键词去重并统计跳过原因', async () => {
    const payload = biliPayload({
      bvid: 'BVdup',
      title: '深圳2元肠粉',
      author: '某人',
      pubdate: 1_700_000_000,
    });
    const fetchImpl = vi.fn(async () => jsonResponse(payload));
    const result = await collectCreatorLeads({
      keywords: ['深圳 平价快餐', '深圳 10元快餐'],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    });
    expect(result.records).toHaveLength(1);
    expect(result.stats.fetched).toBe(2);
    expect(result.skipped.some((skip) => skip.reason === 'duplicate')).toBe(true);
  });

  it('strict 模式丢弃待补店名/地址的记录', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        biliPayload({
          bvid: 'BV1',
          title: '深圳2元肠粉',
          author: '某人',
          pubdate: 1_700_000_000,
        }),
      ),
    );
    const result = await collectCreatorLeads({
      keywords: ['深圳 平价快餐'],
      strict: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    });
    expect(result.records).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe('incomplete_strict');
  });

  it('遇到 B站 -412 自动退避重试后成功', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls < 3)
        return { ok: false, status: 412, json: async () => ({}) } as Response;
      return jsonResponse(
        biliPayload({
          bvid: 'BVretry',
          title: '深圳2元肠粉',
          author: '某人',
          pubdate: 1_700_000_000,
        }),
      );
    });
    const result = await collectCreatorLeads({
      keywords: ['深圳 平价快餐'],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    });
    expect(calls).toBe(3);
    expect(result.records).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
  });
});

describe('输出合并', () => {
  it('按内容链接去重，保留先出现的记录', () => {
    const first = videoToLead(sampleVideo).record as CreatorLeadRecord;
    const duplicate: CreatorLeadRecord = { ...first, priceYuan: 9 };
    const merged = mergeCollectRecords([first], [duplicate]);
    expect(merged).toHaveLength(1);
    expect(merged[0].priceYuan).toBe(2);
  });
});
