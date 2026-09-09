/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { CandidateDraftDto, CandidatePreviewResult } from '@/lib/candidate-pool';

const FIELD_LABELS: Record<string, string> = {
  zone_name: '片区名称',
  place_name: '店铺名称',
  address: '完整地址',
  lng: '经度',
  lat: '纬度',
  'lng/lat': '地图位置',
  coordinate_system: '坐标系',
  place_category: '店铺类别',
  access_type: '准入类型',
  menu_item_name: '餐食名称',
  menu_category: '餐食类别',
  price_yuan: '当前常规价',
  observed_date: '核验日期',
  verification_method: '核验方式',
  source_lead_url: '来源链接',
  sourceLeadItemId: '候选餐食',
  'facts.open': '营业与门头事实',
  'facts.regularPrice': '常规正价事实',
  'facts.oneMeal': '一人一餐事实',
};

function label(field: string) {
  return FIELD_LABELS[field] || field;
}

async function csrfToken() {
  const response = await fetch('/api/v1/admin/csrf', { cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.csrfToken) throw new Error('无法取得安全令牌，请刷新页面重试');
  return String(body.csrfToken);
}

export function CandidateImportPreview({ draftId }: { draftId: string }) {
  const [draft, setDraft] = useState<CandidateDraftDto | null>(null);
  const [preview, setPreview] = useState<CandidatePreviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const rowErrors = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const item of preview?.errors ?? []) {
      const list = map.get(item.row) ?? [];
      list.push(`${label(item.field || '字段')}：${item.message}`);
      map.set(item.row, list);
    }
    return map;
  }, [preview]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const draftResponse = await fetch(`/api/v1/admin/leads/drafts/${encodeURIComponent(draftId)}`, { cache: 'no-store' });
      const draftBody = await draftResponse.json().catch(() => ({}));
      if (!draftResponse.ok || !draftBody.data) throw new Error(draftBody.error?.message || '找不到候选草稿');
      const loaded = draftBody.data as CandidateDraftDto;
      setDraft(loaded);
      const token = await csrfToken();
      const previewResponse = await fetch('/api/v1/admin/leads/preview', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': token }, body: JSON.stringify({ draftId: loaded.id, version: loaded.version }) });
      const previewBody = await previewResponse.json().catch(() => ({}));
      if (!previewResponse.ok || !previewBody.data) throw new Error(previewBody.error?.message || '候选预览失败');
      setPreview(previewBody.data as CandidatePreviewResult);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '候选预览失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  async function commit() {
    if (!draft || !preview?.valid) return;
    setBusy(true);
    setError('');
    try {
      const token = await csrfToken();
      const response = await fetch('/api/v1/admin/leads/commit', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': token }, body: JSON.stringify({ draftId: draft.id, version: preview.version }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.data) throw new Error(body.error?.message || '候选提交失败，数据库未改变');
      if (typeof window !== 'undefined' && window.localStorage.getItem('candidatePoolDraftId') === draft.id)
        window.localStorage.removeItem('candidatePoolDraftId');
      setMessage(`已提交 ${preview.selectedCount} 份餐食，新增 ${body.data.createdPlaceIds?.length ?? 0} 家地点`);
      setPreview(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '候选提交失败，数据库未改变');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <section className="candidate-import-panel" aria-label="候选导入预览"><p className="candidate-loading">正在生成候选导入预览……</p></section>;
  if (error && !preview) return <section className="candidate-import-panel candidate-import-error" aria-label="候选导入预览" role="alert"><p>{error}</p><Link className="secondary-button" href={`/admin/leads?draft=${encodeURIComponent(draftId)}`}>返回候选池修改</Link></section>;

  return <section className="candidate-import-panel" aria-label="候选导入预览">
    <div className="candidate-import-heading"><div><p className="kicker">CANDIDATE DRAFT / PREVIEW</p><h2>候选导入预览</h2><p>这是即将写入后台的固定 16 列数据。确认版本后再提交，来源线索不会被当作核验方式。</p></div><div className="candidate-import-version">{preview?.version ? `预览版本 ${preview.version}` : '已提交'}</div></div>
    {message && <p className="candidate-message" role="status">{message}</p>}
    {error && <p className="candidate-global-error" role="alert">{error}</p>}
    {preview && <>
      <div className={`candidate-preview-summary ${preview.valid ? 'is-valid' : 'is-invalid'}`} role="status"><strong>{preview.valid ? '检查通过' : '需要修改'}</strong><span>{preview.selectedCount} 份餐食 · {preview.placeCount ?? preview.groupCount} 家计划地点 · {preview.valid ? '可以提交' : `${preview.errors.length} 个字段错误`}</span></div>
      <div className="candidate-preview-rows">
        {preview.rows.map((row, index) => {
          const rowNumber = index + 2;
          const errors = rowErrors.get(rowNumber) ?? [];
          return <article className={`candidate-preview-row ${errors.length ? 'has-errors' : ''}`} key={`${String(row.place_name)}-${String(row.menu_item_name)}-${index}`}><div className="candidate-preview-row-title"><strong>{String(row.place_name || '未命名店铺')}</strong><span>{String(row.menu_item_name || '未命名餐食')}</span></div><dl><div><dt>片区</dt><dd>{String(row.zone_name || '—')}</dd></div><div><dt>地址</dt><dd>{String(row.address || '—')}</dd></div><div><dt>位置</dt><dd>{row.lng && row.lat ? `${Number(row.lng).toFixed(6)}, ${Number(row.lat).toFixed(6)}` : '—'}</dd></div><div><dt>常规价</dt><dd className="candidate-preview-price">{row.price_yuan ? `¥${Number(row.price_yuan).toFixed(2)}` : '—'}</dd></div><div><dt>核验</dt><dd>{String(row.observed_date || '—')} · {label(String(row.verification_method || '—'))}</dd></div></dl>{errors.length > 0 && <ul className="candidate-preview-errors">{errors.map((item) => <li key={item}>{item}</li>)}</ul>}</article>;
        })}
      </div>
      <div className="candidate-import-actions"><Link className="secondary-button" href={`/admin/leads?draft=${encodeURIComponent(draftId)}`}>← 返回候选池修改</Link>{preview.valid && !message && <button className="primary-button" type="button" onClick={() => void commit()} disabled={busy}>确认提交候选 <span>↗</span></button>}</div>
    </>}
  </section>;
}
