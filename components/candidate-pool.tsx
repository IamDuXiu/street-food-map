/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  CandidateDraftDto,
  CandidateGroupDto,
  CandidateItemDto,
} from '@/lib/candidate-pool';
import { CoordinatePicker } from '@/components/coordinate-picker';
import { Notice, type NoticeTone } from '@/components/ui/Notice';
import { Select } from '@/components/ui/Select';

type Zone = { id: string; name: string; audience?: string };
type CandidateMetadata = Record<string, unknown>;
type ItemEdit = { name: string; category: string; price: string };
type Facts = { open: boolean; regularPrice: boolean; oneMeal: boolean };

type StoreForm = {
  placeName: string;
  address: string;
  zoneName: string;
  placeCategory: string;
  accessType: string;
  lng: number | null;
  lat: number | null;
  observedAt: string;
  verificationMethod: string;
  facts: Facts;
  items: Record<string, ItemEdit>;
  adminNote: string;
};

type StoreGroup = {
  key: string;
  name: string;
  address: string;
  groups: CandidateGroupDto[];
  items: CandidateItemDto[];
  sourcePlatforms: string[];
  sourceUrls: string[];
  summary: string;
  risk: string;
  status: string;
};

const VERIFIED_METHODS = [
  ['onsite_menu', '现场菜单或价签'],
  ['receipt', '当次消费小票'],
  ['official_menu', '商户官方公开菜单'],
  ['phone_check', '电话核验'],
  ['community_confirmed', '两名独立用户确认'],
] as const;

const ACCESS_TYPES = [
  ['public', '公开可进'],
  ['identity_restricted', '需身份/校园凭证'],
  ['staff_only', '仅内部人员'],
  ['unknown', '暂未确认'],
] as const;

const PLACE_CATEGORIES = ['餐饮店', '街边快餐', '餐馆', '食堂', '便利店', '其他'];

function text(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function metadata(item: CandidateItemDto): CandidateMetadata {
  return item.metadata && typeof item.metadata === 'object' ? item.metadata : {};
}

function cleanAccessType(value: unknown) {
  const candidate = text(value);
  return ACCESS_TYPES.some(([code]) => code === candidate) ? candidate : '';
}

function cleanMethod(value: unknown) {
  const candidate = text(value);
  return VERIFIED_METHODS.some(([code]) => code === candidate) ? candidate : '';
}

function stableKey(value: string) {
  return value.toLocaleLowerCase('zh-CN').replace(/[\s\p{P}\p{S}]+/gu, '');
}

function groupStatus(groups: CandidateGroupDto[]) {
  if (!groups.length) return 'new';
  if (groups.every((group) => group.status === 'converted')) return 'converted';
  if (groups.every((group) => group.status === 'rejected')) return 'rejected';
  if (groups.every((group) => group.status === 'duplicate')) return 'duplicate';
  if (groups.some((group) => group.status === 'verifying')) return 'verifying';
  if (groups.some((group) => group.status === 'triaged')) return 'triaged';
  return 'new';
}

function statusLabel(status: string) {
  return ({ new: '待处理', triaged: '已分拣', verifying: '待核验', converted: '已导入', rejected: '已跳过', duplicate: '重复' } as Record<string, string>)[status] ?? status;
}

function sourceLabel(platform: string) {
  return ({ douban: '豆瓣', web: '网页', user: '用户', manual: '人工' } as Record<string, string>)[platform] ?? platform;
}

const TERMINAL_STATUSES = new Set(['converted', 'rejected', 'duplicate']);

function isTerminalItem(item: CandidateItemDto) {
  return TERMINAL_STATUSES.has(item.status);
}

function isTerminalStore(store: StoreGroup) {
  return TERMINAL_STATUSES.has(store.status) || (store.items.length > 0 && store.items.every(isTerminalItem));
}

function createStoreGroups(groups: CandidateGroupDto[]): StoreGroup[] {
  const stores = groups.map((group) => {
    const first = group.items[0];
    const firstMeta = first ? metadata(first) : {};
    const address = text(firstMeta.address);
    const riskParts = group.items.flatMap((item) => {
      const itemMeta = metadata(item);
      const risks: string[] = [];
      if (itemMeta.possiblePromo === true || text(itemMeta.possiblePromo) === 'true') risks.push('可能含优惠价');
      if (text(itemMeta.evidenceGrade).toUpperCase() === 'C') risks.push('证据较弱');
      if (item.cluePriceFen === null) risks.push('线索未给价格');
      return risks;
    });
    return {
      // sourceLeadId is the server's stable grouping boundary.  A matching
      // name/address is not enough to prove that two discoveries are one shop.
      key: group.sourceLeadId || group.id,
      name: group.placeName,
      address,
      groups: [group],
      items: group.items,
      sourcePlatforms: [group.sourcePlatform],
      sourceUrls: group.sourceUrl ? [group.sourceUrl] : [],
      summary: group.summary || text(firstMeta.summary),
      risk: [...new Set(riskParts)].join(' · '),
      status: groupStatus([group]),
    };
  });
  const nameCounts = new Map<string, number>();
  for (const store of stores) {
    const name = stableKey(store.name);
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  return stores.map((store) => {
    const duplicateHint = nameCounts.get(stableKey(store.name))! > 1
      ? '可能同名门店，分别核验'
      : '';
    return {
      ...store,
      risk: [store.risk, duplicateHint].filter(Boolean).join(' · '),
    };
  });
}

function initialForm(store: StoreGroup): StoreForm {
  const item = store.items[0];
  const itemMeta = item ? metadata(item) : {};
  const items: Record<string, ItemEdit> = {};
  for (const candidate of store.items) {
    const candidateMeta = metadata(candidate);
    const cluePrice = candidate.cluePriceFen === null ? '' : String(candidate.cluePriceFen / 100);
    items[candidate.id] = {
      name: candidate.itemName,
      category: text(candidateMeta.menuCategory),
      price: cluePrice,
    };
  }
  return {
    placeName: store.name,
    address: text(itemMeta.address) || store.address,
    zoneName: text(itemMeta.zoneName),
    placeCategory: text(itemMeta.placeCategory) || '餐饮店',
    accessType: cleanAccessType(itemMeta.accessType),
    lng: numberOrNull(itemMeta.lng),
    lat: numberOrNull(itemMeta.lat),
    observedAt: text(itemMeta.observedAt),
    verificationMethod: cleanMethod(itemMeta.verificationMethod),
    facts: { open: false, regularPrice: false, oneMeal: false },
    items,
    adminNote: text(itemMeta.summary) || store.summary,
  };
}

function errorId(storeKey: string, field: string) {
  return `candidate-${stableKey(storeKey)}-${field}`;
}

function validateStore(store: StoreGroup, form: StoreForm | undefined, selected: Set<string>) {
  const errors: Record<string, string> = {};
  if (!form) return errors;
  if (!selected.size) return errors;
  if (!form.placeName.trim()) errors.placeName = '请填写店名';
  if (!form.address.trim()) errors.address = '请补充完整地址，不能只写商圈';
  if (!form.zoneName.trim()) errors.zoneName = '请选择一个启用片区';
  if (!form.placeCategory.trim()) errors.placeCategory = '请选择店铺类别';
  if (!form.accessType.trim()) errors.accessType = '请选择准入类型';
  if (form.lng === null || form.lat === null) errors.coordinates = '请在地图落点，或填写经纬度';
  if (!form.observedAt) errors.observedAt = '请选择核验日期';
  if (!form.verificationMethod) errors.verificationMethod = '请选择独立核验方式';
  if (!form.facts.open) errors.factOpen = '请确认仍在营业且门头一致';
  if (!form.facts.regularPrice) errors.factPrice = '请确认是常规正价，不是优惠摊薄价';
  if (!form.facts.oneMeal) errors.factMeal = '请确认确实可以作为一人一餐';
  for (const item of store.items) {
    if (!selected.has(item.id)) continue;
    const edit = form.items[item.id] ?? { name: '', category: '', price: '' };
    if (!edit.name.trim()) errors[`item.${item.id}.name`] = '请填写餐食名称';
    if (!edit.category.trim()) errors[`item.${item.id}.category`] = '请填写餐食类别';
    const price = Number(edit.price);
    if (!edit.price.trim() || !Number.isFinite(price) || price <= 0 || price > 25) errors[`item.${item.id}.price`] = '价格须大于 0 且不超过 25 元';
  }
  return errors;
}

function TriStateCheckbox({ checked, indeterminate, onChange, label, disabled = false }: { checked: boolean; indeterminate: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} disabled={disabled} aria-label={label} onChange={(event) => onChange(event.target.checked)} />;
}

async function getCsrfToken() {
  const response = await fetch('/api/v1/admin/csrf', { cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.csrfToken) throw new Error('无法取得安全令牌，请刷新页面重试');
  return String(body.csrfToken);
}

function entryValue(entry: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) if (entry[key] !== undefined && entry[key] !== null) return entry[key];
  return undefined;
}

export function CandidatePoolWorkspace({ initialDraftId }: { initialDraftId?: string }) {
  const router = useRouter();
  const [groups, setGroups] = useState<CandidateGroupDto[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [drafts, setDrafts] = useState<CandidateDraftDto[]>([]);
  const [forms, setForms] = useState<Record<string, StoreForm>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [activeKey, setActiveKey] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<NoticeTone>('success');
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [draftId, setDraftId] = useState('');
  const [draftVersion, setDraftVersion] = useState<number | undefined>();
  const restoredRef = useRef(false);

  const stores = useMemo(() => createStoreGroups(groups), [groups]);
  const storeMap = useMemo(() => new Map(stores.map((store) => [store.key, store])), [stores]);

  const visibleStores = useMemo(() => stores.filter((store) => {
    const needle = query.trim().toLocaleLowerCase('zh-CN');
    const matchesQuery = !needle || [store.name, store.address, store.summary, ...store.items.map((item) => item.itemName), ...store.sourcePlatforms].join(' ').toLocaleLowerCase('zh-CN').includes(needle);
    const matchesStatus = statusFilter === 'all' || store.status === statusFilter;
    const matchesRisk = riskFilter === 'all' || (riskFilter === 'risk' ? Boolean(store.risk) : !store.risk);
    return matchesQuery && matchesStatus && matchesRisk;
  }), [query, riskFilter, statusFilter, stores]);

  const selectedItemCount = stores.reduce((count, store) => count + store.items.filter((item) => !isTerminalStore(store) && !isTerminalItem(item) && selected[item.id]).length, 0);
  const selectedStoreCount = stores.filter((store) => !isTerminalStore(store) && store.items.some((item) => !isTerminalItem(item) && selected[item.id])).length;
  const activeStore = storeMap.get(activeKey) ?? visibleStores[0] ?? stores[0];
  const activeForm = activeStore ? forms[activeStore.key] : undefined;
  const activeSelected = useMemo(() => {
    if (!activeStore || isTerminalStore(activeStore)) return new Set<string>();
    return new Set(activeStore.items.filter((item) => !isTerminalItem(item) && selected[item.id]).map((item) => item.id));
  }, [activeStore, selected]);
  const activeErrors = useMemo(() => activeStore ? validateStore(activeStore, activeForm, activeSelected) : {}, [activeForm, activeSelected, activeStore]);

  const buildPayload = useCallback(() => ({
    items: stores.flatMap((store) => store.items.map((item) => {
      const form = forms[store.key] ?? initialForm(store);
      const edit = form.items[item.id] ?? { name: item.itemName, category: '', price: item.cluePriceFen === null ? '' : String(item.cluePriceFen / 100) };
      return {
        sourceLeadItemId: item.id,
        selected: !isTerminalStore(store) && !isTerminalItem(item) && Boolean(selected[item.id]),
        placeName: form.placeName,
        address: form.address,
        zoneName: form.zoneName,
        placeCategory: form.placeCategory,
        accessType: form.accessType,
        lng: form.lng,
        lat: form.lat,
        coordinateSystem: 'GCJ-02',
        menuItemName: edit.name,
        menuCategory: edit.category,
        priceYuan: edit.price === '' ? '' : Number(edit.price),
        observedAt: form.observedAt,
        verificationMethod: form.verificationMethod,
        facts: form.facts,
        adminNote: form.adminNote,
      };
    })),
  }), [forms, selected, stores]);

  const applyDraft = useCallback((draft: CandidateDraftDto) => {
    const payload = draft.payload && typeof draft.payload === 'object' ? draft.payload as { items?: unknown[] } : {};
    const entries = Array.isArray(payload.items) ? payload.items.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)) : [];
    const nextSelected: Record<string, boolean> = {};
    const entryByItem = new Map<string, Record<string, unknown>>();
    for (const entry of entries) {
      const id = text(entryValue(entry, 'sourceLeadItemId', 'itemId', 'id'));
      if (id) {
        entryByItem.set(id, entry);
        const item = stores.flatMap((store) => store.items).find((candidate) => candidate.id === id);
        const store = item ? stores.find((candidate) => candidate.items.some((candidateItem) => candidateItem.id === item.id)) : undefined;
        nextSelected[id] = Boolean(item && store && !isTerminalStore(store) && !isTerminalItem(item) && entry.selected !== false && entry.checked !== false);
      }
    }
    const nextForms: Record<string, StoreForm> = {};
    for (const store of stores) {
      const next = initialForm(store);
      const relevant = store.items.map((item) => entryByItem.get(item.id)).filter((entry): entry is Record<string, unknown> => Boolean(entry));
      const first = relevant[0];
      if (first) {
        next.placeName = text(entryValue(first, 'placeName', 'place_name')) || next.placeName;
        next.address = text(entryValue(first, 'address'));
        next.zoneName = text(entryValue(first, 'zoneName', 'zone_name'));
        next.placeCategory = text(entryValue(first, 'placeCategory', 'place_category'));
        next.accessType = cleanAccessType(entryValue(first, 'accessType', 'access_type'));
        next.lng = numberOrNull(entryValue(first, 'lng'));
        next.lat = numberOrNull(entryValue(first, 'lat'));
        next.observedAt = text(entryValue(first, 'observedAt', 'observed_date'));
        next.verificationMethod = cleanMethod(entryValue(first, 'verificationMethod', 'verification_method'));
        next.adminNote = text(entryValue(first, 'adminNote', 'admin_note'));
        const facts = entryValue(first, 'facts');
        if (facts && typeof facts === 'object' && !Array.isArray(facts)) next.facts = { ...next.facts, ...(facts as Partial<Facts>) };
      }
      for (const item of store.items) {
        const entry = entryByItem.get(item.id);
        if (!entry) continue;
        next.items[item.id] = {
          name: text(entryValue(entry, 'menuItemName', 'menu_item_name')) || item.itemName,
          category: text(entryValue(entry, 'menuCategory', 'menu_category')),
          price: entryValue(entry, 'priceYuan', 'price_yuan') === '' ? '' : text(entryValue(entry, 'priceYuan', 'price_yuan')),
        };
      }
      nextForms[store.key] = next;
    }
    setForms(nextForms);
    setSelected(nextSelected);
    setDraftId(draft.id);
    setDraftVersion(draft.version);
    setMessageTone('success');
    setMessage(`已恢复草稿 · ${new Date(draft.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
    if (typeof window !== 'undefined') window.localStorage.setItem('candidatePoolDraftId', draft.id);
  }, [stores]);

  const fetchDraft = useCallback(async (id: string) => {
    const response = await fetch(`/api/v1/admin/leads/drafts/${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('找不到这份草稿，已按当前候选线索打开');
    const body = await response.json();
    if (!body.data) throw new Error('草稿内容为空');
    applyDraft(body.data as CandidateDraftDto);
  }, [applyDraft]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/v1/admin/leads?view=grouped&limit=500', { cache: 'no-store' }),
      fetch('/api/v1/config', { cache: 'no-store' }),
      fetch('/api/v1/admin/leads/drafts?limit=8', { cache: 'no-store' }),
    ]).then(async ([groupResponse, configResponse, draftResponse]) => {
      if (!groupResponse.ok) throw new Error('候选线索读取失败，请刷新页面重试');
      const groupBody = await groupResponse.json();
      const configBody = await configResponse.json().catch(() => ({}));
      const draftBody = await draftResponse.json().catch(() => ({}));
      if (cancelled) return;
      setGroups(Array.isArray(groupBody.data) ? groupBody.data : []);
      setZones(Array.isArray(configBody.data?.zones) ? configBody.data.zones : []);
      setDrafts(Array.isArray(draftBody.data) ? draftBody.data : []);
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '候选线索读取失败');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!stores.length) return;
    setForms((current) => {
      const next = { ...current };
      for (const store of stores) if (!next[store.key]) next[store.key] = initialForm(store);
      return next;
    });
    if (!activeKey || !storeMap.has(activeKey)) setActiveKey(stores[0].key);
  }, [activeKey, storeMap, stores]);

  useEffect(() => {
    if (!stores.length || restoredRef.current) return;
    restoredRef.current = true;
    const localId = typeof window !== 'undefined' ? window.localStorage.getItem('candidatePoolDraftId') : '';
    const id = initialDraftId || localId;
    if (id) void fetchDraft(id).catch((reason: unknown) => { setMessageTone('error'); setMessage(reason instanceof Error ? reason.message : '草稿恢复失败'); });
  }, [fetchDraft, initialDraftId, stores.length]);

  async function saveDraft(nextMessage = '草稿已保存') {
    const payload = buildPayload();
    setBusy(true);
    setError('');
    try {
      const token = await getCsrfToken();
      const response = draftId
        ? await fetch(`/api/v1/admin/leads/drafts/${encodeURIComponent(draftId)}`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-csrf-token': token }, body: JSON.stringify({ payload, version: draftVersion }) })
        : await fetch('/api/v1/admin/leads/drafts', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': token }, body: JSON.stringify({ payload }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.data) throw new Error(body.error?.message || '草稿保存失败');
      setDraftId(String(body.data.id));
      setDraftVersion(Number(body.data.version));
      if (typeof window !== 'undefined') window.localStorage.setItem('candidatePoolDraftId', String(body.data.id));
      setDrafts((current) => [body.data as CandidateDraftDto, ...current.filter((draft) => draft.id !== body.data.id)].slice(0, 8));
      setMessageTone('success');
      setMessage(nextMessage);
      return body.data as CandidateDraftDto;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '草稿保存失败');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function selectStore(key: string) {
    if (key === activeKey || busy) return;
    const focusTarget = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (activeKey && stores.length) {
      const saved = await saveDraft('切换前已保存草稿');
      if (!saved) {
        focusTarget?.focus();
        return;
      }
    }
    setActiveKey(key);
    setAttempted(false);
  }

  async function saveAndNext() {
    const index = stores.findIndex((store) => store.key === activeStore?.key);
    const saved = await saveDraft('草稿已保存，已切换到下一家');
    if (!saved) return;
    if (index >= 0 && stores[index + 1]) {
      setActiveKey(stores[index + 1].key);
      setAttempted(false);
    }
  }

  async function enterPreview() {
    setAttempted(true);
    setError('');
    if (!selectedItemCount) {
      setError('请先至少选择一家店和一份餐食');
      return;
    }
    const invalid = stores.find((store) => {
      const items = new Set(store.items.filter((item) => selected[item.id]).map((item) => item.id));
      return Object.keys(validateStore(store, forms[store.key], items)).length > 0;
    });
    if (invalid) {
      setActiveKey(invalid.key);
      setError(`「${invalid.name}」还有必填信息未完成，请按字段提示补齐`);
      return;
    }
    const draft = await saveDraft('正在生成候选导入预览…');
    if (!draft) return;
    setBusy(true);
    try {
      const token = await getCsrfToken();
      const response = await fetch('/api/v1/admin/leads/preview', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': token }, body: JSON.stringify({ draftId: draft.id, version: draft.version }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.data) throw new Error(body.error?.message || '候选预览失败');
      if (!body.data.valid) {
        setError((body.data.errors ?? []).map((item: { field?: string; message: string }) => `${item.field || '字段'}：${item.message}`).join('；') || '候选信息仍有错误');
        return;
      }
      router.push(`/admin/import?draft=${encodeURIComponent(draft.id)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '候选预览失败');
    } finally {
      setBusy(false);
    }
  }

  function updateForm(key: string, patch: Partial<StoreForm>) {
    const fallback = activeStore ?? stores[0];
    if (!fallback) return;
    setForms((current) => ({ ...current, [key]: { ...(current[key] ?? initialForm(fallback)), ...patch } }));
  }

  function updateItem(key: string, itemId: string, patch: Partial<ItemEdit>) {
    const form = forms[key] ?? (storeMap.get(key) ? initialForm(storeMap.get(key)!) : undefined);
    if (!form) return;
    updateForm(key, { items: { ...form.items, [itemId]: { ...(form.items[itemId] ?? { name: '', category: '', price: '' }), ...patch } } });
  }

  function toggleStore(store: StoreGroup, checked: boolean) {
    setSelected((current) => {
      const next = { ...current };
      if (isTerminalStore(store)) return next;
      for (const item of store.items) if (!isTerminalItem(item)) next[item.id] = checked;
      return next;
    });
  }

  if (loading) return <div className="candidate-loading" aria-live="polite">正在读取候选线索……</div>;
  if (error && !stores.length) return <div className="candidate-empty candidate-error-state" role="alert"><strong>{error}</strong><p>请确认已登录，或刷新页面重试。</p></div>;

  return <section className="candidate-workspace" aria-label="候选线索池">
    <div className="candidate-overview">
      <div className="candidate-overview-copy"><p className="kicker">候选池 / CANDIDATE POOL</p><h2>先勾店，再把事实问清楚。</h2><p>候选线索只是发现入口。选中店铺后，在右侧补齐地址、价格和地图位置，确认无误再进入导入预览。</p></div>
      <div className="candidate-overview-metrics"><span><b>{stores.length}</b> 家店</span><span><b>{groups.reduce((sum, group) => sum + group.items.length, 0)}</b> 份线索餐食</span><span><b>{drafts.length}</b> 份最近草稿</span></div>
    </div>
    <div className="candidate-toolbar">
      <label className="candidate-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索店名、餐食或来源" aria-label="搜索候选店铺" /></label>
      <div className="candidate-filters" role="group" aria-label="候选筛选">
        {['all', 'new', 'verifying', 'converted'].map((status) => <button key={status} type="button" className={statusFilter === status ? 'active' : ''} onClick={() => setStatusFilter(status)}>{status === 'all' ? '全部' : statusLabel(status)}</button>)}
        <Select variant="compact" value={riskFilter} onChange={setRiskFilter} ariaLabel="风险筛选" options={[{ value: 'all', label: '风险：全部' }, { value: 'risk', label: '有风险提示' }, { value: 'clean', label: '无风险提示' }]} />
      </div>
      <label className="candidate-draft-select">最近草稿
        <Select variant="bare" className="candidate-draft-control" value="" onChange={(next) => { const selectedDraft = drafts.find((draft) => draft.id === next); if (selectedDraft) applyDraft(selectedDraft); }} ariaLabel="恢复最近草稿" placeholder="选择恢复…" options={[{ value: '', label: '选择恢复…' }, ...drafts.map((draft) => ({ value: draft.id, label: `${new Date(draft.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · v${draft.version}` }))]} />
      </label>
    </div>
    {message && <Notice tone={messageTone} className="candidate-message">{message}</Notice>}
    {!stores.length ? <div className="candidate-empty"><span className="candidate-empty-mark">⌁</span><h3>还没有候选线索</h3><p>先在项目目录运行种入脚本，再回到这里进行核验。</p><code>npm run seed:candidates</code></div> : <>
      <div className="candidate-columns">
        <section className="candidate-list-panel" aria-label="候选店铺列表">
          <div className="candidate-list-heading"><div><p className="kicker">店铺 / STORES</p><h3>{visibleStores.length} 家待看</h3></div><span>{selectedStoreCount} 家已选 · {selectedItemCount} 份餐食</span></div>
          <div className="candidate-store-list">
            {visibleStores.map((store) => {
              const terminalStore = isTerminalStore(store);
              const selectableItems = store.items.filter((item) => !terminalStore && !isTerminalItem(item));
              const count = selectableItems.filter((item) => selected[item.id]).length;
              const all = count === selectableItems.length && count > 0;
              return <article className={`candidate-store-row ${activeStore?.key === store.key ? 'active' : ''}`} key={store.key}>
                <div className="candidate-store-heading">
                  <TriStateCheckbox checked={all} indeterminate={count > 0 && !all} onChange={(checked) => toggleStore(store, checked)} label={`选择${store.name}全部餐食`} disabled={terminalStore} />
                  <button type="button" className="candidate-store-select" onClick={() => void selectStore(store.key)}><strong>{store.name}</strong><span>{count ? `已选 ${count}/${selectableItems.length}` : `${store.items.length} 份餐食`}</span></button>
                  <span className={`candidate-status candidate-status-${store.status}`}>{statusLabel(store.status)}</span>
                </div>
                <div className="candidate-source-line"><span>{store.sourcePlatforms.map(sourceLabel).join('、') || '未知来源'}</span><em>{store.risk || '待现场核验'}</em>{terminalStore && <small className="candidate-terminal-copy">已结束，不能再次选择</small>}</div>
                <div className="candidate-meal-list">
                  {store.items.map((item) => { const disabled = terminalStore || isTerminalItem(item); return <label className="candidate-meal-row" key={item.id}><input type="checkbox" checked={Boolean(selected[item.id])} disabled={disabled} onChange={(event) => setSelected((current) => ({ ...current, [item.id]: event.target.checked }))} aria-label={`选择${store.name}的餐食：${item.itemName}`} /><span className="candidate-meal-copy"><strong>{item.itemName}</strong><small>{item.cluePriceFen === null ? '价格待核验' : `线索价 ¥${(item.cluePriceFen / 100).toFixed(0)}`}</small></span><span className={`candidate-item-status candidate-item-status-${item.status}`}>{statusLabel(item.status)}</span>{disabled && <small className="candidate-terminal-copy">已结束</small>}</label>; })}
                </div>
                <div className="candidate-source-links">{store.sourceUrls.slice(0, 2).map((url) => <a href={url} target="_blank" rel="noreferrer" key={url}>查看来源 ↗</a>)}</div>
              </article>;
            })}
            {!visibleStores.length && <div className="candidate-filter-empty">没有符合筛选条件的店铺。</div>}
          </div>
        </section>
        {activeStore && activeForm && <section className="candidate-detail-panel" aria-label="候选店铺核验详情">
          <div className="candidate-detail-header"><div><p className="kicker">核验 / {stores.findIndex((store) => store.key === activeStore.key) + 1} OF {stores.length}</p><h3>{activeStore.name}</h3><p>{activeStore.summary || '先确认店铺事实，再确认每份餐食。'}</p></div><span className="candidate-detail-progress">{activeSelected.size}/{activeStore.items.length} 份已选</span></div>
          <div className="candidate-form-grid">
            <label className="candidate-field candidate-field-wide">店名
              <input value={activeForm.placeName} onChange={(event) => updateForm(activeStore.key, { placeName: event.target.value })} aria-label="店名" aria-invalid={Boolean(attempted && activeErrors.placeName)} aria-describedby={attempted && activeErrors.placeName ? errorId(activeStore.key, 'placeName') : undefined} />
              {attempted && activeErrors.placeName && <FieldError id={errorId(activeStore.key, 'placeName')} text={activeErrors.placeName} />}
            </label>
            <label className="candidate-field candidate-field-wide">完整地址
              <textarea rows={2} value={activeForm.address} onChange={(event) => updateForm(activeStore.key, { address: event.target.value })} aria-label="完整地址" aria-invalid={Boolean(attempted && activeErrors.address)} aria-describedby={attempted && activeErrors.address ? errorId(activeStore.key, 'address') : undefined} placeholder="街道、门牌、楼栋或入口" />
              {attempted && activeErrors.address && <FieldError id={errorId(activeStore.key, 'address')} text={activeErrors.address} />}
            </label>
            <label className="candidate-field">启用片区
              <Select value={activeForm.zoneName} onChange={(next) => updateForm(activeStore.key, { zoneName: next })} ariaLabel="启用片区" placeholder="选择片区" ariaInvalid={Boolean(attempted && activeErrors.zoneName)} ariaDescribedBy={attempted && activeErrors.zoneName ? errorId(activeStore.key, 'zoneName') : undefined} options={[...(activeForm.zoneName && !zones.some((zone) => zone.name === activeForm.zoneName) ? [{ value: activeForm.zoneName, label: activeForm.zoneName }] : []), ...zones.map((zone) => ({ value: zone.name, label: zone.name }))]} />
              {attempted && activeErrors.zoneName && <FieldError id={errorId(activeStore.key, 'zoneName')} text={activeErrors.zoneName} />}
            </label>
            <label className="candidate-field">店铺类别
              <Select value={activeForm.placeCategory} onChange={(next) => updateForm(activeStore.key, { placeCategory: next })} ariaLabel="店铺类别" ariaInvalid={Boolean(attempted && activeErrors.placeCategory)} ariaDescribedBy={attempted && activeErrors.placeCategory ? errorId(activeStore.key, 'placeCategory') : undefined} options={PLACE_CATEGORIES.map((category) => ({ value: category, label: category }))} />
              {attempted && activeErrors.placeCategory && <FieldError id={errorId(activeStore.key, 'placeCategory')} text={activeErrors.placeCategory} />}
            </label>
            <label className="candidate-field">准入类型
              <Select value={activeForm.accessType} onChange={(next) => updateForm(activeStore.key, { accessType: next })} ariaLabel="准入类型" placeholder="选择准入类型" ariaInvalid={Boolean(attempted && activeErrors.accessType)} ariaDescribedBy={attempted && activeErrors.accessType ? errorId(activeStore.key, 'accessType') : undefined} options={ACCESS_TYPES.map(([code, label]) => ({ value: code, label }))} />
              {attempted && activeErrors.accessType && <FieldError id={errorId(activeStore.key, 'accessType')} text={activeErrors.accessType} />}
            </label>
          </div>
          <CoordinatePicker value={{ lng: activeForm.lng, lat: activeForm.lat }} onChange={(next) => updateForm(activeStore.key, next)} error={attempted ? activeErrors.coordinates : undefined} />
          <section className="candidate-meal-verification"><div className="candidate-section-heading"><div><p className="kicker">餐食 / MEALS</p><h4>确认选中的餐食</h4></div><span>常规正价 ≤ 25 元</span></div>{activeSelected.size ? activeStore.items.filter((item) => activeSelected.has(item.id)).map((item) => { const edit = activeForm.items[item.id] ?? { name: item.itemName, category: '', price: '' }; return <div className="candidate-meal-edit" key={item.id}><div className="candidate-meal-edit-title"><strong>{item.itemName}</strong><small>{item.cluePriceFen === null ? '线索未给价格' : `线索价 ¥${(item.cluePriceFen / 100).toFixed(0)}`}</small></div><label>餐食名称<input value={edit.name} onChange={(event) => updateItem(activeStore.key, item.id, { name: event.target.value })} aria-label={`餐食名称：${item.itemName}`} aria-invalid={Boolean(attempted && activeErrors[`item.${item.id}.name`])} aria-describedby={attempted && activeErrors[`item.${item.id}.name`] ? errorId(item.id, 'name') : undefined} />{attempted && activeErrors[`item.${item.id}.name`] && <FieldError id={errorId(item.id, 'name')} text={activeErrors[`item.${item.id}.name`]} />}</label><label>餐食类别<input value={edit.category} onChange={(event) => updateItem(activeStore.key, item.id, { category: event.target.value })} aria-label={`餐食类别：${item.itemName}`} aria-invalid={Boolean(attempted && activeErrors[`item.${item.id}.category`])} aria-describedby={attempted && activeErrors[`item.${item.id}.category`] ? errorId(item.id, 'category') : undefined} placeholder="例如：米饭、粉面、套餐" />{attempted && activeErrors[`item.${item.id}.category`] && <FieldError id={errorId(item.id, 'category')} text={activeErrors[`item.${item.id}.category`]} />}</label><label>当前常规价（元）<input type="number" min="0.01" max="25" step="0.01" inputMode="decimal" value={edit.price} onChange={(event) => updateItem(activeStore.key, item.id, { price: event.target.value })} aria-label={`当前常规价（元）：${item.itemName}`} aria-invalid={Boolean(attempted && activeErrors[`item.${item.id}.price`])} aria-describedby={attempted && activeErrors[`item.${item.id}.price`] ? errorId(item.id, 'price') : undefined} />{attempted && activeErrors[`item.${item.id}.price`] && <FieldError id={errorId(item.id, 'price')} text={activeErrors[`item.${item.id}.price`]} />}</label></div>; }) : <p className="candidate-no-meal">先从左侧勾选要核验的餐食。</p>}</section>
          <section className="candidate-facts"><div className="candidate-section-heading"><div><p className="kicker">事实确认 / FACTS</p><h4>三件事都确认，再进入预览</h4></div><span>可同店共用</span></div><div className="candidate-fact-grid"><FactCheck checked={activeForm.facts.open} onChange={(checked) => updateForm(activeStore.key, { facts: { ...activeForm.facts, open: checked } })} text="仍在营业且门头一致" error={attempted ? activeErrors.factOpen : undefined} /><FactCheck checked={activeForm.facts.regularPrice} onChange={(checked) => updateForm(activeStore.key, { facts: { ...activeForm.facts, regularPrice: checked } })} text="常规正价，非优惠摊薄" error={attempted ? activeErrors.factPrice : undefined} /><FactCheck checked={activeForm.facts.oneMeal} onChange={(checked) => updateForm(activeStore.key, { facts: { ...activeForm.facts, oneMeal: checked } })} text="确实可作为一人一餐" error={attempted ? activeErrors.factMeal : undefined} /></div></section>
          <div className="candidate-verification-fields"><label>核验日期<input type="date" value={activeForm.observedAt} onChange={(event) => updateForm(activeStore.key, { observedAt: event.target.value })} aria-label="核验日期" aria-invalid={Boolean(attempted && activeErrors.observedAt)} aria-describedby={attempted && activeErrors.observedAt ? errorId(activeStore.key, 'observedAt') : undefined} />{attempted && activeErrors.observedAt && <FieldError id={errorId(activeStore.key, 'observedAt')} text={activeErrors.observedAt} />}</label><label>核验方式<Select value={activeForm.verificationMethod} onChange={(next) => updateForm(activeStore.key, { verificationMethod: next })} ariaLabel="核验方式" placeholder="选择方式（不能使用来源线索）" ariaInvalid={Boolean(attempted && activeErrors.verificationMethod)} ariaDescribedBy={attempted && activeErrors.verificationMethod ? errorId(activeStore.key, 'verificationMethod') : undefined} options={VERIFIED_METHODS.map(([code, label]) => ({ value: code, label }))} />{attempted && activeErrors.verificationMethod && <FieldError id={errorId(activeStore.key, 'verificationMethod')} text={activeErrors.verificationMethod} />}</label></div>
          <label className="candidate-note-field">后台备注（可选）<textarea rows={2} value={activeForm.adminNote} onChange={(event) => updateForm(activeStore.key, { adminNote: event.target.value })} aria-label="后台备注" placeholder="记录现场看到的补充信息，不会展示在用户端" /></label>
          <div className="candidate-detail-actions"><button className="secondary-button" type="button" onClick={() => void saveDraft()} disabled={busy}>保存草稿</button><button className="primary-button" type="button" onClick={() => void saveAndNext()} disabled={busy}>保存并下一家 <span>→</span></button></div>
        </section>}
      </div>
      {(error || attempted && selectedItemCount > 0 && Object.keys(activeErrors).length > 0) && <p className="candidate-global-error" role="alert" aria-live="assertive">{error || '当前店铺还有必填信息未完成，请按红色提示补齐。'}</p>}
      <div className="candidate-action-bar"><div><strong>已准备 {selectedStoreCount} 家 / {selectedItemCount} 份餐食</strong><span>{selectedItemCount ? '只会把勾选且核验完整的内容送入预览' : '先在左侧勾选店铺或餐食'}</span></div><button className="primary-button" type="button" onClick={() => void enterPreview()} disabled={busy || !selectedItemCount}>进入导入预览 <span>↗</span></button></div>
    </>}
  </section>;
}

function FieldError({ id, text: message }: { id: string; text: string }) {
  return <small className="field-error" id={id} role="alert">{message}</small>;
}

function FactCheck({ checked, onChange, text: label, error }: { checked: boolean; onChange: (checked: boolean) => void; text: string; error?: string }) {
  const id = `fact-${stableKey(label)}`;
  return <label className="candidate-fact-check"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label={label} aria-invalid={Boolean(error)} aria-describedby={error ? id : undefined} /><span>{label}</span>{error && <small id={id} className="field-error">{error}</small>}</label>;
}
