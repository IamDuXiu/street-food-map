export interface GeocodeCandidate {
  lng: number;
  lat: number;
  title?: string;
  reliability?: number;
}

export interface GeocodeOptions {
  key?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function tencentGeocoderKey(): string {
  return (
    process.env.TENCENT_MAP_WEB_SERVICE_KEY ??
    process.env.TENCENT_MAP_KEY ??
    ''
  );
}

const DEFAULT_TIMEOUT_MS = 8000;

const PLACEHOLDER_ADDRESS_MARKERS = ['待补', '待确认', '待定位', '占位', 'TODO'];

/**
 * Placeholder addresses written by tools like `scripts/creator-collect.ts`
 * must never be sent to the geocoder: fuzzy matching would happily return the
 * city centre and let an unverified record through as if it were located.
 */
export function isPlaceholderAddress(address: string): boolean {
  const value = address.trim();
  return PLACEHOLDER_ADDRESS_MARKERS.some((marker) => value.includes(marker));
}

/**
 * Server-side address → GCJ-02 candidate(s) via Tencent WebService Geocoder.
 * Missing key, placeholder address, network failure, or a non-zero status all
 * resolve to `[]` so the caller can fall back to manual coordinate picking.
 * The key is never logged.
 */
export async function geocodeAddress(
  address: string,
  options: GeocodeOptions = {},
): Promise<GeocodeCandidate[]> {
  const trimmed = address.trim();
  const key = options.key ?? tencentGeocoderKey();
  if (!trimmed || !key || isPlaceholderAddress(trimmed)) return [];
  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  try {
    const params = new URLSearchParams({ address: trimmed, key });
    const response = await doFetch(
      `https://apis.map.qq.com/ws/geocoder/v1/?${params.toString()}`,
      { signal: controller.signal, headers: { accept: 'application/json' } },
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      status?: number;
      result?: {
        title?: string;
        location?: { lng?: number; lat?: number };
        reliability?: number;
      };
    };
    if (payload.status !== 0 || !payload.result?.location) return [];
    const lng = Number(payload.result.location.lng);
    const lat = Number(payload.result.location.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return [];
    return [
      {
        lng,
        lat,
        title: payload.result.title,
        reliability: payload.result.reliability,
      },
    ];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
