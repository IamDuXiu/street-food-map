'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapStage } from './map-stage';
import { PlaceCard } from './place-card';
import { RecentStrip } from './recent-strip';
import { RegionPicker } from './region-picker';
import styles from './home-client.module.css';
import { Select } from '@/components/ui/Select';
import { formatPrice, lowestMeal, prepareNearbyPlaces, withRegionDistance } from '@/lib/filter';
import { useMobileSheetEnabled, useSheetGesture } from '@/lib/use-sheet-gesture';
import { wgs84ToGcj02 } from '@/lib/geo';
import {
  findShenzhenRegion,
  SHENZHEN_CITY,
  SHENZHEN_REGION_CATALOG,
  type ShenzhenRegion,
  type ShenzhenRegionCatalog,
} from '@/lib/regions';import type { MapViewport, Place } from '@/lib/types';
import { Notice } from './ui/Notice';

const DEFAULT_REGION = 'shenzhen';
const NEARBY_RADIUS_METERS = 5_000;

function nearbyViewport(origin?: { lng: number; lat: number }, fallback: MapViewport = SHENZHEN_CITY): MapViewport {
  if (!origin) return fallback;
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
const MOBILE_LIST_STATES: MobileListState[] = ['peek', 'half', 'full'];

export function HomeClient() {
  const [cheapOnly, setCheapOnly] = useState(true);
  const [regionId, setRegionId] = useState(DEFAULT_REGION);
  const [cityId, setCityId] = useState(DEFAULT_REGION);
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
  const layoutRef = useRef<HTMLDivElement>(null);
  const resultsPanelRef = useRef<HTMLElement>(null);
  const grabberRef = useRef<HTMLDivElement>(null);
  const sheetEnabled = useMobileSheetEnabled();

  const selectedRegion = useMemo(() => regionId === 'nearby' ? null : (
    [catalog.city, ...catalog.districts.flatMap((item) => [item, ...item.businessAreas])]
      .find((region) => region.id === regionId) ?? findShenzhenRegion(regionId) ?? catalog.city
  ), [catalog, regionId]);
  const viewport = useMemo(
    () => regionId === 'nearby' ? nearbyViewport(origin, catalog.city) : selectedRegion ?? catalog.city,
    [catalog.city, origin, regionId, selectedRegion],
  );
  const requestBbox = movedBbox ?? (regionId === 'nearby' ? catalog.city.bbox : viewport.bbox);
  // Keep the first valid result as the visible default; a stale selected ID
  // from a previous filter must never hide the current result's meal.
  const selected = places.find((place) => place.id === selectedId) ?? places[0];
  const selectedMeal = selected ? lowestMeal(selected) : undefined;
  const isPlannedRegion = selectedRegion?.coverage === 'planned';
  const effectiveSort = sort === 'distance' && !origin ? 'price' : sort;
  const hasSelection = Boolean(!loading && selected);
  // Snap heights mirror the sheet rules in home-client.module.css.
  const sheetSnaps = (containerHeight: number) => [
    hasSelection ? 180 : 64,
    containerHeight * 0.48,
    containerHeight - 8,
  ];
  const { dragging: sheetDragging, grabberProps } = useSheetGesture({
    containerRef: layoutRef,
    panelRef: resultsPanelRef,
    grabberRef,
    enabled: sheetEnabled,
    index: MOBILE_LIST_STATES.indexOf(mobileListState),
    snaps: sheetSnaps,
    onChange: (index) => setMobileListState(MOBILE_LIST_STATES[index] ?? 'peek'),
  });

  // Restore non-location UI state when returning from a place detail page.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem('meal-map-home-state');
      if (raw) {
        const saved = JSON.parse(raw) as Partial<{
          cheapOnly: boolean;
          regionId: string;
          cityId: string;
          tag: string;
          query: string;
          sort: SortMode;
          selectedId: string | null;
        }>;
        if (typeof saved.cheapOnly === 'boolean') setCheapOnly(saved.cheapOnly);
        if (saved.cityId) setCityId(saved.cityId);
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
        cheapOnly,
        cityId,
        regionId: regionId === 'nearby' ? cityId : regionId,
        tag,
        query,
        sort: sort === 'distance' ? 'price' : sort,
        selectedId,
      }));
    } catch {
      // Private browsing or a disabled storage policy should not block browsing.
    }
  }, [cheapOnly, cityId, regionId, tag, query, sort, selectedId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/config?city=${encodeURIComponent(cityId)}`)
      .then((response) => response.ok ? response.json() as Promise<{ data?: { regions?: ShenzhenRegionCatalog; tags?: string[] } }> : Promise.reject(new Error('CONFIG_FAILED')))
      .then((payload) => {
        if (cancelled) return;
        if (payload.data?.regions) setCatalog(payload.data.regions);
        if (payload.data?.tags?.length) setAvailableTags(payload.data.tags);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [cityId]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      maxPriceFen: String(cheapOnly ? 1500 : 20000),
      sort: effectiveSort,
    });
    if (tag !== 'all') params.set('tag', tag);
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (requestBbox) params.set('bbox', requestBbox.join(','));
    if (regionId !== 'nearby') params.set('city', cityId);

    queueMicrotask(() => { setLoading(true); setError(null); });
    fetch(`/api/v1/map?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('REQUEST_FAILED');
        const payload = await response.json() as { data?: Place[] };
        let nextPlaces = payload.data ?? [];
        if (regionId === 'nearby') {
          if (origin) {
            nextPlaces = prepareNearbyPlaces(nextPlaces, origin, effectiveSort, NEARBY_RADIUS_METERS);
          }
        } else if (selectedRegion) {
          nextPlaces = withRegionDistance(nextPlaces, {
            lng: selectedRegion.centerLng,
            lat: selectedRegion.centerLat,
          });
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
  }, [cheapOnly, regionId, cityId, tag, debouncedQuery, origin, requestBbox, effectiveSort, requestVersion, selectedRegion]);

  function chooseRegion(region: ShenzhenRegion) {
    setRegionId(region.id);
    setOrigin(undefined);
    if (sort === 'distance') setSort('price');
    setSelectedId(null);
    setMovedBbox(undefined);
    setLocationMessage(`已切换到${region.label}。`);
  }

  function chooseCity(nextCityId: string, label: string) {
    if (nextCityId === cityId) return;
    setCityId(nextCityId);
    setRegionId(nextCityId);
    setOrigin(undefined);
    setMovedBbox(undefined);
    setSelectedId(null);
    if (sort === 'distance') setSort('price');
    setLocationMessage(`已切换到${label}。`);
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
    setCheapOnly(true);
    setTag('all');
    setQuery('');
    setSort('price');
    setMovedBbox(undefined);
    setSelectedId(null);
  }

  const activeChips: Array<{ key: string; label: string; onRemove: () => void }> = [];
  if (cheapOnly) activeChips.push({ key: 'price', label: '仅看 ≤ ¥15 餐食', onRemove: () => setCheapOnly(false) });
  if (tag !== 'all') activeChips.push({ key: 'tag', label: `标签 · ${tag}`, onRemove: () => setTag('all') });
  if (query.trim()) activeChips.push({ key: 'query', label: `关键词 · ${query.trim()}`, onRemove: () => setQuery('') });
  if (regionId !== cityId) activeChips.push({ key: 'region', label: `区域 · ${regionId === 'nearby' ? '我的附近' : (selectedRegion?.label ?? regionId)}`, onRemove: () => { setRegionId(cityId); setOrigin(undefined); setMovedBbox(undefined); setSelectedId(null); if (sort === 'distance') setSort('price'); } });

  return (
    <main className={`${styles.homeShell} home-shell`}>
      <section className={styles.controlBar} aria-label="搜索和筛选">
        <div className={styles.searchRow}>
          <label className={styles.searchBox}>
            <span aria-hidden="true">⌕</span>
            <input aria-label="搜店名或餐食" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜店名或餐食" />
          </label>
          <RegionPicker catalog={catalog} selectedRegion={selectedRegion} onSelect={chooseRegion} onLocate={locateNearby} onSelectCity={chooseCity} />
          <button type="button" className={styles.resetButton} onClick={resetFilters}>重置</button>
        </div>
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>餐食</span>
          <div className={styles.budgetChips} role="group" aria-label="餐食价格">
            <button type="button" className={cheapOnly ? styles.budgetChipActive : styles.budgetChip} aria-pressed={cheapOnly} onClick={() => setCheapOnly(true)}>仅看 ≤ ¥15</button>
            <button type="button" className={!cheapOnly ? styles.budgetChipActive : styles.budgetChip} aria-pressed={!cheapOnly} onClick={() => setCheapOnly(false)}>全部餐食</button>
          </div>
          <label className={styles.filterControl}>条件<Select variant="bare" value={tag} onChange={setTag} ariaLabel="按条件或标签筛选" options={[{ value: 'all', label: '全部' }, ...availableTags.map((item) => ({ value: item, label: item }))]} /></label>
          <label className={styles.filterControl}>排序<Select variant="bare" value={sort} onChange={(next) => setSort(next as SortMode)} ariaLabel="结果排序" options={[{ value: 'price', label: '最低价优先' }, { value: 'freshness', label: '最近核验' }, { value: 'distance', label: origin ? '附近优先' : '附近优先（先定位）', disabled: !origin }]} /></label>
          <button type="button" className={regionId === 'nearby' ? styles.locateButtonActive : styles.locateButton} aria-pressed={regionId === 'nearby'} onClick={locateNearby}>◎ 我的附近</button>
        </div>
        {activeChips.length > 0 && (
          <div className={styles.activeFilterRow} aria-label="已选筛选">
            {activeChips.map((chip) => (
              <button key={chip.key} type="button" className={styles.activeFilterChip} aria-label={`移除筛选：${chip.label}`} onClick={chip.onRemove}>{chip.label} ×</button>
            ))}
          </div>
        )}
        {locationMessage && <p className={styles.locationNotice} role="status">◎ {locationMessage}</p>}
      </section>

      <div className={`${styles.homeLayout} home-layout`} ref={layoutRef}>
        <section ref={resultsPanelRef} className={`${styles.resultsPanel} results-panel ${styles[`sheet-${mobileListState}`]} ${sheetDragging ? styles.sheetDragging : ''} ${!loading && selected ? styles.hasSelection : ''}`} aria-live="polite" aria-busy={loading}>
          <div className={styles.sheetGrabber} ref={grabberRef} aria-hidden="true" {...grabberProps} />
          {!isPlannedRegion && <RecentStrip />}
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
          {error && <Notice tone="error" className={styles.dataNotice}><span>{error}</span><button type="button" onClick={retry}>重试</button></Notice>}
           {!loading && !error && places.length ? <div className={styles.placeList}>{places.map((place) => <PlaceCard key={place.id} place={place} selected={selected?.id === place.id} onSelect={setSelectedId} distanceLabel={regionId === 'nearby' ? '距你' : '距中心'} />)}</div> : !loading && !error && isPlannedRegion ? <div className={styles.emptyState}><span className={styles.emptyIcon}>＋</span><h3>这里还没有真实饭签</h3><Link className={styles.emptyLink} href="/submit">提交这个区域的第一条 ↗</Link></div> : !loading && !error ? <div className={styles.emptyState}><span className={styles.emptyIcon}>∅</span><h3>这组筛选暂时没饭</h3><button type="button" onClick={() => { setCheapOnly(false); setTag('all'); setQuery(''); }}>看全部餐食</button></div> : null}
          <p className={styles.listNote}>价格来自现场菜单、公开菜单或近期用户核验。<Link href="/about">了解核验规则 ↗</Link></p>
        </section>
        <MapStage places={places} viewport={viewport} selectedId={selected?.id ?? selectedId} onSelect={(id) => { setSelectedId(id); setMobileListState('peek'); }} onSearchViewport={(nextBbox) => setMovedBbox(nextBbox)} userLocation={regionId === 'nearby' ? origin : undefined} />
      </div>
    </main>
  );
}
