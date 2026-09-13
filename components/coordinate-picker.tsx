/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TencentAdapter } from '@/lib/map-adapter';

export type CoordinateValue = { lng: number | null; lat: number | null };

const DEMO_BBOX: [number, number, number, number] = [113.84, 22.46, 114.04, 22.62];

function fixed(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(6) : '';
}

function validNumber(value: string) {
  const number = Number(value);
  return value.trim() !== '' && Number.isFinite(number) ? number : null;
}

export function CoordinatePicker({
  value,
  onChange,
  error,
}: {
  value: CoordinateValue;
  onChange: (next: CoordinateValue) => void;
  error?: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<TencentAdapter | null>(null);
  const onChangeRef = useRef(onChange);
  const [mode, setMode] = useState<'demo' | 'tencent'>('demo');
  const [mapError, setMapError] = useState('');
  const [lngText, setLngText] = useState(fixed(value.lng));
  const [latText, setLatText] = useState(fixed(value.lat));
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setLngText(fixed(value.lng));
    setLatText(fixed(value.lat));
  }, [value.lng, value.lat]);

  useEffect(() => {
    if (!mapRef.current || !TencentAdapter.isConfigured()) return;
    let cancelled = false;
    const adapter = new TencentAdapter();
    adapterRef.current = adapter;
    adapter.initialize(mapRef.current).then(() => {
      if (cancelled) {
        adapter.destroy();
        return;
      }
      setMode('tencent');
      adapter.onMapClick((position) => {
        onChangeRef.current({ lng: Number(position.lng.toFixed(6)), lat: Number(position.lat.toFixed(6)) });
      });
      if (value.lng !== null && value.lat !== null) {
        adapter.setPickerPosition({ lng: value.lng, lat: value.lat });
      }
    }).catch(() => {
      if (!cancelled) {
        setMapError('腾讯底图暂时不可用，已切换为无需密钥的示意底图。');
        setMode('demo');
      }
      adapter.destroy();
    });
    return () => {
      cancelled = true;
      adapter.destroy();
      adapterRef.current = null;
    };
    // The map is initialized once; coordinate changes are handled by the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== 'tencent') return;
    const adapter = adapterRef.current;
    if (!adapter) return;
    if (value.lng === null || value.lat === null) {
      adapter.clearPicker();
      return;
    }
    adapter.setPickerPosition({ lng: value.lng, lat: value.lat });
  }, [mode, value.lng, value.lat]);

  const markerPosition = useMemo(() => {
    if (value.lng === null || value.lat === null) return null;
    const [west, south, east, north] = DEMO_BBOX;
    return {
      left: `${Math.min(96, Math.max(4, ((value.lng - west) / (east - west)) * 100))}%`,
      top: `${Math.min(94, Math.max(6, ((north - value.lat) / (north - south)) * 100))}%`,
    };
  }, [value.lat, value.lng]);

  function setFromMapPoint(clientX: number, clientY: number) {
    const box = mapRef.current?.getBoundingClientRect();
    if (!box || mode !== 'demo') return;
    const x = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    const y = Math.min(1, Math.max(0, (clientY - box.top) / box.height));
    const [west, south, east, north] = DEMO_BBOX;
    onChange({
      lng: Number((west + x * (east - west)).toFixed(6)),
      lat: Number((north - y * (north - south)).toFixed(6)),
    });
  }

  function updateNumber(axis: 'lng' | 'lat', text: string) {
    if (axis === 'lng') setLngText(text);
    else setLatText(text);
    const next = validNumber(text);
    onChange({
      lng: axis === 'lng' ? next : value.lng,
      lat: axis === 'lat' ? next : value.lat,
    });
  }

  function nudge(axis: 'lng' | 'lat', amount: number) {
    const current = value[axis];
    if (current === null) return;
    const next = Number((current + amount).toFixed(6));
    onChange(axis === 'lng' ? { lng: next, lat: value.lat } : { lng: value.lng, lat: next });
  }

  return (
    <fieldset className="coordinate-picker" aria-describedby={error ? 'coordinate-error' : undefined}>
      <legend>地图位置 <span>GCJ-02 · {mode === 'tencent' ? '点击地图落点' : '点击或拖动落点'}</span></legend>
      <div
        ref={mapRef}
        className={`coordinate-map ${mode === 'tencent' ? 'coordinate-map-tencent' : 'coordinate-map-demo'}`}
        role="application"
        aria-label={mode === 'tencent' ? '腾讯地图，点击确认店铺位置' : '示意地图，点击确认店铺位置'}
        onClick={(event) => setFromMapPoint(event.clientX, event.clientY)}
      >
        {mode === 'demo' && <>
          <div className="coordinate-map-grid" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
          <span className="coordinate-map-label coordinate-map-label-one">南山区</span>
          <span className="coordinate-map-label coordinate-map-label-two">点击地图放置位置</span>
        </>}
        {mode === 'demo' && markerPosition && <button
          type="button"
          className={`coordinate-marker ${dragging ? 'coordinate-marker-dragging' : ''}`}
          style={markerPosition}
          aria-label="拖动调整店铺位置"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }}
          onPointerMove={(event) => { if (dragging) setFromMapPoint(event.clientX, event.clientY); }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            setDragging(false);
          }}
          onPointerCancel={() => setDragging(false)}
        ><span>⌖</span></button>}
        <span className="coordinate-map-mode">{mode === 'tencent' ? 'TENCENT / 实时底图' : '示意底图 / 无需密钥'}</span>
      </div>
      <div className="coordinate-fields">
        <label>经度
          <input
            inputMode="decimal"
            value={lngText}
            onChange={(event) => updateNumber('lng', event.target.value)}
            onBlur={() => setLngText(fixed(value.lng))}
            aria-label="经度"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'coordinate-error' : undefined}
            placeholder="113.900000"
          />
        </label>
        <label>纬度
          <input
            inputMode="decimal"
            value={latText}
            onChange={(event) => updateNumber('lat', event.target.value)}
            onBlur={() => setLatText(fixed(value.lat))}
            aria-label="纬度"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'coordinate-error' : undefined}
            placeholder="22.530000"
          />
        </label>
        <div className="coordinate-nudges" aria-label="键盘或按钮微调坐标">
          <button type="button" onClick={() => nudge('lat', 0.000001)} disabled={value.lat === null} aria-label="纬度增加0.000001">纬度＋</button>
          <button type="button" onClick={() => nudge('lat', -0.000001)} disabled={value.lat === null} aria-label="纬度减少0.000001">纬度−</button>
          <button type="button" onClick={() => nudge('lng', -0.000001)} disabled={value.lng === null} aria-label="经度减少0.000001">经度←</button>
          <button type="button" onClick={() => nudge('lng', 0.000001)} disabled={value.lng === null} aria-label="经度增加0.000001">经度→</button>
        </div>
      </div>
      <div className="coordinate-footnote" aria-live="polite">
        <span>坐标系固定为 GCJ-02</span>
        <span>{value.lng === null || value.lat === null ? '尚未落点' : `${fixed(value.lng)}, ${fixed(value.lat)}`}</span>
      </div>
      {(mapError || error) && <p id="coordinate-error" className={error ? 'field-error' : 'field-help'} role={error ? 'alert' : 'status'}>{error || mapError}</p>}
    </fieldset>
  );
}
