import Image from 'next/image';
import Link from 'next/link';
import type { Place } from '@/lib/types';
import { formatPrice, lowestMeal } from '@/lib/filter';

type PlaceWithEvidence = Place & { evidence?: Array<{ id: string; url: string; width?: number | null; height?: number | null }> };

export function PlaceCard({ place, selected = false, onSelect }: { place: Place; selected?: boolean; onSelect?: (id: string) => void }) {
  const meal = lowestMeal(place);
  const evidence = (place as PlaceWithEvidence).evidence?.[0];
  const content = <article className={`place-card ${selected ? 'place-card-selected' : ''} ${evidence ? 'place-card-has-thumb' : 'place-card-no-thumb'}`}>
    {evidence && <Image className="place-card-thumb" src={evidence.url} alt="" width={evidence.width && evidence.width > 0 ? evidence.width : 46} height={evidence.height && evidence.height > 0 ? evidence.height : 46} sizes="46px" unoptimized />}
    <div className="place-card-copy">
      <div className="place-card-name-row"><h3>{place.name}</h3><span className="arrow" aria-hidden="true">↗</span></div>
      <p className="place-card-meal-line">{meal?.name ?? '暂无有效餐食'} <span aria-hidden="true">·</span> {place.address}</p>
      <p className="place-card-access">准入 · {place.access}</p>
      <p className="place-card-meta"><span>{meal ? `核验 ${meal.observedAt.replaceAll('-', '.')}` : '暂无有效核验'}</span><span>{place.tags.slice(0, 2).join(' · ')}</span>{place.distanceMeters !== undefined && <span>{(place.distanceMeters / 1000).toFixed(1)} km</span>}</p>
    </div>
    <strong className="place-card-price">{meal ? formatPrice(meal.priceFen) : '—'}</strong>
  </article>;
  if (onSelect) return <Link href={`/places/${place.id}`} className="card-link" onClick={() => onSelect(place.id)}>{content}</Link>;
  return <Link href={`/places/${place.id}`} className="card-link">{content}</Link>;
}
