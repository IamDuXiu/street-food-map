'use client';

import { useState } from 'react';
import { Notice, type NoticeTone } from '@/components/ui/Notice';

interface PreviewRow {
  index: number;
  status: 'ready' | 'needs_coordinates' | 'invalid';
  storeName: string;
  mealName: string;
  city: string;
  lng?: number;
  lat?: number;
  geocodeCandidates?: Array<{ lng: number; lat: number; title?: string }>;
  matchedPlaceId?: string | null;
  errors: string[];
}

const SAMPLE = '[]';

async function csrf() {
  const response = await fetch('/api/v1/admin/csrf');
  if (!response.ok) throw new Error('SESSION_EXPIRED');
  return (await response.json()).csrfToken as string;
}

export function CreatorImportWorkbench() {
  const [raw, setRaw] = useState(SAMPLE);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [coords, setCoords] = useState<
    Record<number, { lng: number; lat: number }>
  >({});
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string }>({
    tone: 'info',
    message: '',
  });
  const [busy, setBusy] = useState(false);

  function parseRaw(): Record<string, unknown>[] {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new Error('顶层必须是 JSON 数组');
    return parsed as Record<string, unknown>[];
  }

  function applyCoords(next: PreviewRow[]) {
    const seeded: Record<number, { lng: number; lat: number }> = {};
    for (const row of next)
      if (row.lng !== undefined && row.lat !== undefined)
        seeded[row.index] = { lng: row.lng, lat: row.lat };
    setCoords(seeded);
  }

  async function preview() {
    if (busy) return;
    setBusy(true);
    setNotice({ tone: 'info', message: '正在校验并解析地址…' });
    try {
      const parsed = parseRaw();
      setRecords(parsed);
      const response = await fetch('/api/v1/admin/creator-import/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ records: parsed }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error?.message || '预览失败，请检查 JSON');
      const nextRows = (body.data?.rows ?? []) as PreviewRow[];
      setRows(nextRows);
      applyCoords(nextRows);
      const ready = nextRows.filter((row) => row.status === 'ready').length;
      setNotice({
        tone: body.data?.valid ? 'success' : 'error',
        message: body.data?.valid
          ? `${ready} 条就绪，可以导入`
          : `${nextRows.length - ready} 条待处理（缺坐标或字段非法）`,
      });
    } catch (error) {
      setRows([]);
      setRecords([]);
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'JSON 无法解析',
      });
    } finally {
      setBusy(false);
    }
  }

  async function geocodeRow(index: number) {
    const address = String(records[index]?.address ?? '').trim();
    if (!address) {
      setNotice({ tone: 'error', message: '该记录没有地址，请先补充' });
      return;
    }
    setBusy(true);
    setNotice({ tone: 'info', message: `正在解析：${address}` });
    try {
      const response = await fetch('/api/v1/admin/geocode', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error('地址解析失败');
      const candidates = (body.data?.candidates ?? []) as Array<{
        lng: number;
        lat: number;
      }>;
      setRows((current) =>
        current.map((row) =>
          row.index === index ? { ...row, geocodeCandidates: candidates } : row,
        ),
      );
      if (!candidates.length)
        setNotice({
          tone: 'error',
          message: body.data?.hasKey
            ? '未解析到坐标，请手动填写'
            : '未配置地理编码 Key，请手动填写坐标',
        });
      else if (candidates.length === 1) {
        setCoords((current) => ({
          ...current,
          [index]: { lng: candidates[0].lng, lat: candidates[0].lat },
        }));
        setNotice({ tone: 'success', message: '已填入候选坐标，请核对后导入' });
      } else setNotice({ tone: 'success', message: '请选择候选坐标' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '地址解析失败',
      });
    } finally {
      setBusy(false);
    }
  }

  function setRowCoord(index: number, key: 'lng' | 'lat', value: string) {
    if (value === '') return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    setCoords((current) => {
      const previous = current[index] ?? { lng: 0, lat: 0 };
      return { ...current, [index]: { ...previous, [key]: numeric } };
    });
  }

  const allReady =
    rows.length > 0 &&
    rows.every(
      (row) =>
        row.status !== 'invalid' &&
        coords[row.index]?.lng !== undefined &&
        coords[row.index]?.lat !== undefined,
    );

  async function commit() {
    if (busy || !allReady) return;
    setBusy(true);
    setNotice({ tone: 'info', message: '正在导入…' });
    try {
      const payload = records.map((record, index) => ({
        ...record,
        ...(coords[index] ? { lng: coords[index].lng, lat: coords[index].lat } : {}),
      }));
      const token = await csrf();
      const response = await fetch('/api/v1/admin/creator-import/commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({ records: payload }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error?.message || '导入失败，数据未改变');
      setNotice({
        tone: 'success',
        message: `已导入 ${body.data?.imported ?? 0} 条（新建门店 ${body.data?.created ?? 0} 个）`,
      });
      setRows([]);
      setRecords([]);
      setCoords({});
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '导入失败，数据未改变',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="creator-import-panel">
      <label className="creator-import-field">
        创作者内容（JSON 数组）
        <textarea
          className="creator-import-textarea"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          spellCheck={false}
          aria-label="创作者内容 JSON"
        />
      </label>
      <div className="creator-import-toolbar">
        <button className="primary-button small-button" type="button" onClick={preview} disabled={busy}>
          {busy ? '处理中…' : '预览校验'}
        </button>
      </div>
      {notice.message && <Notice tone={notice.tone}>{notice.message}</Notice>}

      {rows.length > 0 && (
        <div className="creator-import-rows">
          {rows.map((row) => {
            const coord = coords[row.index];
            return (
              <div
                key={row.index}
                className={`creator-import-row ${row.status}`}
              >
                <div>
                  <strong>{row.storeName || '（无店名）'}</strong>
                  <small>
                    {row.mealName || '（无菜品）'} · {row.city}
                    {row.matchedPlaceId ? ' · 合并到已有门店' : ''}
                  </small>
                  <small>{String(records[row.index]?.address ?? '')}</small>
                </div>
                <div>
                  <span className={`creator-import-badge badge-${row.status}`}>
                    {row.status === 'ready'
                      ? '就绪'
                      : row.status === 'needs_coordinates'
                        ? '待确认坐标'
                        : '非法'}
                  </span>
                  {row.errors.length > 0 && <small>{row.errors.join('；')}</small>}
                </div>
                <div className="creator-import-coords">
                  <input
                    aria-label={`第 ${row.index + 1} 条经度`}
                    inputMode="decimal"
                    value={coord?.lng ?? ''}
                    placeholder="经度"
                    onChange={(event) =>
                      setRowCoord(row.index, 'lng', event.target.value)
                    }
                  />
                  <input
                    aria-label={`第 ${row.index + 1} 条纬度`}
                    inputMode="decimal"
                    value={coord?.lat ?? ''}
                    placeholder="纬度"
                    onChange={(event) =>
                      setRowCoord(row.index, 'lat', event.target.value)
                    }
                  />
                  <button
                    className="row-action"
                    type="button"
                    disabled={busy}
                    onClick={() => geocodeRow(row.index)}
                  >
                    解析地址
                  </button>
                  {row.geocodeCandidates && row.geocodeCandidates.length > 1 && (
                    <div className="creator-import-candidates">
                      {row.geocodeCandidates.map((candidate, candidateIndex) => (
                        <button
                          key={`${candidate.lng},${candidate.lat}`}
                          type="button"
                          onClick={() =>
                            setCoords((current) => ({
                              ...current,
                              [row.index]: {
                                lng: candidate.lng,
                                lat: candidate.lat,
                              },
                            }))
                          }
                        >
                          候选{candidateIndex + 1} {candidate.lng.toFixed(4)},{' '}
                          {candidate.lat.toFixed(4)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div className="creator-import-toolbar">
            <button
              className="primary-button"
              type="button"
              onClick={commit}
              disabled={busy || !allReady}
            >
              {busy ? '正在导入…' : '确认导入（全部或全不写入） ↗'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
