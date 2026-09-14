'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MapViewport, Place } from '@/lib/types';
import { TencentAdapter } from '@/lib/map-adapter';
import { formatPrice, lowestMeal } from '@/lib/filter';

export function MapStage({ places, viewport, selectedId, onSelect, onSearchViewport, userLocation }: { places: Place[]; viewport: MapViewport; selectedId: string | null; onSelect: (id: string) => void; onSearchViewport?: (bbox: [number, number, number, number]) => void; userLocation?: { lng: number; lat: number } }) {
  const [mode, setMode] = useState<'demo' | 'tencent'>('demo');
  const [mapError, setMapError] = useState('');
  const [mapLoading, setMapLoading] = useState(false);
  const [mapRetry, setMapRetry] = useState(0);
  const [mapCanRetry, setMapCanRetry] = useState(false);
  const [viewDirty, setViewDirty] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<TencentAdapter | null>(null);
  const dots = useMemo(() => {
    const bounds = viewport.bbox ?? [viewport.centerLng - 0.04, viewport.centerLat - 0.035, viewport.centerLng + 0.04, viewport.centerLat + 0.035];
    const width = Math.max(bounds[2] - bounds[0], 0.0001);
    const height = Math.max(bounds[3] - bounds[1], 0.0001);
    const placed: Array<{ left: number; top: number }> = [];
    return places.map((place) => {
      let left = Math.min(92, Math.max(8, ((place.lng - bounds[0]) / width) * 100));
      let top = Math.min(90, Math.max(10, (1 - (place.lat - bounds[1]) / height) * 100));
      let attempt = 0;
      while (placed.some((point) => Math.abs(point.left - left) < 8 && Math.abs(point.top - top) < 7) && attempt < 8) {
        top = Math.max(8, top - 6);
        if (attempt % 2 === 1) left = Math.min(92, left + 6);
        attempt += 1;
      }
      placed.push({ left, top });
      return { place, left: `${left}%`, top: `${top}%` };
    });
  }, [places, viewport]);

  useEffect(() => {
    if (!TencentAdapter.isConfigured() || !canvasRef.current) {
      setMapError('当前为示意底图，不可用于导航。');
      setMapLoading(false);
      setMapCanRetry(false);
      return;
    }
    let cancelled = false;
    setMapError('');
    setMapLoading(true);
    setMapCanRetry(true);
    const adapter = new TencentAdapter(); adapterRef.current = adapter;
    adapter.initialize(canvasRef.current).then(() => {
      setMapLoading(false);
      if (cancelled || adapterRef.current !== adapter) { adapter.destroy(); return; }
      setMode('tencent');
      adapter.onViewportChange(() => setViewDirty(true));
    }).catch(() => {
      if (!cancelled && adapterRef.current === adapter) {
        setMapLoading(false);
        setMapError('地图暂时无法加载，当前为示意底图，不可用于导航。');
        setMode('demo');
      }
      adapter.destroy();
    });
    return () => {
      cancelled = true;
      if (adapterRef.current === adapter) adapterRef.current = null;
      adapter.destroy();
    };
  }, [mapRetry]);

  useEffect(() => { adapterRef.current?.setViewport(viewport); queueMicrotask(() => { setViewDirty(false); }); }, [viewport, mode]);
  useEffect(() => { adapterRef.current?.renderPlaces(places, onSelect, selectedId); return () => adapterRef.current?.clearMarkers(); }, [places, onSelect, selectedId, mode]);
  useEffect(() => { if (selectedId) adapterRef.current?.selectPlace(selectedId); }, [selectedId]);
  useEffect(() => { if (userLocation) adapterRef.current?.setCenter(userLocation); }, [userLocation, mode]);

  function searchViewport() { const bbox = adapterRef.current?.getBounds(); if (bbox) { setViewDirty(false); onSearchViewport?.(bbox); } }
  return <section className={`map-stage ${mode === 'tencent' ? 'map-vendor-stage tencent-stage' : ''}`} aria-label={mode === 'tencent' ? '腾讯地图' : '示意地图'}>
    <div className="map-vendor-container" ref={canvasRef} aria-hidden={mode !== 'tencent'} />
    <div className="map-toolbar"><span className="map-mode"><span className="status-dot" />{mode === 'tencent' ? '腾讯地图' : '示意底图'}</span><span className="map-coordinates">{mode === 'tencent' ? `自有饭签 · ${places.length} 个` : '不可用于导航'}</span></div>
    {mode === 'demo' && <div className="demo-map-surface"><div className="map-grid" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div><div className="map-road road-one" aria-hidden="true" /><div className="map-road road-two" aria-hidden="true" /><div className="map-road road-three" aria-hidden="true" /><div className="map-label map-label-one">{viewport.label}</div><div className="map-label map-label-two">{viewport.subtitle}</div>{dots.map(({ place, left, top }) => { const meal = lowestMeal(place); const isSelected = selectedId === place.id; return <button key={place.id} className={`map-pin map-price-pin ${isSelected ? 'map-pin-selected' : ''}`} style={{ left, top, background: isSelected ? '#242526' : '#fff', color: isSelected ? '#fff' : '#242526' }} onClick={() => onSelect(place.id)} aria-label={`选择${place.name}`}><span>{meal ? formatPrice(meal.priceFen) : '—'}</span></button>; })}</div>}
    {mapLoading && <p className="map-fallback-notice" role="status">正在加载腾讯地图…</p>}
    {!mapLoading && mapError && <p className="map-fallback-notice" role="status">{mapError}{mapCanRetry && <button type="button" onClick={() => setMapRetry((value) => value + 1)}>重试</button>}</p>}
    {mode === 'tencent' && viewDirty && <button className="map-search-viewport" onClick={searchViewport}>搜索当前视野</button>}
  </section>;
}
