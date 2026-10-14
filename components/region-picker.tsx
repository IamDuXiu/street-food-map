'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { ShenzhenRegion, ShenzhenRegionCatalog } from '@/lib/regions';
import { prefersReducedMotion, springTo, type SpringHandle } from '@/lib/motion';

let anchoredQuery: MediaQueryList | null = null;
/** Only the desktop dialog grows from its trigger; the mobile picker is a full-screen view. */
function dialogIsAnchored(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  anchoredQuery ??= window.matchMedia('(min-width: 621px)');
  return anchoredQuery.matches;
}

function dialogScale(progress: number): number {
  return dialogIsAnchored() ? 0.94 + 0.06 * progress : 1;
}

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
      {region.coverage === 'live' ? '已有饭签' : '暂无饭签'}
    </span>
  );
}

export function RegionPicker({
  catalog,
  selectedRegion,
  onSelect,
  onLocate,
  onSelectCity,
}: {
  catalog: ShenzhenRegionCatalog;
  selectedRegion: ShenzhenRegion | null;
  onSelect: (region: ShenzhenRegion) => void;
  onLocate: () => void;
  onSelectCity?: (cityId: string, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
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
  const springRef = useRef<SpringHandle | null>(null);

  // Set the opening state in the commit phase so the material never flashes at full size.
  const setDialogNode = useCallback((node: HTMLElement | null) => {
    dialogRef.current = node;
    if (!node) return;
    node.style.transform = `scale(${dialogScale(0)})`;
    node.style.opacity = '0';
  }, []);

  // Materialize from the trigger: anchor the origin to the element that opened it,
  // so the spatial relationship between button and content is obvious.
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = triggerRef.current?.getBoundingClientRect();
    const rect = dialog.getBoundingClientRect();
    if (trigger && rect.width > 0 && rect.height > 0) {
      dialog.style.transformOrigin = `${trigger.left + trigger.width / 2 - rect.left}px ${trigger.top + trigger.height / 2 - rect.top}px`;
    }
    springRef.current?.stop();
    springRef.current = springTo(0, 1, {
      damping: 1,
      response: 0.32,
      onUpdate: (value) => {
        dialog.style.transform = `scale(${dialogScale(value)})`;
        dialog.style.opacity = String(value);
      },
    });
    return () => { springRef.current?.stop(); springRef.current = null; };
  }, [open]);

  const finishClose = useCallback(() => {
    springRef.current?.stop();
    springRef.current = null;
    // Only take focus back if the user has not already moved on somewhere else.
    const active = typeof document === 'undefined' ? null : document.activeElement;
    const restoreFocus = active === null || active === document.body || Boolean(dialogRef.current?.contains(active));
    setClosing(false);
    setQuery('');
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Mirror the outbound path back onto the inbound one.
  const requestClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || prefersReducedMotion()) { finishClose(); return; }
    // The closing material must never intercept input: the next tap belongs to the page.
    setClosing(true);
    springRef.current?.stop();
    springRef.current = springTo(1, 0, {
      damping: 1,
      response: 0.2,
      onUpdate: (value) => {
        dialog.style.transform = `scale(${dialogScale(value)})`;
        dialog.style.opacity = String(value);
      },
      onRest: finishClose,
    });
  }, [finishClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    searchRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        requestClose();
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
  }, [open, requestClose]);

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
    requestClose();
  }

  function locate() {
    onLocate();
    requestClose();
  }

  function closePicker() {
    requestClose();
  }

  function openPicker() {
    // Supersede any in-flight dismissal so its completion cannot close the new opening.
    springRef.current?.stop();
    springRef.current = null;
    const district = districtForRegion(catalog, selectedRegion?.id ?? '');
    if (district) {
      setActiveDistrictId(district.id);
      setActiveDirectoryId(district.id);
    } else {
      setActiveDirectoryId(selectedRegion?.id === catalog.city.id ? 'city' : 'nearby');
    }
    setClosing(false);
    setOpen(true);
  }

  /**
   * The surface grows from its trigger, so while it is still arriving the pointer can
   * land on the scrim even though the user aimed at the panel. A press inside the panel's
   * layout box must never dismiss it — otherwise the first tap on a rail item closes the sheet.
   */
  function handleBackdropMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    const dialog = dialogRef.current;
    const backdrop = event.currentTarget;
    if (dialog) {
      const box = backdrop.getBoundingClientRect();
      const left = box.left + dialog.offsetLeft;
      const top = box.top + dialog.offsetTop;
      const inside = event.clientX >= left && event.clientX <= left + dialog.offsetWidth
        && event.clientY >= top && event.clientY <= top + dialog.offsetHeight;
      if (inside) return;
    }
    requestClose();
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
        <div className={`region-picker-backdrop ${closing ? 'region-picker-backdrop-closing' : ''}`} onMouseDown={handleBackdropMouseDown}>
          <section
            ref={setDialogNode}
            className="region-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="region-picker-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="region-picker-header">
              <div>
                <p className="kicker">区域目录</p>
                <h2 id="region-picker-title">选一个吃饭范围</h2>
                <div className="region-city-context" role="group" aria-label="当前城市">
                  <span className="region-city-context-label">当前城市</span>
                  <strong>{catalog.city.label}</strong>
                </div>
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

            {catalog.cities && catalog.cities.length > 1 && onSelectCity && (
              <div className="region-city-switch" role="group" aria-label="切换城市">
                <span className="region-city-switch-label">城市</span>
                <div className="region-city-switch-options">
                  {catalog.cities.map((city) => (
                    <button
                      key={city.id}
                      type="button"
                      className={city.id === catalog.city.id ? 'active' : ''}
                      aria-pressed={city.id === catalog.city.id}
                      onClick={() => {
                        onSelectCity(city.id, city.label);
                        closePicker();
                      }}
                    >
                      {city.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                  </div>
                )}
              </div>
            ) : catalog.districts.length === 0 ? (
              <div className="region-no-result">
                <strong>目录整理中</strong>
              </div>
            ) : (
              <div className="region-browser">
                <nav aria-label={`${catalog.city.label}行政区`} className="district-rail">
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
                      <span className="district-scope-mark" aria-hidden="true">{catalog.city.label.slice(0, 1)}</span>
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
          </section>
        </div>
      )}
    </>
  );
}
