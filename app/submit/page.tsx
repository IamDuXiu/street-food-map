'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import type { Place } from '@/lib/types';
import { submissionSchema } from '@/lib/server/validation';
import { Notice } from '@/components/ui/Notice';
import { submissionTypeLabels } from '@/lib/presentation';

type SubmissionType = 'new_place' | 'new_price' | 'correction' | 'closure';
const labels: Record<SubmissionType, string> = {
  ...submissionTypeLabels,
};
const methods = [
  { value: 'onsite_menu', label: '现场菜单或价签' },
  { value: 'receipt', label: '当次消费小票' },
  { value: 'official_menu', label: '商户官方菜单' },
  { value: 'community_confirmed', label: '两名独立用户确认' },
];

export default function SubmitPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [type, setType] = useState<SubmissionType>('new_place');
  const [places, setPlaces] = useState<Place[]>([]);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [selectedPlaceId, setSelectedPlaceId] = useState('');
  const [submitted, setSubmitted] = useState<{
    code: string;
    id: string;
    token: string;
    uploadError?: string;
    retryFiles: File[];
    failedCount: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryNotice, setRetryNotice] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialType = params.get('type');
    queueMicrotask(() => {
      if (
        initialType &&
        Object.prototype.hasOwnProperty.call(labels, initialType)
      )
        setType(initialType as SubmissionType);
      setSelectedPlaceId(params.get('place') ?? '');
    });
    fetch('/api/v1/map?maxPriceFen=2500')
      .then((response) => {
        if (!response.ok) throw new Error('PLACES_UNAVAILABLE');
        return response.json();
      })
      .then((body: { data?: Place[] }) => setPlaces(body.data ?? []))
      .catch(() => setNotice('地点列表暂时不可用，仍可提交新饭点。'))
      .finally(() => setPlacesLoading(false));
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    const form = new FormData(event.currentTarget);
    const files = form
      .getAll('files')
      .filter((file): file is File => file instanceof File && file.size > 0);
    if (files.length > 5) {
      setNotice('一次最多提交 5 张图片，请减少后再试。');
      setBusy(false);
      return;
    }
    if (files.length > 0 && form.get('rightsConfirmed') !== 'on') {
      setNotice('上传图片前，请先确认你有权提交这些图片。');
      setBusy(false);
      return;
    }
    const placeId = String(form.get('placeId') || selectedPlaceId);
    const common = {
      placeId,
      observedAt: String(form.get('date')),
      note: String(form.get('note') || ''),
    };
    let payload: Record<string, unknown>;
    if (type === 'new_place')
      payload = {
        type,
        zoneId: String(form.get('zoneId')),
        placeName: String(form.get('placeName')),
        address: String(form.get('address')),
        lng: Number(form.get('lng')),
        lat: Number(form.get('lat')),
        coordinateSystem: 'GCJ-02',
        placeCategory: '街边快餐',
        menuItemName: String(form.get('meal')),
        menuCategory: '套餐',
        accessType: 'public',
        priceFen: Math.round(Number(form.get('price')) * 100),
        observedAt: common.observedAt,
        claimedVerificationMethod: String(form.get('method')),
        note: common.note,
      };
    else if (type === 'new_price')
      payload = {
        type,
        ...common,
        menuItemId: String(form.get('menuItemId') || '') || undefined,
        newMenuItemName: String(form.get('newMenuItemName') || '') || undefined,
        priceFen: Math.round(Number(form.get('price')) * 100),
        claimedVerificationMethod: String(form.get('method')),
      };
    else if (type === 'correction')
      payload = {
        type,
        placeId,
        field: String(form.get('field')),
        proposedValue: String(form.get('proposedValue')),
        reason: String(form.get('reason')),
        ...(String(form.get('field')) === 'menu_item_name'
          ? { menuItemId: String(form.get('menuItemId') || '') || undefined }
          : {}),
      };
    else
      payload = {
        type,
        placeId,
        closureType: String(form.get('closureType')),
        observedAt: common.observedAt,
        reason: common.note || undefined,
      };
    const parsed = submissionSchema.safeParse(payload);
    if (!parsed.success) {
      setNotice('请检查必填内容、价格和日期后再提交。');
      setBusy(false);
      return;
    }
    try {
      const response = await fetch('/api/v1/submissions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          rightsConfirmed: form.get('rightsConfirmed') === 'on',
          website: String(form.get('website') || ''),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || '提交失败');
      const failedFiles: File[] = [];
      for (const file of files) {
        const upload = new FormData();
        upload.set('file', file);
        upload.set(
          'rightsConfirmed',
          form.get('rightsConfirmed') === 'on' ? 'true' : 'false',
        );
        const mediaResponse = await fetch(
          `/api/v1/submissions/${body.data.id}/media`,
          {
            method: 'POST',
            headers: { 'x-upload-token': body.data.uploadToken },
            body: upload,
          },
        );
        if (!mediaResponse.ok) failedFiles.push(file);
      }
      setSubmitted({
        code: body.data.lookupCode,
        id: body.data.id,
        token: body.data.uploadToken,
        retryFiles: failedFiles,
        failedCount: failedFiles.length,
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '提交失败');
    } finally {
      setBusy(false);
    }
  }
  async function retryFailedUploads() {
    if (retryBusy || !submitted || submitted.retryFiles.length === 0) return;
    setRetryBusy(true);
    setRetryNotice('');
    const remaining: File[] = [];
    try {
      for (const file of submitted.retryFiles) {
        try {
          const upload = new FormData();
          upload.set('file', file);
          upload.set('rightsConfirmed', 'true');
          const response = await fetch(
            `/api/v1/submissions/${submitted.id}/media`,
            {
              method: 'POST',
              headers: { 'x-upload-token': submitted.token },
              body: upload,
            },
          );
          if (!response.ok) remaining.push(file);
        } catch {
          remaining.push(file);
        }
      }
      setSubmitted({
        ...submitted,
        retryFiles: remaining,
        failedCount: remaining.length,
      });
      setRetryNotice(remaining.length ? `还有 ${remaining.length} 张图片未上传成功，请稍后重试。` : '图片已全部上传。');
    } finally {
      setRetryBusy(false);
    }
  }
  if (submitted)
    return (
      <>
        <SiteHeader />
        <main className="success-shell public-shell public-page">
          <div className="public-page-heading">
            <p className="kicker">投稿已收到</p>
            <h1>等待核验。</h1>
          </div>
          <p>投稿不会立刻出现在地图上。查询码只显示这一次，请现在保存。</p>
          {submitted.failedCount > 0 && (
            <Notice tone="error" className="data-notice">
              有 {submitted.failedCount}{' '}
              张图片没有上传成功，投稿本身已保留。请点击下面按钮重试，或稍后重新选择图片提交。
              <button
                className="row-action"
                type="button"
                onClick={retryFailedUploads}
                disabled={retryBusy}
              >
                {retryBusy ? '图片上传中…' : '重试未成功图片'}
              </button>
            </Notice>
          )}
          {retryNotice && <Notice tone={submitted.failedCount > 0 ? 'error' : 'success'}>{retryNotice}</Notice>}
          <div className="success-code">
            <span>查询码（只显示一次）</span>
            <strong>{submitted.code}</strong>
            <small>不要把查询码当作图片上传令牌；可用它查询审核状态。</small>
          </div>
          <div className="public-actions">
            <Link
              className="primary-button"
              href={`/submit/status?code=${encodeURIComponent(submitted.code)}`}
            >
              查询投稿状态
            </Link>
            <Link className="secondary-button" href="/">
              回到地图找饭 <span>↗</span>
            </Link>
          </div>
        </main>
      </>
    );
  const selectedPlace = places.find((place) => place.id === selectedPlaceId);
  return (
    <>
      <SiteHeader />
      <main className="form-shell public-shell public-page">
        <Link href="/" className="back-link">
          ← 回到地图
        </Link>
        <div className="form-heading">
          <p className="kicker">匿名投稿</p>
          <h1>报一条饭签。</h1>
          <p>填写具体餐食、价格和核验日期。不需要姓名、电话或登录，投稿成功后会进入审核。</p>
        </div>
        <form className="submission-form" onSubmit={submit} aria-describedby="submission-form-error" aria-busy={busy}>
          <input
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="honeypot"
            hidden
          />
          <fieldset>
            <legend>01 · 你想告诉我们什么？</legend>
            <div className="choice-grid">
              {(Object.keys(labels) as SubmissionType[]).map((item) => (
                <label key={item}>
                  <input
                    type="radio"
                    name="submissionType"
                    checked={type === item}
                    onChange={() => setType(item)}
                  />
                  <span>{labels[item]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {type === 'new_place' && (
            <fieldset>
              <legend>02 · 新饭点在哪里？</legend>
              <label>
                地点名称
                <input
                  required
                  name="placeName"
                  placeholder="例如：深大粤海食堂二楼"
                />
              </label>
              <label>
                地址
                <input required name="address" placeholder="例如：深大西门旁" />
              </label>
              <div className="two-col">
                <label>
                  经度
                  <input
                    required
                    name="lng"
                    type="number"
                    step="any"
                    defaultValue="113.93"
                  />
                </label>
                <label>
                  纬度
                  <input
                    required
                    name="lat"
                    type="number"
                    step="any"
                    defaultValue="22.53"
                  />
                </label>
              </div>
              <label>
                所属样板区
                <select name="zoneId" defaultValue="sz university">
                  <option value="sz university">深大粤海</option>
                  <option value="science park">高新园 / 科兴</option>
                </select>
              </label>
            </fieldset>
          )}
          {type !== 'new_place' && (
            <fieldset>
              <legend>02 · 选择地点</legend>
              <label>
                地点
                <select
                  required
                  name="placeId"
                  aria-describedby="place-help"
                  disabled={placesLoading}
                  value={selectedPlaceId}
                  onChange={(event) => setSelectedPlaceId(event.target.value)}
                >
                  <option value="">{placesLoading ? '正在读取地点…' : '请选择已公开地点'}</option>
                  {places.map((place) => (
                    <option key={place.id} value={place.id}>
                      {place.name}
                    </option>
                  ))}
                </select>
                <span id="place-help" className="field-help">
                  {placesLoading ? '正在读取可公开地点。' : places.length ? '只列出目前可公开的地点。' : '暂无可选地点；你可以改选“发现新饭点”。'}
                </span>
              </label>
              {selectedPlace && type === 'new_price' && (
                <label>
                  餐食
                  <select name="menuItemId">
                    <option value="">新增一份餐食</option>
                    {selectedPlace.meals.map((meal) => (
                      <option key={meal.id} value={meal.id}>
                        {meal.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {type === 'new_price' && (
                <label>
                  新餐食名称（可选）
                  <input name="newMenuItemName" />
                </label>
              )}
            </fieldset>
          )}
          <fieldset>
            <legend>03 · 具体情况</legend>
            {type === 'correction' && (
              <>
                <label>
                  要修改的字段
                  <select name="field" defaultValue="address">
                    <option value="place_name">地点名称</option>
                    <option value="address">地址</option>
                    <option value="access_type">准入方式</option>
                    <option value="access_note">准入说明</option>
                    <option value="opening_hours_note">营业时间</option>
                    <option value="menu_item_name">餐食名称</option>
                  </select>
                </label>
                {selectedPlace && (
                  <label>
                    要修改的餐食
                    <select name="menuItemId" defaultValue="">
                      <option value="">
                        请选择餐食（仅修改餐食名称时需要）
                      </option>
                      {selectedPlace.meals.map((meal) => (
                        <option key={meal.id} value={meal.id}>
                          {meal.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  正确内容
                  <input required name="proposedValue" />
                </label>
                <label>
                  为什么需要修改
                  <textarea required name="reason" rows={2} />
                </label>
              </>
            )}
            {type === 'closure' && (
              <label>
                状态
                <select name="closureType" defaultValue="temporarily_closed">
                  <option value="temporarily_closed">暂时歇业</option>
                  <option value="closed">确认停业</option>
                </select>
              </label>
            )}
            {type === 'new_place' && (
              <label>
                具体餐食
                <input
                  required
                  name="meal"
                  placeholder="例如：两荤一素自选饭"
                />
              </label>
            )}
            {type !== 'correction' && type !== 'closure' && (
              <>
                <div className="two-col">
                  <label>
                    价格（元）
                    <input
                      required
                      name="price"
                      type="number"
                      min="1"
                      max={type === 'new_place' ? '25' : '1000'}
                      step="0.5"
                      defaultValue="15"
                    />
                  </label>
                  <label>
                    你在哪天看到？
                    <input
                      required
                      name="date"
                      type="date"
                      defaultValue={today}
                    />
                  </label>
                </div>
                <label>
                  核验方式
                  <select name="method" defaultValue="onsite_menu">
                    {methods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {(type === 'closure' || type === 'correction') && (
              <label>
                你在哪天确认？
                <input
                  required
                  name="date"
                  type="date"
                  defaultValue={today}
                />
              </label>
            )}
            <label>
              补充说明（可选）
              <textarea name="note" rows={3} />
            </label>
          </fieldset>
          <fieldset>
            <legend>
              04 · 图片证据 <span>可选</span>
            </legend>
            <label className="upload-box">
              <input
                name="files"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
              />
              <span className="upload-icon">＋</span>
              <strong>上传菜单或小票照片</strong>
              <small>
                最多选择 5 张，仅支持 JPEG、PNG、WebP，单张不超过
                10MB；请先遮住个人信息
              </small>
            </label>
            <label className="check-label">
              <input name="rightsConfirmed" type="checkbox" />{' '}
              我确认这张图片可以提交给街头饭签，用于核验。
            </label>
          </fieldset>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? '提交中…' : '提交这条饭签'} <span>↗</span>
          </button>
          <div id="submission-form-error" hidden={!notice}>
            {notice && <Notice tone="error" className="form-notice">{notice}</Notice>}
          </div>
        </form>
      </main>
    </>
  );
}
