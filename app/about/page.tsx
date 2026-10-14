import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main className="about-shell public-shell public-page">
        <Link href="/" className="back-link">← 回到地图</Link>
        <div className="about-hero public-page-heading">
          <p className="kicker">规则</p>
          <h1>收录与核验规则</h1>
        </div>
        <div className="about-columns">
          <section>
            <h2>收录标准</h2>
            <ol className="rule-list">
              <li><strong>单人能买</strong><span>不要求拼单，不把多人套餐拆成“人均价”。</span></li>
              <li><strong>店里有一份 ≤ ¥15</strong><span>店内至少一份 15 元以内的单人餐食即可收录，其余餐食如实标价。优惠券、首单价和限时补贴不算。</span></li>
              <li><strong>具体到一道菜</strong><span>写清菜名和这一份的价格，不写“人均消费”。</span></li>
              <li><strong>180 天内核验</strong><span>超过 180 天的价格会从地图隐去，直到有人重新确认。</span></li>
            </ol>
          </section>
          <section>
            <h2>可信度怎么看</h2>
            <div className="trust-explain">
              <div><span className="trust-badge">✓ 高可信</span><p>现场菜单、价签或当次消费小票。</p></div>
              <div><span className="trust-badge trust-mid">✓ 中高可信</span><p>商户官方菜单或两名独立用户确认。</p></div>
              <div><span className="trust-badge trust-low">✓ 需留意日期</span><p>价格仍有效，但请优先看核验日期。</p></div>
            </div>
          </section>
        </div>
        <div className="about-footnote public-note">
          <span>数据声明</span>
          <p>外部社区内容只作为发现线索，不会被复制到公开页面。地图上的每一条价格，都是平台自己的结构化记录。</p>
          <Link href="/submit" className="secondary-button">补充一条饭签 ↗</Link>
        </div>
      </main>
    </>
  );
}
