import { describe, expect, it, vi } from 'vitest';
import {
  callMiniMax,
  defaultKeywords,
  extractArticleText,
  extractMiniMaxText,
  parseBingHtml,
  parseExtractedJson,
  shopToLead,
  type SearchHit,
} from '@/scripts/web-collect';
import { creatorImportRecordSchema } from '@/lib/server/creator-import';

const hit: SearchHit = {
  url: 'https://example.com/beijing-15yuan',
  title: '北京 15 元快餐盘点',
  snippet: '海淀某店卤肉饭 12 元',
  engine: 'bing',
  keyword: '北京 15元快餐',
};

describe('网页采集抽取', () => {
  it('默认小批量词表覆盖 5 城 × 2 词', () => {
    const keywords = defaultKeywords(2);
    expect(keywords).toHaveLength(10);
    expect(keywords.some((item) => item.startsWith('北京 '))).toBe(true);
    expect(keywords.some((item) => item.startsWith('杭州 '))).toBe(true);
  });

  it('解析 Bing 结果块', () => {
    const html = `
      <ol id="b_results">
        <li class="b_algo">
          <h2><a href="https://example.com/a">北京穷鬼套餐</a></h2>
          <p class="b_lineclamp2">海淀 12 元盒饭</p>
        </li>
      </ol>`;
    expect(parseBingHtml(html)).toEqual([
      {
        url: 'https://example.com/a',
        title: '北京穷鬼套餐',
        snippet: '海淀 12 元盒饭',
      },
    ]);
  });

  it('从 HTML 抽正文并解析模型 JSON', () => {
    expect(
      extractArticleText(
        '<html><script>1</script><article><p>店名：桥底卤肉饭</p></article></html>',
      ),
    ).toContain('桥底卤肉饭');
    expect(
      parseExtractedJson('```json\n[{"storeName":"桥底卤肉饭","priceYuan":12}]\n```'),
    ).toEqual([{ storeName: '桥底卤肉饭', priceYuan: 12 }]);
  });

  it('抽取结果对齐导入 schema，评价随记录带入人工复核', () => {
    const record = shopToLead(
      {
        storeName: '桥底卤肉饭',
        address: '北京市海淀区某路 1 号',
        city: 'beijing',
        mealName: '卤肉饭',
        priceYuan: 12,
        reviewNotes: '分量足，排队久',
        author: '某公众号',
      },
      hit,
    );
    expect(record?.city).toBe('beijing');
    expect(record?.reviewNotes).toBe('分量足，排队久');
    expect(creatorImportRecordSchema.safeParse(record).success).toBe(true);
    // reviewNotes is accepted by the import schema but only persisted to the
    // admin-only lead; the public DTO assertion lives in creator-import.test.ts.
    expect(creatorImportRecordSchema.parse(record).reviewNotes).toBe(
      '分量足，排队久',
    );
  });

  it('无城市或无价格的抽取结果丢弃', () => {
    expect(
      shopToLead({ storeName: '某店', priceYuan: 12, city: 'xiamen' }, hit),
    ).toBeUndefined();
    expect(
      shopToLead({ storeName: '某店', city: 'beijing' }, hit),
    ).toBeUndefined();
  });
});

describe('MiniMax 适配器', () => {
  it('兼容 OpenAI 与 MiniMax 原生两种返回格式', () => {
    expect(
      extractMiniMaxText({ choices: [{ message: { content: '[{"a":1}]' } }] }),
    ).toBe('[{"a":1}]');
    expect(
      extractMiniMaxText({ choices: [{ messages: [{ content: '[{"b":2}]' }] }] }),
    ).toBe('[{"b":2}]');
    expect(extractMiniMaxText({ reply: '[{"c":3}]' })).toBe('[{"c":3}]');
    expect(extractMiniMaxText({ data: { reply: '[{"d":4}]' } })).toBe('[{"d":4}]');
    expect(extractMiniMaxText({ choices: [{ message: { reasoning_content: 'x' } }] })).toBe('');
  });

  it('http 或 base_resp 错误会抛出', async () => {
    const ok = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ base_resp: { status_code: 1004, status_msg: 'auth failed' } }),
    })) as unknown as typeof fetch;
    await expect(
      callMiniMax('hi', { apiKey: 'k', fetchImpl: ok }),
    ).rejects.toThrow(/MINIMAX_CODE_1004/);

    const http = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    await expect(
      callMiniMax('hi', { apiKey: 'k', fetchImpl: http }),
    ).rejects.toThrow(/MINIMAX_HTTP_401/);
  });

  it('按 base_url/model 组装请求并回传文本', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fake = vi.fn(async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      };
    }) as unknown as typeof fetch;
    const text = await callMiniMax('prompt', {
      apiKey: 'secret',
      baseUrl: 'https://example.test/v1/',
      model: 'MiniMax-Test',
      fetchImpl: fake,
    });
    expect(text).toBe('ok');
    expect(calls[0].url).toBe('https://example.test/v1/chat/completions');
    expect((calls[0].body as { model: string }).model).toBe('MiniMax-Test');
  });
});
