'use client';

import { useState } from 'react';
import {
  BUDGET_IMPORT_DISPLAY_HEADERS,
  BUDGET_IMPORT_HEADERS,
  parseCsvRFC4180,
} from '@/lib/csv';
import { Notice, type NoticeTone } from '@/components/ui/Notice';

export function ImportWorkbench() {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [message, setMessage] = useState('尚未预览');
  const [valid, setValid] = useState(false);
  const [tone, setTone] = useState<NoticeTone>('info');
  const [busy, setBusy] = useState(false);
  function downloadTemplate() {
    const csv = `\uFEFF${BUDGET_IMPORT_DISPLAY_HEADERS.join(',')}\r\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '街头饭签-导入模板.csv';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function file(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setBusy(true);
    setTone('info');
    setMessage('正在检查文件…');
    try {
      const parsed = parseCsvRFC4180(await selected.text(), BUDGET_IMPORT_HEADERS);
      setRows(parsed);
      const response = await fetch('/api/v1/admin/imports/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rows: parsed }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error?.message || '预览失败，请检查文件后重试');
      setValid(Boolean(body.data?.valid));
      setTone(body.data?.valid ? 'success' : 'error');
      setMessage(body.data?.valid ? `${parsed.length} 行检查通过，可以确认导入` : (body.data?.errors ?? []).map((error: { row: number; message: string }) => `第${error.row}行：${error.message}`).join('；') || '存在错误');
    } catch (error) {
      setValid(false);
      setTone('error');
      setMessage(error instanceof Error ? error.message : '文件无法读取');
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (busy || !rows.length) return;
    setBusy(true);
    setTone('info');
    setMessage('正在导入…');
    try {
      const tokenResponse = await fetch('/api/v1/admin/csrf');
      const tokenBody = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokenBody.csrfToken) throw new Error('无法取得安全令牌，请刷新页面重试');
      const response = await fetch('/api/v1/admin/imports/commit', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': tokenBody.csrfToken }, body: JSON.stringify({ rows }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error?.message || '导入失败，数据未改变');
      setMessage(`已原子导入 ${rows.length} 行`);
      setTone('success');
      setValid(false);
    } catch (error) {
      setTone('error');
      setMessage(error instanceof Error ? error.message : '导入失败，数据未改变');
    } finally {
      setBusy(false);
    }
  }
  return <><button className="secondary-button template-download" type="button" onClick={downloadTemplate} disabled={busy}>下载 CSV 导入模板</button><label className="dropzone"><span>＋</span><strong>{busy ? '正在检查…' : '拖入 CSV，或点击选择'}</strong><small>系统模板 · GCJ-02 · 金额以元填写</small><input type="file" accept=".csv,text/csv" onChange={file} disabled={busy} /></label><div className="fake-validation"><b>预览结果</b><Notice tone={tone}>{message}</Notice>{valid && <button className="primary-button" type="button" onClick={commit} disabled={busy}>{busy ? '正在导入…' : '确认导入（全部或全不写入） ↗'}</button>}</div></>;
}
