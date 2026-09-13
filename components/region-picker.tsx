'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ShenzhenRegion, ShenzhenRegionCatalog } from '@/lib/regions';

function districtForRegion(
  catalog: ShenzhenRegionCatalog,
  regionId: string,
) {
  return catalog.districts.find(
    (district) =>
      district.id === regionId ||
      district.businessAreas.some((area) => area.id === regionId),
  );
}

function CoverageBadge({ region }: { region: ShenzhenRegion }) {
  return (
    <span
      className={`region-status ${region.coverage === 'live' ? 'region-status-live' : ''}`}
    >
      {region.coverage === 'live' ? '已有饭签' : '待共建'}
    </span>
  );
}

export function RegionPicker({
  catalog,
  selectedRegion,
  onSelect,
  onLocate,
}: {
  catalog: ShenzhenRegionCatalog;
  selectedRegion: ShenzhenRegion | null;
  onSelect: (region: ShenzhenRegion) => void;
  onLocate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeDistrictId, setActiveDistrictId] = useState(
    () => districtForRegion(catalog, selectedRegion?.id ?? '')?.id ?? 'nanshan',
  );
  const [activeDirectoryId, setActiveDirectoryId] = useState(
    () => selectedRegion?.id ?? 'nearby',
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    searchRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const activeDistrict =
    catalog.districts.find((district) => district.id === activeDistrictId) ??
    catalog.districts[0];
  const searchResults = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-CN');
    if (!keyword) return [];
    return catalog.districts.flatMap((district) => [
      district,
      ...district.businessAreas,
    ]).filter((region) => region.label.toLocaleLowerCase('zh-CN').includes(keyword));
  }, [catalog, query]);

  function choose(region: ShenzhenRegion) {
    onSelect(region);
    setQuery('');
    setOpen(false);
    triggerRef.current?.focus();
  }

  function locate() {
    onLocate();
    setQuery('');
    setOpen(false);
    triggerRef.current?.focus();
  }

  function closePicker() {
    setQuery('');
    setOpen(false);
    triggerRef.current?.focus();
  }

  function openPicker() {
    const district = districtForRegion(catalog, selectedRegion?.id ?? '');
    if (district) {
      setActiveDistrictId(district.id);
      setActiveDirectoryId(district.id);
    } else {
      setActiveDirectoryId(selectedRegion?.id === catalog.city.id ? 'city' : 'nearby');
    }
    setOpen(true);
  }

  const currentLabel = selectedRegion?.label ?? '我的附近';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="region-trigger"
        aria-label={`选择区域，当前${currentLabel}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPicker}
      >
        <span className="region-trigger-mark" aria-hidden="true">⌖</span>
        <span className="region-trigger-copy">
          <small>当前区域</small>
          <strong>{currentLabel}</strong>
        </span>
        <span className="region-trigger-chevron" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div className="region-picker-backdrop" onMouseDown={closePicker}>
          <section
            ref={dialogRef}
            className="region-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="region-picker-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="region-picker-header">
              <div>
                <p className="kicker">深圳 / 区域目录</p>
                <h2 id="region-picker-title">选一个吃饭范围</h2>
              </div>
              <button
                type="button"
                className="region-picker-close"
                aria-label="关闭区域选择"
                onClick={closePicker}
              >
                ×
              </button>
            </header>

            <div className="region-city-context" role="group" aria-label="当前城市">
              <span className="region-city-context-label">当前城市</span>
              <strong>{catalog.city.label}</strong>
              <span className="region-city-context-note">区域目录</span>
            </div>

            <label className="region-search">
              <span aria-hidden="true">⌕</span>
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="搜索行政区或商圈"
                placeholder="搜索行政区或商圈，例如：科技园"
              />
            </label>

            {query.trim() ? (
              <div className="region-search-results" aria-live="polite">
                <p className="region-section-label">搜索结果 · {searchResults.length}</p>
                {searchResults.length ? (
                  searchResults.map((region) => (
                    <button key={region.id} type="button" onClick={() => choose(region)}>
                      <span>
                        <strong>{region.label}</strong>
                        <small>
                          {region.level === 'district'
                            ? '行政区'
                            : `${catalog.districts.find((item) => item.id === region.districtId)?.label ?? ''} · 商圈`}
                        </small>
                      </span>
                      <CoverageBadge region={region} />
                    </button>
                  ))
                ) : (
                  <div className="region-no-result">
                    <strong>还没有这个区域</strong>
                    <span>目前先覆盖深圳市行政区和首批常用商圈。</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="region-browser">
                <nav aria-label="深圳行政区" className="district-rail">
                  <div className="district-rail-scope">
                    <button
                      type="button"
                      className={`district-scope-button ${activeDirectoryId === 'nearby' ? 'active' : ''}`}
                      aria-current={activeDirectoryId === 'nearby' ? 'true' : undefined}
                      onClick={locate}
                    >
                      <span className="district-scope-mark" aria-hidden="true">◎</span>
                      <span>
                        <strong>我的附近</strong>
                        <small>使用当前位置</small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`district-scope-button ${activeDirectoryId === 'city' ? 'active' : ''}`}
                      aria-current={activeDirectoryId === 'city' ? 'true' : undefined}
                      onClick={() => choose(catalog.city)}
                    >
                      <span className="district-scope-mark" aria-hidden="true">深</span>
                      <span>
                        <strong>全城</strong>
                        <small>查看全部饭签</small>
                      </span>
                    </button>
                  </div>
                  <div className="district-rail-divider" aria-hidden="true" />
                  {catalog.districts.map((district) => (
                    <button
                      key={district.id}
                      type="button"
                      className={activeDirectoryId === district.id ? 'active' : ''}
                      aria-current={activeDirectoryId === district.id ? 'true' : undefined}
                      onClick={() => {
                        setActiveDirectoryId(district.id);
                        setActiveDistrictId(district.id);
                      }}
                    >
                      {district.label}
                      {district.coverage === 'live' && <span aria-label="已有饭签" />}
                    </button>
                  ))}
                </nav>
                <div className="business-area-list">
                  <p className="region-section-label">{activeDistrict.label} / 商圈</p>
                  <button
                    type="button"
                    className="business-area-all"
                    onClick={() => choose(activeDistrict)}
                  >
                    <span><strong>查看{activeDistrict.label}全区</strong><small>{activeDistrict.subtitle}</small></span>
                    <CoverageBadge region={activeDistrict} />
                  </button>
                  <div className="business-area-grid">
                    {activeDistrict.businessAreas.map((businessArea) => (
                      <button
                        key={businessArea.id}
                        type="button"
                        onClick={() => choose(businessArea)}
                      >
                        <strong>{businessArea.label}</strong>
                        <CoverageBadge region={businessArea} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <footer className="region-picker-footer">
              行政区用于导航；商圈是便于找饭的近似范围，会随数据逐步调整。
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
