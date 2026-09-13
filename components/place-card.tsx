import Image from 'next/image';
import Link from 'next/link';
import type { Place } from '@/lib/types';
import { formatDistance, formatPrice, lowestMeal } from '@/lib/filter';
import { methodLabel } from '@/lib/trust';
import { categoryEmoji } from '@/lib/category-emoji';
import { relativePublishedLabel, relativeVerificationLabel } from '@/lib/freshness';

type PlaceWithEvidence = Place & { evidence?: Array<{ id: string; url: string; width?: number | null; height?: number | null }> };

function freshnessMetaClass(freshness: string): string {
  switch (freshness) {
    case '近期核验': return 'freshness-recent';
    case '可能过期': return 'freshness-stale';
    case '已过期': return 'freshness-expired';
    default: return 'freshness-valid';
  }
}

export function PlaceCard({ place, selected = false, onSelect, distanceLabel = '距中心' }: { place: Place; selected?: boolean; onSelect?: (id: string) => void; distanceLabel?: '距你' | '距中心' }) {
  const meal = lowestMeal(place);
  const evidenceList = (place as PlaceWithEvidence).evidence;
  const evidence = evidenceList?.[0];
  const emoji = categoryEmoji(place.category, meal?.category);
  const isUnverified = meal?.unverified === true;
  const sourceLabel = place.sources ?? meal?.source;
  const trustSummary = meal
    ? isUnverified
      ? '创作者来源 · 未核验'
      : `${methodLabel(meal.method)} · ${place.meals.length} 次核验${evidenceList?.length ? ' · 有图' : ''}`
    : '暂无有效核验';
  const content = <article className={`place-card ${selected ? 'place-card-selected' : ''} ${evidence ? 'place-card-has-thumb' : 'place-card-no-thumb'}`}>
    {evidence && <Image className="place-card-thumb" src={evidence.url} alt="" width={evidence.width && evidence.width > 0 ? evidence.width : 46} height={evidence.height && evidence.height > 0 ? evidence.height : 46} sizes="46px" unoptimized />}
    <div className="place-card-copy">
      <div className="place-card-name-row"><span className="place-card-emoji" aria-hidden="true">{emoji}</span><h3>{place.name}</h3><span className="arrow" aria-hidden="true">↗</span></div>
      <p className="place-card-trust">{trustSummary}</p>
      <p className="place-card-meal-line">{meal?.name ?? '暂无有效餐食'} <span aria-hidden="true">·</span> {place.address}</p>
      {sourceLabel && <p className="source-label">来源 {sourceLabel}</p>}
      <p className="place-card-access">准入 · {place.access}</p>
      <p className="place-card-meta"><span className={meal ? freshnessMetaClass(meal.freshness) : undefined}>{meal ? (isUnverified ? relativePublishedLabel(meal) : relativeVerificationLabel(meal)) : '暂无有效核验'}</span><span>{place.tags.slice(0, 2).join(' · ')}</span>{place.distanceMeters !== undefined && <span>{distanceLabel} {formatDistance(place.distanceMeters)}</span>}</p>
    </div>
    <div className="place-card-price-cell">
      {isUnverified && <span className="unverified-tag">未核验</span>}
      <strong className="place-card-price">{meal ? formatPrice(meal.priceFen) : '—'}</strong>
      {meal?.priceChange && <span className={`price-change price-change-${meal.priceChange.direction}`}>{meal.priceChange.direction === 'up' ? '↑' : '↓'}{formatPrice(meal.priceChange.deltaFen)}</span>}
    </div>
  </article>;
  if (onSelect) return <Link href={`/places/${place.id}`} className="card-link" onClick={() => onSelect(place.id)}>{content}</Link>;
  return <Link href={`/places/${place.id}`} className="card-link">{content}</Link>;
}
