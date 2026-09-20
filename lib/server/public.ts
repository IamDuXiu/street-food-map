import type { DbPlace } from './repository';
import type { Place } from '../types';
import {
  clampDisplayPriceFen,
  DISPLAY_PRICE_CAP_FEN,
  SHOP_GATE_PRICE_FEN,
} from '../cities';

export interface PublicPlaceDto extends Place {
  zoneName: string;
  evidence: Array<{
    id: string;
    url: string;
    width: number | null;
    height: number | null;
  }>;
}
export function toPublicPlace(
  place: DbPlace,
  now = new Date(),
  maxPriceFen = DISPLAY_PRICE_CAP_FEN,
): PublicPlaceDto {
  const cutoff = now.getTime() - 180 * 86400000;
  const priceCap = clampDisplayPriceFen(maxPriceFen);
  return {
    id: place.id,
    zoneId: place.zoneId,
    zoneName: place.zoneName,
    ...(place.city ? { city: place.city } : {}),
    name: place.name,
    address: place.address,
    lng: place.lng,
    lat: place.lat,
    category: place.category,
    access: place.access,
    tags: place.tags,
    note: place.note,
    meals: place.meals.filter(
      (meal) =>
        meal.priceFen <= priceCap &&
        new Date(meal.observedAt).getTime() >= cutoff,
    ),
    ...(place.sources ? { sources: place.sources } : {}),
    verification: place.verification,
    evidence: (place.evidence ?? []).map((item) => ({
      id: item.id,
      url: `/api/v1/media/${item.id}`,
      width: item.width,
      height: item.height,
    })),
  };
}

export function publicPlaceIsEligible(place: DbPlace, now = new Date()) {
  const cutoff = now.getTime() - 180 * 86400000;
  return (
    place.recordStatus === 'active' &&
    ['open', 'unknown'].includes(place.businessStatus) &&
    place.meals.some(
      (meal) =>
        meal.priceFen <= SHOP_GATE_PRICE_FEN &&
        new Date(meal.observedAt).getTime() >= cutoff,
    )
  );
}
