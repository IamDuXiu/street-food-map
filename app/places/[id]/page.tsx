import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { TrustBadge } from '@/components/trust-badge';
import { PLACES, VIEWPORTS } from '@/lib/fixtures';
import { formatPrice } from '@/lib/filter';
import { openDatabase } from '@/lib/server/db';
import { PlaceRepository } from '@/lib/server/repository';
import { toPublicPlace } from '@/lib/server/public';
import { publicPlaceIsEligible } from '@/lib/server/public';
import type { Place } from '@/lib/types';
import Image from 'next/image';
import { verificationMethodLabel } from '@/lib/presentation';
import { Notice } from '@/components/ui/Notice';

export const dynamic = 'force-dynamic';
export function generateStaticParams() {
  return PLACES.map((place) => ({ id: place.id }));
}

export default async function PlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let place:
    | (Place & {
        zoneName?: string;
        evidence?: Array<{
          id: string;
          url: string;
          width: number | null;
          height: number | null;
        }>;
      })
    | null = null;
  let fallback = false;
  try {
    const dbPlace = new PlaceRepository(openDatabase()).get(id);
    if (dbPlace && publicPlaceIsEligible(dbPlace))
      place = toPublicPlace(dbPlace);
  } catch {
    const demo = PLACES.find((item) => item.id === id);
    if (demo) {
      place = demo;
      fallback = true;
    }
  }
  if (!place) notFound();
  const cheapest = [...place.meals].sort((a, b) => a.priceFen - b.priceFen)[0];
  if (!cheapest) notFound();
  const zoneName =
    'zoneName' in place
      ? place.zoneName
      : (VIEWPORTS.find((zone) => zone.id === place.zoneId)?.label ??
        place.zoneId);
  return (
    <>
      <SiteHeader />
      <main className="detail-shell public-shell public-page">
        {fallback && (
            <Notice tone="info" className="data-notice">
              当前显示本地演示数据。
            </Notice>
        )}
        <Link href="/" className="back-link">
          ← 回到地图
        </Link>
        <div className="detail-hero public-page-heading">
          <div>
            <p className="kicker">
              {place.category} / {zoneName}
            </p>
            <h1>{place.name}</h1>
            <p className="detail-address">{place.address}</p>
          </div>
          <TrustBadge label={place.verification} />
        </div>
        <div className="detail-grid">
          <section className="detail-main">
            <div className="price-callout">
              <div>
                <span className="eyebrow">这里最便宜的一份</span>
                <strong>{formatPrice(cheapest.priceFen)}</strong>
              </div>
              <span className="price-callout-meal">
                {cheapest.name}
                <br />
                <small>{cheapest.description}</small>
              </span>
            </div>
            <div className="section-heading">
              <h2>今天能吃什么</h2>
              <span>共 {place.meals.length} 份</span>
            </div>
            <div className="meal-table">
              {place.meals.map((meal) => (
                <div className="meal-row" key={meal.id}>
                  <div>
                    <h3>{meal.name}</h3>
                    <p>{meal.description}</p>
                  </div>
                  <div className="meal-price">
                    <strong>{formatPrice(meal.priceFen)}</strong>
                    <small>{meal.category}</small>
                    <small className={`meal-price-change ${meal.priceChange ? meal.priceChange.direction : ''}`}>
                      {meal.priceChange
                        ? `较上次 ${meal.priceChange.direction === 'up' ? '+' : '-'}${formatPrice(meal.priceChange.deltaFen)}`
                        : '首次核验'}
                    </small>
                  </div>
                  <div className="meal-proof">
                    <TrustBadge label={meal.freshness} compact />
                    <small>
                      核验于 {meal.observedAt.replaceAll('-', '.')} ·{' '}
                      {verificationMethodLabel(meal.method)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
            <div className="detail-note">
              <span aria-hidden="true">✳</span>
              <p>{place.note}</p>
            </div>
            {place.evidence && place.evidence.length > 0 && (
              <div className="detail-evidence">
                <div className="section-heading">
                  <h2>已核验图片</h2>
                  <span>{place.evidence.length} 张</span>
                </div>
                <div className="submission-media-grid">
                  {place.evidence.map((item) => (
                    <figure key={item.id}>
                      <a className="public-evidence-link" href={item.url} target="_blank" rel="noreferrer">
                        <Image
                          src={item.url}
                          width={item.width ?? 640}
                          height={item.height ?? 480}
                          unoptimized
                          alt="已核验菜单或价签，打开查看大图"
                        />
                        <span>打开大图 ↗</span>
                      </a>
                    </figure>
                  ))}
                </div>
              </div>
            )}
          </section>
          <aside className="detail-aside">
            <div className="aside-block">
              <span className="eyebrow">准入方式</span>
              <strong>{place.access}</strong>
              <p>去之前看一眼，别让门卫和你都为难。</p>
            </div>
            <div className="aside-block">
              <span className="eyebrow">客观标签</span>
              <div className="tag-cloud">
                {place.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </div>
            <a
              className="primary-button navigation-button"
              href={`https://apis.map.qq.com/uri/v1/marker?marker=coord:${place.lat},${place.lng};title:${encodeURIComponent(place.name)};addr:${encodeURIComponent(place.address)}&referer=shenzhen-budget-map`}
              target="_blank"
              rel="noreferrer"
            >
              打开地图导航 <span>↗</span>
            </a>
            <Link
              href={`/submit?place=${place.id}&type=correction`}
              className="secondary-button"
            >
              价格不对？报个错
            </Link>
          </aside>
        </div>
      </main>
    </>
  );
}
