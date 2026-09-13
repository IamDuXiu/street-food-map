'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Notice, type NoticeTone } from '@/components/ui/Notice';
import { Select } from '@/components/ui/Select';

type ActionNotice = { tone: NoticeTone; message: string };
const leadStatusLabels: Record<string, string> = { new: '待处理', verifying: '待核验', converted: '已导入', rejected: '已跳过', duplicate: '重复' };

async function csrf() {
  const response = await fetch('/api/v1/admin/csrf');
  if (!response.ok) throw new Error('SESSION_EXPIRED');
  return (await response.json()).csrfToken as string;
}

export function MediaReviewActions({ id }: { id: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  async function update(body: Record<string, string>) {
    setBusy(true);
    try {
      const token = await csrf();
      const response = await fetch(`/api/v1/admin/media/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('请先完成权利、隐私和正式事实检查');
      setNotice({ tone: 'success', message: '已记录隐私检查' });
      router.refresh();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : '图片更新失败' });
    } finally { setBusy(false); }
  }
  async function replace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setNotice({ tone: 'error', message: '请选择脱敏替代图' });
      return;
    }
    setBusy(true);
    try {
      const token = await csrf();
      const form = new FormData();
      form.set('file', file);
      form.set('replacesMediaId', id);
      form.set('rightsConfirmed', 'true');
      const response = await fetch('/api/v1/admin/media', {
        method: 'POST',
        headers: { 'x-csrf-token': token },
        body: form,
      });
      if (!response.ok) throw new Error('替代图上传失败');
      setFile(null);
      event.currentTarget.reset();
      setNotice({ tone: 'success', message: '替代图已保存为私有，待人工复核' });
      router.refresh();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : '替代图上传失败' });
    } finally { setBusy(false); }
  }
  return (
    <div className="media-review-actions">
      <button
        className="row-action"
        type="button"
        disabled={busy}
        onClick={() => update({ redactionStatus: 'completed' })}
      >
        完成隐私检查
      </button>
      <form onSubmit={replace}>
        <label>
          脱敏替代图
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button className="row-action" type="submit" disabled={busy}>
          {busy ? '处理中…' : '上传替代图'}
        </button>
      </form>
      {notice && <Notice tone={notice.tone}>{notice.message}</Notice>}
    </div>
  );
}

export function AdminLogout() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="admin-logout"
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const token = await csrf();
          await fetch('/api/v1/admin/session', {
            method: 'DELETE',
            headers: { 'x-csrf-token': token },
          });
          router.push('/admin/login');
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? '退出中…' : '退出后台 →'}
    </button>
  );
}

export function SubmissionActions({
  id,
  type,
  status,
  media = [],
}: {
  id: string;
  type?: string;
  status?: string;
  media?: Array<{ id: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const [method, setMethod] = useState('onsite_menu');
  const [observedAt, setObservedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [independent, setIndependent] = useState(false);
  const [publicMediaIds, setPublicMediaIds] = useState<string[]>([]);
  const [pendingDecision, setPendingDecision] = useState<Exclude<Parameters<typeof decide>[0], 'approved' | 'needs_verification'> | null>(null);
  async function decide(
    decision: 'approved' | 'needs_verification' | 'rejected' | 'duplicate',
  ): Promise<boolean> {
    setBusy(true);
    try {
      const token = await csrf();
      const body = {
        id,
        decision,
        ...(decision === 'approved'
          ? {
              review: {
                verificationMethod: method,
                observedAt,
                independentVerification: independent === true,
                ...(publicMediaIds.length ? { publicMediaIds } : {}),
              },
            }
          : {}),
      };
      const response = await fetch('/api/v1/admin/submissions', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error?.message || '操作失败，投稿状态未改变');
      }
      setNotice({
        tone: 'success',
        message: decision === 'approved' ? '已通过' : decision === 'rejected' ? '已拒绝' : decision === 'duplicate' ? '已标记重复' : '已转待核验',
      });
      router.refresh();
      return true;
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : '操作失败，投稿状态未改变' });
      return false;
    } finally { setBusy(false); }
  }
  const reviewPrompt =
    type === 'new_place'
      ? '确认地点、餐食和价格均已独立核验'
      : type === 'new_price'
        ? '确认新价格与现有餐食对应'
        : type === 'correction'
          ? '确认纠错字段与公开事实一致'
          : type === 'closure'
            ? '确认营业状态变化'
            : '确认投稿内容';
  function requestDecision(decision: Parameters<typeof decide>[0]) {
    if (decision === 'rejected' || decision === 'duplicate') {
      setPendingDecision(decision);
      return;
    }
    void decide(decision);
  }
  if (!['pending', 'needs_verification'].includes(status ?? ''))
    return <p className="review-warning">这条投稿已完成处理，不能再次审批。</p>;
  return (
    <div className="review-actions">
      <p className="review-warning">
        审核动作：{reviewPrompt}。商户自报信息不能单独作为公开依据。
      </p>
      <label>
        独立核验方式
        <Select
          value={method}
          onChange={setMethod}
          ariaLabel="独立核验方式"
          options={[
            { value: 'onsite_menu', label: '现场菜单或价签' },
            { value: 'receipt', label: '当次消费小票' },
            { value: 'official_menu', label: '官方菜单' },
          ]}
        />
      </label>
      <label>
        核验日期
        <input
          type="date"
          value={observedAt}
          onChange={(event) => setObservedAt(event.target.value)}
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={independent}
          onChange={(event) => setIndependent(event.target.checked)}
        />{' '}
        我已独立核验
      </label>
      {media.length > 0 && (
        <fieldset>
          <legend>可公开价格证据</legend>
          {media.map((item) => (
            <label className="check-label" key={item.id}>
              <input
                type="checkbox"
                checked={publicMediaIds.includes(item.id)}
                onChange={(event) =>
                  setPublicMediaIds((current) =>
                    event.target.checked
                      ? [...current, item.id]
                      : current.filter((value) => value !== item.id),
                  )
                }
              />{' '}
              通过后公开这张已完成隐私检查的图片（#{item.id.slice(-6)}）
            </label>
          ))}
        </fieldset>
      )}
      <button
        className="primary-button"
        type="button"
        disabled={busy}
        onClick={() => requestDecision('approved')}
      >
        通过
      </button>
      <button
        className="secondary-button"
        type="button"
        disabled={busy}
        onClick={() => requestDecision('needs_verification')}
      >
        标记待核验
      </button>
      <button
        className="secondary-button"
        type="button"
        disabled={busy}
        onClick={() => requestDecision('duplicate')}
      >
        重复
      </button>
      <button
        className="danger-button"
        type="button"
        disabled={busy}
        onClick={() => requestDecision('rejected')}
      >
        拒绝投稿
      </button>
      {notice && <Notice tone={notice.tone}>{notice.message}</Notice>}
      <ConfirmDialog
        open={pendingDecision !== null}
        title={pendingDecision === 'rejected' ? '拒绝这条投稿？' : '标记为重复？'}
        onCancel={() => setPendingDecision(null)}
        onConfirm={async () => {
          if (!pendingDecision) return;
          const decision = pendingDecision;
          if (await decide(decision)) setPendingDecision(null);
          else throw new Error('ACTION_FAILED');
        }}
        confirmLabel={pendingDecision === 'rejected' ? '确认拒绝' : '确认标记重复'}
      >
        {pendingDecision === 'rejected' ? '拒绝后投稿不会公开，后续需要重新提交才能再次审核。' : '标记后该投稿将按重复记录处理，确认已与现有地点或价格对应。'}
      </ConfirmDialog>
    </div>
  );
}

export function ExportButton() {
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="admin-action-feedback">
      <button
        className="primary-button small-button"
        type="button"
        disabled={busy}
        onClick={async () => {
        setBusy(true);
        setNotice({ tone: 'info', message: '生成中…' });
        try {
          const response = await fetch('/api/v1/admin/exports/full');
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.error?.message || '备份失败，未生成文件');
          setNotice({ tone: 'success', message: `已生成 ${String(body.data?.path || '备份文件').split('/').pop()}` });
        } catch (error) {
          setNotice({ tone: 'error', message: error instanceof Error ? error.message : '备份失败，未生成文件' });
        } finally {
          setBusy(false);
        }
        }}
      >
        {busy ? '生成中…' : '生成新备份'}
      </button>
      {notice && <Notice tone={notice.tone}>{notice.message}</Notice>}
    </div>
  );
}

export function LeadForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setNotice(null);
    try {
      const token = await csrf();
      const response = await fetch('/api/v1/admin/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({
          sourcePlatform: 'other',
          cluePlaceName: form.get('place'),
          clueItemName: form.get('item'),
          summary: form.get('summary'),
          sourceUrl: form.get('url'),
        }),
      });
      if (!response.ok) throw new Error('请检查填写内容，线索未保存');
      setNotice({ tone: 'success', message: '线索已新增并记录审计' });
      setOpen(false);
      router.refresh();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : '线索未保存' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {open ? (
        <form className="admin-create-form" onSubmit={submit}>
          <label>
            地点
            <input name="place" required placeholder="例如：后海食堂" />
          </label>
          <label>
            餐食
            <input name="item" placeholder="例如：烧腊饭" />
          </label>
          <label>
            来源链接
            <input name="url" type="url" placeholder="https://…" />
          </label>
          <label>
            备注
            <textarea name="summary" rows={2} />
          </label>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? '保存中…' : '保存线索'}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setOpen(false)}
          >
            取消
          </button>
          {notice && <Notice tone={notice.tone}>{notice.message}</Notice>}
        </form>
      ) : (
        <div className="admin-action-feedback">
          <button className="primary-button small-button" type="button" onClick={() => { setNotice(null); setOpen(true); }}>
            ＋ 新增线索
          </button>
          {notice && <Notice tone={notice.tone}>{notice.message}</Notice>}
        </div>
      )}
    </>
  );
}

export function PlaceCreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setNotice(null);
    try {
      const token = await csrf();
      const response = await fetch('/api/v1/admin/places', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({
          zoneId: 'sz university',
          name: form.get('name'),
          address: form.get('address'),
          lng: Number(form.get('lng')),
          lat: Number(form.get('lat')),
          category: '街边快餐',
          accessType: 'public',
          tags: [],
        }),
      });
      if (!response.ok) throw new Error('保存失败：请检查坐标或重复候选');
      setNotice({ tone: 'success', message: '地点已新增并记录审计' });
      setOpen(false);
      router.refresh();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : '地点未保存' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {open ? (
        <form className="admin-create-form" onSubmit={submit}>
          <label>
            地点名称
            <input name="name" required />
          </label>
          <label>
            地址
            <input name="address" required />
          </label>
          <label>
            经度
            <input
              name="lng"
              type="number"
              step="any"
              defaultValue="113.93"
              required
            />
          </label>
          <label>
            纬度
            <input
              name="lat"
              type="number"
              step="any"
              defaultValue="22.53"
              required
            />
          </label>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? '保存中…' : '保存地点'}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setOpen(false)}
          >
            取消
          </button>
          {notice && <Notice tone={notice.tone}>{notice.message}</Notice>}
        </form>
      ) : (
        <div className="admin-action-feedback">
          <button className="primary-button small-button" type="button" onClick={() => { setNotice(null); setOpen(true); }}>
            ＋ 新增地点
          </button>
          {notice && <Notice tone={notice.tone}>{notice.message}</Notice>}
        </div>
      )}
    </>
  );
}

export function PlaceStatusButton({
  id,
  archived = false,
}: {
  id: string;
  archived?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  async function updateStatus(): Promise<boolean> {
    setBusy(true);
    setNotice(null);
    try {
      const token = await csrf();
      const response = await fetch(`/api/v1/admin/places/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({ recordStatus: archived ? 'active' : 'archived' }),
      });
      if (!response.ok) throw new Error(archived ? '恢复失败，地点状态未改变' : '归档失败，地点状态未改变');
      setNotice({ tone: 'success', message: archived ? '地点已恢复' : '地点已归档' });
      router.refresh();
      return true;
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : '地点状态未改变' });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-action-feedback">
      <button className="row-action" type="button" disabled={busy} onClick={() => setOpen(true)}>
        {busy ? '处理中…' : archived ? '恢复' : '归档'}
      </button>
      {notice && <Notice tone={notice.tone}>{notice.message}</Notice>}
      <ConfirmDialog
        open={open}
        title={archived ? '恢复这个地点？' : '归档这个地点？'}
        onCancel={() => setOpen(false)}
        onConfirm={async () => { if (await updateStatus()) setOpen(false); else throw new Error('ACTION_FAILED'); }}
        confirmLabel={archived ? '确认恢复' : '确认归档'}
      >
        {archived ? '恢复后地点会重新进入后台管理列表，请确认资料仍然有效。' : '归档后地点将不再作为当前可用记录，请确认这是你的最终判断。'}
      </ConfirmDialog>
    </div>
  );
}
export function MergePreview({ placeId }: { placeId: string }) {
  const [duplicateId, setDuplicateId] = useState('');
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{
    version: string;
    duplicate: { name: string };
    meals: { conflicts: string[]; move: number };
    prices: number;
    evidence: number;
    tags: number;
    leads: number;
    submissions: number;
  } | null>(null);
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(confirm = false) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const token = await csrf();
      const response = await fetch(`/api/v1/admin/places/${placeId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({
          action: confirm ? 'merge' : 'preview',
          duplicateId,
          ...(confirm ? { confirm: true, version: preview?.version } : {}),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok && !body.data) throw new Error(confirm ? '合并失败，地点未改变' : '预览失败');
      if (confirm && response.ok) {
        setNotice({ tone: 'success', message: '已合并并记录审计' });
        setPreview(null);
      } else {
        setPreview(body.data);
        setNotice({ tone: 'info', message: '请确认以下影响后再合并' });
      }
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : '操作失败，地点未改变' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-merge">
      <button className="row-action" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {open ? '收起合并' : '合并地点'}
      </button>
      {open && <>
      <label>
        疑似重复地点 ID
        <input
          value={duplicateId}
          onChange={(event) => setDuplicateId(event.target.value)}
          placeholder="粘贴地点 ID"
        />
      </label>
      <button
        className="row-action"
        type="button"
        disabled={!duplicateId || busy}
        onClick={() => run(false)}
      >
        预览合并
      </button>
      {preview && (
        <div className="merge-preview" role="status">
          <p>将保留当前地点，合并「{preview.duplicate.name}」？</p>
          <p>
            餐食：迁移 {preview.meals.move}，冲突{' '}
            {preview.meals.conflicts.join('、') || '无'}；价格 {preview.prices}{' '}
            条；证据 {preview.evidence} 条；标签 {preview.tags} 个；线索{' '}
            {preview.leads} 条；投稿 {preview.submissions} 条。
          </p>
          <button
            className="danger-button"
            type="button"
            disabled={busy}
            onClick={() => run(true)}
          >
            确认合并
          </button>
        </div>
      )}
      </>}
      {notice && <Notice tone={notice.tone}>{notice.message}</Notice>}
    </div>
  );
}
export function LeadStatusButton({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const next =
    status === 'new'
      ? 'verifying'
      : status === 'verifying'
        ? 'converted'
        : 'new';
  return (
    <div className="admin-action-feedback">
      <button
        className="row-action"
        type="button"
        disabled={busy}
        onClick={async () => {
        setBusy(true);
        setNotice(null);
        try {
          const token = await csrf();
          const response = await fetch('/api/v1/admin/leads', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json', 'x-csrf-token': token },
            body: JSON.stringify({ id, patch: { status: next } }),
          });
          if (!response.ok) throw new Error('线索状态未改变，请刷新重试');
          setNotice({ tone: 'success', message: `已更新为${leadStatusLabels[next] ?? next}` });
          router.refresh();
        } catch (error) {
          setNotice({ tone: 'error', message: error instanceof Error ? error.message : '线索状态未改变' });
        } finally {
          setBusy(false);
        }
        }}
      >
        {busy ? '处理中…' : `→ ${leadStatusLabels[next] ?? next}`}
      </button>
      {notice && <Notice tone={notice.tone}>{notice.message}</Notice>}
    </div>
  );
}

export function PlaceEditor({
  placeId,
  menuItemId,
}: {
  placeId: string;
  menuItemId?: string;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setNotice({ tone: 'info', message: '保存中…' });
    try {
      const token = await csrf();
      const endpoint = menuItemId
        ? '/api/v1/admin/price-reports'
        : '/api/v1/admin/menu-items';
      const body = menuItemId
        ? {
            menuItemId,
            priceFen: Math.round(Number(form.get('price')) * 100),
            observedAt: String(form.get('observedAt')),
            verificationMethod: 'onsite_menu',
          }
        : {
            placeId,
            name: String(form.get('name')),
            category: '套餐',
            description: '',
          };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('请检查填写内容，数据未保存');
      setNotice({ tone: 'success', message: '已保存并写入审计' });
      setOpen(false);
      router.refresh();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : '保存失败，数据未改变' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-editor">
      <button className="row-action" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {open ? '收起' : menuItemId ? '编辑价格' : '新增餐食'}
      </button>
      {open && <form className="admin-inline-form" onSubmit={save}>
      {menuItemId ? (
        <>
          <label>
            新价格（元）
            <input
              name="price"
              inputMode="decimal"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </label>
          <label>
            核验日期
            <input
              name="observedAt"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </label>
          <button className="secondary-button" type="submit" disabled={busy}>
            {busy ? '保存中…' : '替换价格'}
          </button>
        </>
      ) : (
        <>
          <label>
            新增餐食
            <input name="name" placeholder="例如：两荤一素" required />
          </label>
          <button className="secondary-button" type="submit" disabled={busy}>
            {busy ? '保存中…' : '新增餐食'}
          </button>
        </>
      )}
      {notice && <Notice tone={notice.tone}>{notice.message}</Notice>}
      </form>}
      {!open && notice && <Notice tone={notice.tone}>{notice.message}</Notice>}
    </div>
  );
}
