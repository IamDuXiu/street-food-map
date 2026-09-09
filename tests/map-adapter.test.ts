import { describe, expect, it } from 'vitest';
import { DemoMapAdapter, TencentAdapter } from '@/lib/map-adapter';
import { PLACES, VIEWPORTS } from '@/lib/fixtures';

describe('DemoMapAdapter', () => {
  it('无需密钥即可按旧样板区或新地图边界返回可见点位并记住选择', () => {
    const adapter = new DemoMapAdapter();
    expect(adapter.mode).toBe('demo');
    expect(adapter.getVisiblePlaces(PLACES).every((place) => place.zoneId === 'sz university')).toBe(true);
    adapter.setViewport(VIEWPORTS[1]);
    adapter.selectPlace('kexing-b1-foodcourt');
    expect(adapter.getVisiblePlaces(PLACES)).toHaveLength(5);
    expect(adapter.selection).toBe('kexing-b1-foodcourt');
  });
});

describe('TencentAdapter', () => {
  it('使用腾讯纬度、经度顺序，支持点位点击、地图点击、视野边界和清理', async () => {
    const originalMode = process.env.NEXT_PUBLIC_MAP_MODE;
    const originalKey = process.env.NEXT_PUBLIC_TENCENT_MAP_KEY;
    const originalWindow = (globalThis as unknown as { window?: unknown }).window;
    class FakeLatLng {
      constructor(private readonly lat: number, private readonly lng: number) {}
      getLng() { return this.lng; }
      getLat() { return this.lat; }
    }
    class FakeLayer {
      handlers = new Map<string, (event: unknown) => void>();
      options: Record<string, unknown>;
      detached = false;
      constructor(options: Record<string, unknown>) { this.options = options; }
      on(event: string, handler: (event: unknown) => void) { this.handlers.set(event, handler); }
      off(event: string, handler: (event: unknown) => void) { if (this.handlers.get(event) === handler) this.handlers.delete(event); }
      setMap(map: FakeMap | null) { this.detached = map === null; }
      setGeometries(geometries: Array<Record<string, unknown>>) { this.options.geometries = geometries; }
      emit(event: string, payload: unknown) { this.handlers.get(event)?.(payload); }
    }
    class FakeMap {
      handlers = new Map<string, (event: unknown) => void>();
      center: FakeLatLng | null = null;
      constructor(_container: HTMLElement, options: { center?: FakeLatLng }) { this.center = options.center ?? null; }
      setZoom() {}
      setCenter(center: FakeLatLng) { this.center = center; }
      getBounds() { return { getSouthWest: () => new FakeLatLng(22.5, 113.9), getNorthEast: () => new FakeLatLng(22.6, 114) }; }
      on(event: string, handler: (event: unknown) => void) { this.handlers.set(event, handler); }
      off(event: string, handler: (event: unknown) => void) { if (this.handlers.get(event) === handler) this.handlers.delete(event); }
      emit(event: string, payload: unknown) { this.handlers.get(event)?.(payload); }
      destroy() {}
    }
    const fakeWindow = {
      TMap: {
        Map: FakeMap,
        LatLng: FakeLatLng,
        MarkerStyle: class { constructor(public readonly options: Record<string, unknown>) {} },
        MultiMarker: class extends FakeLayer { constructor(options: Record<string, unknown>) { super(options); } },
      },
    };
    process.env.NEXT_PUBLIC_MAP_MODE = 'tencent';
    process.env.NEXT_PUBLIC_TENCENT_MAP_KEY = 'test-key';
    Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: fakeWindow });
    try {
      const adapter = await new TencentAdapter().initialize({} as HTMLElement);
      const map = (adapter as unknown as { map: FakeMap }).map;
      expect(map.center?.getLat()).toBe(22.526639);
      expect(map.center?.getLng()).toBe(113.933073);

      const selected: string[] = [];
      adapter.renderPlaces(PLACES.slice(0, 2), (id) => selected.push(id));
      const layer = (adapter as unknown as { markerLayer: FakeLayer }).markerLayer;
      layer.emit('click', { geometry: { id: PLACES[1].id } });
      expect(selected).toEqual([PLACES[1].id]);
      adapter.renderPlaces(PLACES.slice(0, 2), (id) => selected.push(id), PLACES[1].id);
      const selectedLayer = (adapter as unknown as { markerLayer: FakeLayer }).markerLayer;
      const selectedGeometry = (selectedLayer.options.geometries as Array<{ id: string; styleId: string }>).find((item) => item.id === PLACES[1].id);
      expect(selectedGeometry?.styleId).toContain('-selected');
      expect(adapter.getBounds()).toEqual([113.9, 22.5, 114, 22.6]);

      const clicked: Array<{ lng: number; lat: number }> = [];
      const removeClick = adapter.onMapClick((position) => clicked.push(position));
      map.emit('click', { latLng: new FakeLatLng(22.51, 113.91) });
      expect(clicked).toEqual([{ lng: 113.91, lat: 22.51 }]);
      removeClick();

      adapter.setPickerPosition({ lng: 113.92, lat: 22.52 });
      const picker = (adapter as unknown as { pickerLayer: FakeLayer }).pickerLayer;
      expect((picker.options.geometries as Array<{ position: FakeLatLng }>)[0].position.getLat()).toBe(22.52);
      adapter.setPickerPosition({ lng: 113.93, lat: 22.53 });
      expect((picker.options.geometries as Array<{ position: FakeLatLng }>)[0].position.getLng()).toBe(113.93);

      adapter.clearMarkers();
      expect(layer.detached).toBe(true);
      adapter.destroy();
      expect(picker.detached).toBe(true);
    } finally {
      if (originalMode === undefined) delete process.env.NEXT_PUBLIC_MAP_MODE;
      else process.env.NEXT_PUBLIC_MAP_MODE = originalMode;
      if (originalKey === undefined) delete process.env.NEXT_PUBLIC_TENCENT_MAP_KEY;
      else process.env.NEXT_PUBLIC_TENCENT_MAP_KEY = originalKey;
      if (originalWindow === undefined) delete (globalThis as unknown as { window?: unknown }).window;
      else Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: originalWindow });
    }
  });

  it('脚本加载失败时拒绝初始化，供页面回退示意地图并允许重试', async () => {
    const originalMode = process.env.NEXT_PUBLIC_MAP_MODE;
    const originalKey = process.env.NEXT_PUBLIC_TENCENT_MAP_KEY;
    const originalWindow = (globalThis as unknown as { window?: unknown }).window;
    const originalDocument = (globalThis as unknown as { document?: unknown }).document;
    const script = { src: '', async: false, onload: null as (() => void) | null, onerror: null as (() => void) | null };
    let appendCount = 0;
    const fakeDocument = { createElement: () => script, head: { appendChild: () => { appendCount += 1; queueMicrotask(() => script.onerror?.()); } } };
    process.env.NEXT_PUBLIC_MAP_MODE = 'tencent';
    process.env.NEXT_PUBLIC_TENCENT_MAP_KEY = 'test-key';
    Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: { setTimeout, clearTimeout } });
    Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: fakeDocument });
    try {
      await expect(new TencentAdapter().initialize({} as HTMLElement)).rejects.toThrow('TENCENT_LOAD_FAILED');
      expect(script.src).toContain('https://map.qq.com/api/gljs?v=1.exp&key=');
      await expect(new TencentAdapter().initialize({} as HTMLElement)).rejects.toThrow('TENCENT_LOAD_FAILED');
      expect(appendCount).toBe(2);
    } finally {
      if (originalMode === undefined) delete process.env.NEXT_PUBLIC_MAP_MODE;
      else process.env.NEXT_PUBLIC_MAP_MODE = originalMode;
      if (originalKey === undefined) delete process.env.NEXT_PUBLIC_TENCENT_MAP_KEY;
      else process.env.NEXT_PUBLIC_TENCENT_MAP_KEY = originalKey;
      if (originalWindow === undefined) delete (globalThis as unknown as { window?: unknown }).window;
      else Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: originalWindow });
      if (originalDocument === undefined) delete (globalThis as unknown as { document?: unknown }).document;
      else Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: originalDocument });
    }
  });

  it('销毁等待中的旧实例后不会创建或销毁新实例的地图', async () => {
    const originalMode = process.env.NEXT_PUBLIC_MAP_MODE;
    const originalKey = process.env.NEXT_PUBLIC_TENCENT_MAP_KEY;
    const originalWindow = (globalThis as unknown as { window?: unknown }).window;
    const originalDocument = (globalThis as unknown as { document?: unknown }).document;
    const script = { src: '', async: false, onload: null as (() => void) | null, onerror: null as (() => void) | null };
    let mapCreated = 0;
    let mapDestroyed = 0;
    class FakeMap {
      constructor(_container: HTMLElement, _options: Record<string, unknown>) { mapCreated += 1; }
      setZoom() {}
      setCenter() {}
      getBounds() { return { getSouthWest: () => ({ getLng: () => 113.9, getLat: () => 22.5 }), getNorthEast: () => ({ getLng: () => 114, getLat: () => 22.6 }) }; }
      on() {}
      off() {}
      destroy() { mapDestroyed += 1; }
    }
    const fakeTMap = {
      Map: FakeMap,
      LatLng: class { constructor(private readonly lat: number, private readonly lng: number) {} getLat() { return this.lat; } getLng() { return this.lng; } },
      MarkerStyle: class { constructor(public readonly options: Record<string, unknown>) {} },
      MultiMarker: class { on() {} off() {} setMap() {} setGeometries() {} },
    };
    let appendCount = 0;
    const fakeDocument = { createElement: () => script, head: { appendChild: () => { appendCount += 1; } } };
    const fakeWindow = { setTimeout, clearTimeout };
    process.env.NEXT_PUBLIC_MAP_MODE = 'tencent';
    process.env.NEXT_PUBLIC_TENCENT_MAP_KEY = 'test-key';
    Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: fakeWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: fakeDocument });
    try {
      const container = {} as HTMLElement;
      const first = new TencentAdapter();
      const firstInitialization = first.initialize(container);
      first.destroy();
      const second = new TencentAdapter();
      const secondInitialization = second.initialize(container);
      expect(appendCount).toBe(1);

      (fakeWindow as typeof fakeWindow & { TMap: typeof fakeTMap }).TMap = fakeTMap;
      script.onload?.();
      await expect(firstInitialization).rejects.toThrow('TENCENT_INITIALIZE_CANCELLED');
      await secondInitialization;
      expect(mapCreated).toBe(1);
      expect(mapDestroyed).toBe(0);
      second.destroy();
      expect(mapDestroyed).toBe(1);
    } finally {
      if (originalMode === undefined) delete process.env.NEXT_PUBLIC_MAP_MODE;
      else process.env.NEXT_PUBLIC_MAP_MODE = originalMode;
      if (originalKey === undefined) delete process.env.NEXT_PUBLIC_TENCENT_MAP_KEY;
      else process.env.NEXT_PUBLIC_TENCENT_MAP_KEY = originalKey;
      if (originalWindow === undefined) delete (globalThis as unknown as { window?: unknown }).window;
      else Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: originalWindow });
      if (originalDocument === undefined) delete (globalThis as unknown as { document?: unknown }).document;
      else Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: originalDocument });
    }
  });

  it('没有 Tencent mode 或 Key 时保持不可用并可由上层回退 Demo', () => {
    const originalMode = process.env.NEXT_PUBLIC_MAP_MODE;
    const originalKey = process.env.NEXT_PUBLIC_TENCENT_MAP_KEY;
    const originalWindow = (globalThis as unknown as { window?: unknown }).window;
    Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: {} });
    delete process.env.NEXT_PUBLIC_MAP_MODE;
    delete process.env.NEXT_PUBLIC_TENCENT_MAP_KEY;
    expect(TencentAdapter.isConfigured()).toBe(false);
    if (originalMode === undefined) delete process.env.NEXT_PUBLIC_MAP_MODE;
    else process.env.NEXT_PUBLIC_MAP_MODE = originalMode;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_TENCENT_MAP_KEY;
    else process.env.NEXT_PUBLIC_TENCENT_MAP_KEY = originalKey;
    if (originalWindow === undefined) delete (globalThis as unknown as { window?: unknown }).window;
    else Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: originalWindow });
  });
});
