import type { MapViewport, Place } from './types';
import { formatPrice, lowestMeal } from './filter';

export interface MapAdapter {
  readonly mode: 'demo' | 'tencent';
  selectPlace(placeId: string): void;
  setViewport(viewport: MapViewport): void;
  getVisiblePlaces(places: Place[]): Place[];
}

type TMapLatLngLike = { getLng: () => number; getLat: () => number };
type TMapBoundsLike = { getSouthWest: () => TMapLatLngLike; getNorthEast: () => TMapLatLngLike };
type TMapEventLike = { latLng?: TMapLatLngLike; geometry?: { id?: string; position?: TMapLatLngLike } };
type TMapMapLike = {
  setZoom: (zoom: number) => void;
  setCenter: (center: TMapLatLngLike) => void;
  getBounds: () => TMapBoundsLike;
  on: (event: string, handler: (event: TMapEventLike) => void) => void;
  off: (event: string, handler: (event: TMapEventLike) => void) => void;
  destroy?: () => void;
};
type TMapLayerLike = {
  on: (event: string, handler: (event: TMapEventLike) => void) => void;
  off: (event: string, handler: (event: TMapEventLike) => void) => void;
  setGeometries?: (geometries: Array<Record<string, unknown>>) => void;
  setMap?: (map: TMapMapLike | null) => void;
  destroy?: () => void;
};
type TMapLike = {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => TMapMapLike;
  LatLng: new (lat: number, lng: number) => TMapLatLngLike;
  MarkerStyle: new (options: Record<string, unknown>) => Record<string, unknown>;
  MultiMarker: new (options: Record<string, unknown>) => TMapLayerLike;
};

declare global { interface Window { TMap?: TMapLike } }

type Coordinate = { lng: number; lat: number };

let nextMapOwnerId = 0;
const mapOwners = new WeakMap<object, string>();

function latLng(position: Coordinate) {
  if (!window.TMap) throw new Error('TENCENT_MAP_UNAVAILABLE');
  // Tencent's LatLng constructor is (latitude, longitude), while Place is lng/lat.
  return new window.TMap.LatLng(position.lat, position.lng);
}

function pointFromEvent(event: TMapEventLike) {
  const point = event.latLng ?? event.geometry?.position;
  return point ? { lng: point.getLng(), lat: point.getLat() } : null;
}

function markerSvg(text: string, selected: boolean) {
  const background = selected ? '#171b18' : '#ffffff';
  const foreground = selected ? '#ffffff' : '#171b18';
  const encoded = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="54" height="35" viewBox="0 0 54 35"><rect x="0.5" y="0.5" width="53" height="34" rx="9" fill="${background}" stroke="#171b18"/><text x="27" y="22" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="${foreground}">${text}</text></svg>`);
  return `data:image/svg+xml;charset=UTF-8,${encoded}`;
}

function disposeLayer(layer: TMapLayerLike | null) {
  if (!layer) return;
  if (layer.setMap) layer.setMap(null);
  else layer.destroy?.();
}

/** Thin, browser-only Tencent JS API GL adapter. It never loads the vendor script during SSR. */
export class TencentAdapter implements MapAdapter {
  readonly mode = 'tencent' as const;
  private readonly ownerId = `tencent-map-${++nextMapOwnerId}`;
  private container: HTMLElement | null = null;
  private disposed = false;
  private map: TMapMapLike | null = null;
  private markerLayer: TMapLayerLike | null = null;
  private pickerLayer: TMapLayerLike | null = null;
  private markerClickHandler: ((event: TMapEventLike) => void) | null = null;
  private mapListeners: Array<{ event: string; handler: (event: TMapEventLike) => void }> = [];
  private viewportId = 'sz university';
  private selectedPlaceId: string | null = null;
  private positions = new Map<string, Coordinate>();

  static isConfigured() {
    return typeof window !== 'undefined' && process.env.NEXT_PUBLIC_MAP_MODE === 'tencent' && Boolean(process.env.NEXT_PUBLIC_TENCENT_MAP_KEY);
  }

  async initialize(container: HTMLElement) {
    if (typeof window === 'undefined' || !TencentAdapter.isConfigured()) throw new Error('TENCENT_NOT_CONFIGURED');
    this.disposed = false;
    if (!window.TMap) await loadTencentScript();
    if (this.disposed) throw new Error('TENCENT_INITIALIZE_CANCELLED');
    if (!window.TMap) throw new Error('TENCENT_LOAD_FAILED');
    this.container = container;
    mapOwners.set(container, this.ownerId);
    this.map = new window.TMap.Map(container, { zoom: 13, center: latLng({ lng: 113.933073, lat: 22.526639 }), pitch: 0, viewMode: '2D' });
    return this;
  }

  renderPlaces(places: Place[], onSelect: (id: string) => void, selectedPlaceId: string | null = this.selectedPlaceId) {
    if (!this.map || !window.TMap) return;
    this.selectedPlaceId = selectedPlaceId;
    this.clearMarkers();
    const styles: Record<string, Record<string, unknown>> = {};
    const geometries = places.map((place) => {
      const position = { lng: place.lng, lat: place.lat };
      this.positions.set(place.id, position);
      const meal = lowestMeal(place);
      const price = meal ? formatPrice(meal.priceFen) : '—';
      const normalStyle = `${place.id}-normal`;
      const selectedStyle = `${place.id}-selected`;
      styles[normalStyle] = new window.TMap!.MarkerStyle({ width: 54, height: 35, anchor: { x: 27, y: 17.5 }, src: markerSvg(price, false) });
      styles[selectedStyle] = new window.TMap!.MarkerStyle({ width: 54, height: 35, anchor: { x: 27, y: 17.5 }, src: markerSvg(price, true) });
      return { id: place.id, styleId: place.id === this.selectedPlaceId ? selectedStyle : normalStyle, position: latLng(position), properties: { title: place.name } };
    });
    this.markerLayer = new window.TMap.MultiMarker({ id: 'place-markers', map: this.map, styles, geometries });
    this.markerClickHandler = (event) => {
      const id = event.geometry?.id;
      if (!id || !this.positions.has(id)) return;
      this.selectedPlaceId = id;
      onSelect(id);
    };
    this.markerLayer.on('click', this.markerClickHandler);
  }

  clearMarkers() {
    if (this.markerLayer && this.markerClickHandler) this.markerLayer.off('click', this.markerClickHandler);
    disposeLayer(this.markerLayer);
    this.markerLayer = null;
    this.markerClickHandler = null;
    this.positions.clear();
  }

  selectPlace(placeId: string) {
    this.selectedPlaceId = placeId;
    const position = this.positions.get(placeId);
    if (position) this.map?.setCenter(latLng(position));
  }

  setViewport(viewport: MapViewport) {
    this.viewportId = viewport.id;
    this.map?.setCenter(latLng({ lng: viewport.centerLng, lat: viewport.centerLat }));
    if (viewport.zoom) this.map?.setZoom(viewport.zoom);
  }

  setCenter(center: Coordinate) { this.map?.setCenter(latLng(center)); }

  getVisiblePlaces(places: Place[]) {
    const bounds = this.getBounds();
    if (!bounds) return places.filter((place) => place.zoneId === this.viewportId);
    const [west, south, east, north] = bounds;
    return places.filter((place) => place.lng >= west && place.lng <= east && place.lat >= south && place.lat <= north);
  }

  getBounds() {
    const bounds = this.map?.getBounds();
    if (!bounds) return null;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    return [sw.getLng(), sw.getLat(), ne.getLng(), ne.getLat()] as [number, number, number, number];
  }

  onViewportChange(handler: () => void) {
    if (!this.map) return () => undefined;
    const listener = () => handler();
    ['dragend', 'zoomend', 'idle'].forEach((event) => {
      this.map?.on(event, listener);
      this.mapListeners.push({ event, handler: listener });
    });
    return () => {
      this.mapListeners = this.mapListeners.filter((item) => {
        if (item.handler !== listener) return true;
        this.map?.off(item.event, item.handler);
        return false;
      });
    };
  }

  onMapClick(handler: (position: Coordinate) => void) {
    if (!this.map) return () => undefined;
    const listener = (event: TMapEventLike) => {
      const position = pointFromEvent(event);
      if (position) handler(position);
    };
    this.map.on('click', listener);
    this.mapListeners.push({ event: 'click', handler: listener });
    return () => {
      this.map?.off('click', listener);
      this.mapListeners = this.mapListeners.filter((item) => item.handler !== listener);
    };
  }

  /** Tencent GL picker is deliberately click-to-place; no unsupported drag API is assumed. */
  setPickerPosition(position: Coordinate) {
    if (!this.map || !window.TMap) return;
    const styles = { picker: new window.TMap.MarkerStyle({ width: 28, height: 28, anchor: { x: 14, y: 14 }, src: markerSvg('⌖', true) }) };
    const geometry = { id: 'coordinate-picker', styleId: 'picker', position: latLng(position), properties: { title: '核验位置' } };
    if (!this.pickerLayer) this.pickerLayer = new window.TMap.MultiMarker({ id: 'coordinate-picker', map: this.map, styles, geometries: [geometry] });
    else this.pickerLayer.setGeometries?.([geometry]);
    this.map.setCenter(latLng(position));
  }

  clearPicker() { disposeLayer(this.pickerLayer); this.pickerLayer = null; }

  destroy() {
    this.disposed = true;
    this.clearMarkers();
    this.clearPicker();
    this.mapListeners.splice(0).forEach(({ event, handler }) => this.map?.off(event, handler));
    // React Strict Mode can finish an older async initialization after a newer
    // adapter already owns the same container. Never let that stale cleanup
    // clear the newer map's DOM.
    if (this.container && mapOwners.get(this.container) === this.ownerId) {
      this.map?.destroy?.();
      mapOwners.delete(this.container);
    }
    this.map = null;
    this.container = null;
    this.positions.clear();
  }

  get selection() { return this.selectedPlaceId; }
}

let tencentScriptPromise: Promise<void> | null = null;
function loadTencentScript() {
  if (tencentScriptPromise) return tencentScriptPromise;
  tencentScriptPromise = new Promise((resolve, reject) => {
    const key = process.env.NEXT_PUBLIC_TENCENT_MAP_KEY;
    if (!key) return reject(new Error('TENCENT_KEY_MISSING'));
    const script = document.createElement('script');
    script.src = `https://map.qq.com/api/gljs?v=1.exp&key=${encodeURIComponent(key)}`;
    script.async = true;
    const timeoutId = window.setTimeout(() => {
      tencentScriptPromise = null;
      reject(new Error('TENCENT_LOAD_TIMEOUT'));
    }, 12_000);
    script.onload = () => { window.clearTimeout(timeoutId); resolve(); };
    script.onerror = () => { window.clearTimeout(timeoutId); tencentScriptPromise = null; reject(new Error('TENCENT_LOAD_FAILED')); };
    document.head.appendChild(script);
  });
  return tencentScriptPromise;
}

/** A deterministic, keyless map surface for design review and local demos. */
export class DemoMapAdapter implements MapAdapter {
  readonly mode = 'demo' as const;
  private selectedPlaceId: string | null = null;
  private viewportId = 'sz university';
  private viewportBbox: [number, number, number, number] | undefined;

  selectPlace(placeId: string) { this.selectedPlaceId = placeId; }

  setViewport(viewport: MapViewport) {
    this.viewportId = viewport.id;
    this.viewportBbox = viewport.bbox;
  }

  getVisiblePlaces(places: Place[]) {
    if (this.viewportBbox) {
      const [west, south, east, north] = this.viewportBbox;
      return places.filter((place) => place.lng >= west && place.lng <= east && place.lat >= south && place.lat <= north);
    }
    return places.filter((place) => place.zoneId === this.viewportId);
  }

  get selection() { return this.selectedPlaceId; }
}
