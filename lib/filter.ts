import type { Place } from './types';
import { distanceMeters } from './geo';

export interface FilterState {
  maxPrice: number;
  zoneId: string;
  tag: string;
  query: string;
}

export function formatPrice(priceFen: number): string {
  const yuan = priceFen / 100;
  return Number.isInteger(yuan)
    ? `¥${yuan}`
    : `¥${yuan.toFixed(2).replace(/0+$/, '')}`;
}

export function filterPlaces(places: Place[], state: FilterState): Place[] {
  const query = state.query.trim().toLowerCase();
  return places.filter((place) => {
    if (state.zoneId !== 'all' && place.zoneId !== state.zoneId) return false;
    if (state.tag !== 'all' && !place.tags.includes(state.tag as Place['tags'][number])) return false;
    if (query && !`${place.name} ${place.meals.map((meal) => meal.name).join(' ')}`.toLowerCase().includes(query)) return false;
    return place.meals.some((meal) => meal.priceFen <= state.maxPrice * 100);
  });
}

export function lowestPrice(place: Place, maxPrice = 30): number {
  const valid = eligibleMeals(place, maxPrice * 100).map((meal) => meal.priceFen);
  return valid.length ? Math.min(...valid) : 0;
}

/**
 * The public API already returns meals that passed freshness, verification and
 * budget checks. Keeping this tiny helper shared means cards and map markers
 * never disagree about the price they display.
 */
export function eligibleMeals(place: Place, maxPriceFen = Number.MAX_SAFE_INTEGER) {
  return place.meals.filter((meal) => meal.priceFen <= maxPriceFen);
}

export function lowestMeal(place: Place, maxPriceFen = Number.MAX_SAFE_INTEGER) {
  return eligibleMeals(place, maxPriceFen).reduce<Place['meals'][number] | undefined>(
    (lowest, meal) => !lowest || meal.priceFen < lowest.priceFen ? meal : lowest,
    undefined,
  );
}

/** Apply the user's nearby radius without changing the API's requested order. */
export function prepareNearbyPlaces(
  places: Place[],
  origin: { lng: number; lat: number },
  sort: 'distance' | 'price' | 'freshness',
  radiusMeters = 5_000,
) {
  const nearby = places
    .filter((place) => distanceMeters(origin, place) <= radiusMeters)
    .map((place) => ({ ...place, distanceMeters: Math.round(distanceMeters(origin, place)) }));
  if (sort !== 'distance') return nearby;
  return nearby.sort((a, b) =>
    (a.distanceMeters ?? Number.POSITIVE_INFINITY) - (b.distanceMeters ?? Number.POSITIVE_INFINITY) ||
    a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}
