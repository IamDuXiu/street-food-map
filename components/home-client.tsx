'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapStage } from './map-stage';
import { PlaceCard } from './place-card';
import { RegionPicker } from './region-picker';
import styles from './home-client.module.css';
import { formatPrice, lowestMeal, prepareNearbyPlaces } from '@/lib/filter';
import { wgs84ToGcj02 } from '@/lib/geo';
import {
  findShenzhenRegion,
  SHENZHEN_CITY,
  SHENZHEN_REGION_CATALOG,
  type ShenzhenRegion,
  type ShenzhenRegionCatalog,
} from '@/lib/regions';
import type { MapViewport, Place } from '@/lib/types';

const DEFAULT_REGION = 'shenzhen';
const NEARBY_RADIUS_METERS = 5_000;

function nearbyViewport(origin?: { lng: number; lat: number }): MapViewport {
  if (!origin) return SHENZHEN_CITY;
  return {
    id: 'nearby',
    label: '我的附近',
    subtitle: '当前位置 5 公里内 · 位置只在本页使用',
    centerLng: origin.lng,
    centerLat: origin.lat,
    bbox: [origin.lng - 0.055, origin.lat - 0.045, origin.lng + 0.055, origin.lat + 0.045],
    zoom: 14,
    level: 'nearby',
    coverage: 'live',
  };
}

type SortMode = 'distance' | 'price' | 'freshness';
type MobileListState = 'peek' | 'half' | 'full';

export function HomeClient() {
  const [maxPrice, setMaxPrice] = useState(20);
  const [regionId, setRegionId] = useState(DEFAULT_REGION);
  const [tag, setTag] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('price');
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState('');
  const [origin, setOrigin] = useState<{ lng: number; lat: number }>();
  const [movedBbox, setMovedBbox] = useState<[number, number, number, number] | undefined>();
  const [catalog, setCatalog] = useState<ShenzhenRegionCatalog>(SHENZHEN_REGION_CATALOG);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [mobileListState, setMobileListState] = useState<MobileListState>('peek');
  const [requestVersion, setRequestVersion] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const restoredRef = useRef(false);

  const selectedRegion = useMemo(() => regionId === 'nearby' ? null : (
    [catalog.city, ...catalog.districts.flatMap((item) => [item, ...item.businessAreas])]
      .find((region) => region.id === regionId) ?? findShenzhenRegion(regionId) ?? catalog.city
  ), [catalog, regionId]);
  const viewport = useMemo(
    () => regionId === 'nearby' ? nearbyViewport(origin) : selectedRegion ?? catalog.city,
    [catalog.city, origin, regionId, selectedRegion],
  );
  const requestBbox = movedBbox ?? (regionId === 'nearby' ? catalog.city.bbox : viewport.bbox);
  // Keep the first valid result as the visible default; a stale selected ID
  // from a previous filter must never hide the current result's meal.
  const selected = places.find((place) => place.id === selectedId) ?? places[0];
  const selectedMeal = selected ? lowestMeal(selected) : undefined;
  const isPlannedRegion = selectedRegion?.coverage === 'planned';
  const effectiveSort = sort === 'distance' && !origin ? 'price' : sort;

  // Restore non-location UI state when returning from a place detail page.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem('meal-map-home-state');
      if (raw) {
        const saved = JSON.parse(raw) as Partial<{
          maxPrice: number;
          regionId: string;
          tag: string;
          query: string;
          sort: SortMode;
          selectedId: string | null;
        }>;
        if ([15, 20, 25].includes(saved.maxPrice ?? 0)) setMaxPrice(saved.maxPrice!);
        if (saved.regionId && saved.regionId !== 'nearby') setRegionId(saved.regionId);
        if (saved.tag) setTag(saved.tag);
        if (typeof saved.query === 'string') setQuery(saved.query);
        if (saved.sort && ['distance', 'price', 'freshness'].includes(saved.sort)) setSort(saved.sort === 'distance' ? 'price' : saved.sort);
        if (saved.selectedId) setSelectedId(saved.selectedId);
      }
    } catch { /* Ignore unavailable or malformed session storage. */ }
    restoredRef.current = true;
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!restoredRef.current || typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem('meal-map-home-state', JSON.stringify({
        maxPrice,
        regionId: regionId === 'nearby' ? 'shenzhen' : regionId,
        tag,
        query,
        sort: sort === 'distance' ? 'price' : sort,
        selectedId,
      }));
    } catch {
      // Private browsing or a disabled storage policy should not block browsing.
    }
  }, [maxPrice, regionId, tag, query, sort, selectedId]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/config')
      .then((response) => response.ok ? response.json() as Promise<{ data?: { regions?: ShenzhenRegionCatalog; tags?: string[] } }> : Promise.reject(new Error('CONFIG_FAILED')))
      .then((payload) => {
        if (cancelled) return;
        if (payload.data?.regions?.districts?.length) setCatalog(payload.data.regions);
        if (payload.data?.tags?.length) setAvailableTags(payload.data.tags);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      maxPriceFen: String(maxPrice * 100),
      sort: effectiveSort,
    });
    if (tag !== 'all') params.set('tag', tag);
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (requestBbox) params.set('bbox', requestBbox.join(','));

    queueMicrotask(() => { setLoading(true); setError(null); });
    fetch(`/api/v1/map?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('REQUEST_FAILED');
        const payload = await response.json() as { data?: Place[] };
        let nextPlaces = payload.data ?? [];
        if (origin && regionId === 'nearby') {
          nextPlaces = prepareNearbyPlaces(nextPlaces, origin, effectiveSort, NEARBY_RADIUS_METERS);
        }
        setPlaces(nextPlaces);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setPlaces([]);
        setError('暂时连不上饭签数据。可以重试，或先换一个区域。');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [maxPrice, regionId, tag, debouncedQuery, origin, requestBbox, effectiveSort, requestVersion]);

  function chooseRegion(region: ShenzhenRegion) {
    setRegionId(region.id);
    setOrigin(undefined);
    if (sort === 'distance') setSort('price');
    setSelectedId(null);
    setMovedBbox(undefined);
    setLocationMessage(region.coverage === 'planned' ? `${region.label}已开放浏览，真实饭签等待共建。` : `已切换到${region.label}。`);
  }

  function locateNearby() {
    setMovedBbox(undefined);
    if (!navigator.geolocation) {
      setLocationMessage('当前浏览器不能定位，请选择行政区或全城。');
      return;
    }
    setLocationMessage('正在请求定位；位置只在本页用于筛选附近饭签。');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin(wgs84ToGcj02({ lng: position.coords.longitude, lat: position.coords.latitude }));
        setRegionId('nearby');
        setSort('distance');
        setSelectedId(null);
        setLocationMessage('已显示你附近 5 公里；精确位置只在本页使用。');
      },
      (reason) => setLocationMessage(reason.code === 1 ? '你拒绝了定位，请选择行政区或全城。' : '定位暂时不可用，请选择行政区或全城。'),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 },
    );
  }

  function retry() {
    setRequestVersion((value) => value + 1);
  }

  function resetFilters() {
    setMaxPrice(20);
    setTag('all');
    setQuery('');
    setSort('price');
    setMovedBbox(undefined);
    setSelectedId(null);
  }

  return (
    <main className={`${styles.homeShell} home-shell`}>
      <section className={styles.controlBar} aria-label="搜索和筛选">
        <div className={styles.searchRow}>
          <label className={styles.searchBox}>
            <span aria-hidden="true">⌕</span>
            <input aria-label="搜店名或餐食" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜店名或餐食" />
          </label>
          <RegionPicker catalog={catalog} selectedRegion={selectedRegion} onSelect={chooseRegion} onLocate={locateNearby} />
          <button type="button" className={styles.resetButton} onClick={resetFilters}>重置</button>
        </div>
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>预算</span>
          <div className={styles.budgetChips} role="group" aria-label="最高价格">
            {[15, 20, 25].map((price) => <button key={price} type="button" className={maxPrice === price ? styles.budgetChipActive : styles.budgetChip} aria-pressed={maxPrice === price} onClick={() => setMaxPrice(price)}>≤ ¥{price}</button>)}
          </div>
          <label className={styles.filterControl}>条件<select value={tag} onChange={(event) => setTag(event.target.value)} aria-label="按条件或标签筛选"><option value="all">全部</option>{availableTags.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className={styles.filterControl}>排序<select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} aria-label="结果排序"><option value="price">最低价优先</option><option value="freshness">最近核验</option><option value="distance" disabled={!origin}>附近优先{origin ? '' : '（先定位）'}</option></select></label>
          <span className={styles.filterHint}>有效餐食 ≤ {formatPrice(maxPrice * 100)}</span>
        </div>
        {locationMessage && <p className={styles.locationNotice} role="status">◎ {locationMessage}</p>}
      </section>

      <div className={`${styles.homeLayout} home-layout`}>
        <section className={`${styles.resultsPanel} results-panel ${styles[`sheet-${mobileListState}`]} ${!loading && selected ? styles.hasSelection : ''}`} aria-live="polite">
          <div className={styles.resultsHeading}>
            <div>
              <p className={styles.sectionLabel}>当前范围 · {viewport.label}</p>
              <h2>{loading ? '…' : places.length}<span> 个结果</span></h2>
            </div>
            <div className={styles.mobileSheetActions} aria-label="移动端结果列表状态">
              <button type="button" aria-pressed={mobileListState === 'peek'} onClick={() => setMobileListState('peek')}>收起</button>
              <button type="button" aria-pressed={mobileListState === 'half'} onClick={() => setMobileListState('half')}>半屏</button>
              <button type="button" aria-pressed={mobileListState === 'full'} onClick={() => setMobileListState('full')}>列表</button>
            </div>
            <span className={styles.sortNote}>{effectiveSort === 'freshness' ? '最近核验' : effectiveSort === 'distance' ? '附近优先' : '最低价优先'}</span>
          </div>
          {!loading && selected && selectedMeal && <Link className={styles.mobileSelectedCard} href={`/places/${selected.id}`} aria-label={`查看${selected.name}详情`}>
            <span className={styles.mobileSelectedCardMeta}>已选饭签 · {selected.category}</span>
            <strong>{selected.name}</strong>
            <span>{selectedMeal.name} · {formatPrice(selectedMeal.priceFen)} · {selectedMeal.observedAt.replaceAll('-', '.')}</span>
            <span>准入 · {selected.access}</span>
            <b>查看详情 ↗</b>
          </Link>}
          {error && <div className={styles.dataNotice} role="status"><span>{error}</span><button type="button" onClick={retry}>重试</button></div>}
          {!loading && !error && places.length ? <div className={styles.placeList}>{places.map((place) => <PlaceCard key={place.id} place={place} selected={selected?.id === place.id} onSelect={setSelectedId} />)}</div> : !loading && !error && isPlannedRegion ? <div className={styles.emptyState}><span className={styles.emptyIcon}>＋</span><h3>这里还没有真实饭签</h3><p>{viewport.label}已开放浏览，第一条信息等待附近的人共同补上。</p><Link className={styles.emptyLink} href="/submit">提交这个区域的第一条 ↗</Link></div> : !loading && !error ? <div className={styles.emptyState}><span className={styles.emptyIcon}>∅</span><h3>这组筛选暂时没饭</h3><p>试试放宽价格、换一个类别，或选择其他区域。</p><button type="button" onClick={() => { setMaxPrice(25); setTag('all'); setQuery(''); }}>看 ¥25 内全部</button></div> : null}
          <p className={styles.listNote}>价格来自现场菜单、公开菜单或近期用户核验。<Link href="/about">了解核验规则 ↗</Link></p>
        </section>
        <MapStage places={places} viewport={viewport} selectedId={selected?.id ?? selectedId} onSelect={(id) => { setSelectedId(id); setMobileListState('peek'); }} onSearchViewport={(nextBbox) => setMovedBbox(nextBbox)} userLocation={regionId === 'nearby' ? origin : undefined} />
      </div>
    </main>
  );
}
