'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Notice, type NoticeTone } from '@/components/ui/Notice';
import { Select } from '@/components/ui/Select';

interface Region {
  id: string;
  parentId: string;
  name: string;
  level: 'city' | 'district' | 'business_area';
  centerLng: number;
  centerLat: number;
  bbox: [number, number, number, number];
  zoom: number;
  sortOrder: number;
  active: boolean;
}

interface FormState {
  name: string;
  west: string;
  south: string;
  east: string;
  north: string;
  centerLng: string;
  centerLat: string;
  zoom: string;
  sortOrder: string;
}

function emptyForm(): FormState {
  return {
    name: '',
    west: '',
    south: '',
    east: '',
    north: '',
    centerLng: '',
    centerLat: '',
    zoom: '14',
    sortOrder: '0',
  };
}

function formFromRegion(region: Region): FormState {
  return {
    name: region.name,
    west: String(region.bbox[0]),
    south: String(region.bbox[1]),
    east: String(region.bbox[2]),
    north: String(region.bbox[3]),
    centerLng: String(region.centerLng),
    centerLat: String(region.centerLat),
    zoom: String(region.zoom),
    sortOrder: String(region.sortOrder),
  };
}

async function csrf() {
  const response = await fetch('/api/v1/admin/csrf');
  if (!response.ok) throw new Error('SESSION_EXPIRED');
  return (await response.json()).csrfToken as string;
}

export function RegionManager() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cityId, setCityId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string }>({
    tone: 'info',
    message: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/admin/regions');
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error?.message || '加载区域失败');
      const data = (body.data ?? []) as Region[];
      setRegions(data);
      setCityId((current) => current || data.find((r) => r.level === 'city')?.id || '');
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '加载区域失败',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const cities = useMemo(
    () => regions.filter((region) => region.level === 'city'),
    [regions],
  );
  const districts = useMemo(
    () =>
      regions.filter(
        (region) => region.level === 'district' && region.parentId === cityId,
      ),
    [regions, cityId],
  );
  const areas = useMemo(
    () =>
      regions
        .filter(
          (region) =>
            region.level === 'business_area' && region.parentId === districtId,
        )
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [regions, districtId],
  );
  const selectedDistrict = districts.find((district) => district.id === districtId);

  function pickCity(nextCityId: string) {
    setCityId(nextCityId);
    setDistrictId('');
    setEditingId(null);
    setForm(emptyForm());
  }

  function pickDistrict(nextDistrictId: string) {
    setDistrictId(nextDistrictId);
    setEditingId(null);
    const district = regions.find((region) => region.id === nextDistrictId);
    setForm(
      district
        ? {
            ...emptyForm(),
            west: String(district.bbox[0]),
            south: String(district.bbox[1]),
            east: String(district.bbox[2]),
            north: String(district.bbox[3]),
            centerLng: String(district.centerLng),
            centerLat: String(district.centerLat),
          }
        : emptyForm(),
    );
  }

  function editArea(region: Region) {
    setEditingId(region.id);
    setForm(formFromRegion(region));
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function save() {
    if (busy) return;
    if (!districtId) {
      setNotice({ tone: 'error', message: '请先选择行政区' });
      return;
    }
    setBusy(true);
    setNotice({ tone: 'info', message: editingId ? '正在保存修改…' : '正在新增商圈…' });
    const payload = {
      name: form.name.trim(),
      centerLng: Number(form.centerLng),
      centerLat: Number(form.centerLat),
      bbox: [Number(form.west), Number(form.south), Number(form.east), Number(form.north)],
      zoom: Number(form.zoom),
      sortOrder: Number(form.sortOrder),
    };
    try {
      const token = await csrf();
      const response = await fetch(
        editingId ? `/api/v1/admin/regions/${editingId}` : '/api/v1/admin/regions',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json', 'x-csrf-token': token },
          body: JSON.stringify(
            editingId ? payload : { ...payload, level: 'business_area', parentId: districtId },
          ),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error?.message || '保存失败，区域未改变');
      setNotice({ tone: 'success', message: editingId ? '商圈已更新' : '商圈已新增' });
      cancelEdit();
      await load();
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '保存失败，区域未改变',
      });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(region: Region) {
    if (busy) return;
    setBusy(true);
    try {
      const token = await csrf();
      const response = await fetch(`/api/v1/admin/regions/${region.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({ active: !region.active }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error?.message || '状态未改变');
      setNotice({
        tone: 'success',
        message: region.active ? '商圈已停用（不再出现在选择器）' : '商圈已重新启用',
      });
      await load();
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '状态未改变',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="region-manager">
      <div className="region-manager-picker">
        <label>
          城市
          <Select
            value={cityId}
            onChange={pickCity}
            ariaLabel="城市"
            options={cities.map((city) => ({ value: city.id, label: city.name }))}
          />
        </label>
        <label>
          行政区
          <Select
            value={districtId}
            onChange={pickDistrict}
            ariaLabel="行政区"
            placeholder="请选择行政区"
            options={districts.map((district) => ({ value: district.id, label: district.name }))}
          />
        </label>
      </div>

      {notice.message && <Notice tone={notice.tone}>{notice.message}</Notice>}

      {loading ? (
        <p className="creator-import-hint">加载中…</p>
      ) : !districts.length ? (
        <div className="region-no-result">
          <strong>该城市还没有行政区</strong>
          <span>行政区目录尚未整理，暂不能新增商圈。</span>
        </div>
      ) : !districtId ? (
        <p className="creator-import-hint">尚未选择行政区。</p>
      ) : (
        <div className="region-manager-grid">
          <div className="region-manager-list">
            {areas.length === 0 && (
              <p className="creator-import-hint">
                {selectedDistrict?.name} 还没有商圈。
              </p>
            )}
            {areas.map((area) => (
              <div
                key={area.id}
                className={`region-manager-row ${area.active ? '' : 'inactive'}`}
              >
                <div>
                  <strong>{area.name}</strong>
                  <small>
                    bbox {area.bbox.map((value) => value.toFixed(3)).join(', ')}
                  </small>
                  <small>
                    中心 {area.centerLng.toFixed(4)}, {area.centerLat.toFixed(4)} ·
                    zoom {area.zoom} · 排序 {area.sortOrder}
                  </small>
                </div>
                <div className="region-manager-actions">
                  <span className={`creator-import-badge badge-${area.active ? 'ready' : 'invalid'}`}>
                    {area.active ? '启用' : '已停用'}
                  </span>
                  <button className="row-action" type="button" disabled={busy} onClick={() => editArea(area)}>
                    编辑
                  </button>
                  <button className="row-action" type="button" disabled={busy} onClick={() => toggleActive(area)}>
                    {area.active ? '停用' : '启用'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form
            className="region-manager-form"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <h2>{editingId ? '编辑商圈' : '新增商圈'}</h2>
            <label>
              名称
              <input value={form.name} required onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <div className="region-manager-bbox">
              <label>
                西
                <input value={form.west} inputMode="decimal" required onChange={(event) => setForm({ ...form, west: event.target.value })} />
              </label>
              <label>
                南
                <input value={form.south} inputMode="decimal" required onChange={(event) => setForm({ ...form, south: event.target.value })} />
              </label>
              <label>
                东
                <input value={form.east} inputMode="decimal" required onChange={(event) => setForm({ ...form, east: event.target.value })} />
              </label>
              <label>
                北
                <input value={form.north} inputMode="decimal" required onChange={(event) => setForm({ ...form, north: event.target.value })} />
              </label>
            </div>
            <div className="region-manager-bbox">
              <label>
                中心经度
                <input value={form.centerLng} inputMode="decimal" required onChange={(event) => setForm({ ...form, centerLng: event.target.value })} />
              </label>
              <label>
                中心纬度
                <input value={form.centerLat} inputMode="decimal" required onChange={(event) => setForm({ ...form, centerLat: event.target.value })} />
              </label>
            </div>
            <div className="region-manager-bbox">
              <label>
                缩放
                <input value={form.zoom} inputMode="numeric" onChange={(event) => setForm({ ...form, zoom: event.target.value })} />
              </label>
              <label>
                排序
                <input value={form.sortOrder} inputMode="numeric" onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
              </label>
            </div>
            <div className="region-manager-actions">
              <button className="primary-button small-button" type="submit" disabled={busy}>
                {busy ? '保存中…' : editingId ? '保存修改' : '新增商圈'}
              </button>
              {editingId && (
                <button className="secondary-button small-button" type="button" onClick={cancelEdit}>
                  取消编辑
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
