import { describe, expect, it } from 'vitest';
import {
  defaultKeywords,
  extractArticleText,
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

  it('抽取结果对齐导入 schema，评价不进入公开字段', () => {
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
    expect(
      creatorImportRecordSchema.parse(record),
    ).not.toHaveProperty('reviewNotes');
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
