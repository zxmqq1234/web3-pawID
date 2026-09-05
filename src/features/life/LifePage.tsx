import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  CalendarDays,
  Camera,
  ChevronRight,
  Clock3,
  FileText,
  LockKeyhole,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  Credential,
  CredentialSource,
  LifeEvent,
  LifeEventInput,
  LifeEventType,
  LifeEventVisibility,
} from '../../domain/types';
import { createEntityId } from '../../store/actions';
import { useDemoStore } from '../../store/DemoProvider';
import { getImage, saveImage } from '../../store/storage';
import {
  Button,
  ConfirmDialog,
  DemoBadge,
  Drawer,
  EmptyState,
  InputField,
  Modal,
  SelectField,
  StatusTag,
  useToast,
} from '../../shared/ui';
import './LifePage.css';

/** 顶部筛选项与生命记录类型保持一一对应，避免 UI 自己定义业务分类。 */
type LifeFilter = 'all' | LifeEventType;

/** 编辑器只保存当前表单需要的值，上传文件不写入 Store。 */
interface LifeFormState {
  type: LifeEventType;
  title: string;
  date: string;
  description: string;
  visibility: LifeEventVisibility;
  photoFile: File | null;
  removePhoto: boolean;
}

/** 表单错误只在对应字段附近展示，提交失败时不丢失用户输入。 */
type LifeFormErrors = Partial<Record<'title' | 'date' | 'description' | 'photo', string>>;

/** 统一的页面筛选文案。 */
const FILTERS: ReadonlyArray<{ value: LifeFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'family', label: '家庭' },
  { value: 'health', label: '健康' },
  { value: 'birthday', label: '生日' },
  { value: 'travel', label: '旅行' },
  { value: 'daily', label: '日常' },
];

/** 记录类型文案用于表单、卡片和详情，值始终沿用 domain 类型。 */
const EVENT_TYPES: ReadonlyArray<{ value: LifeEventType; label: string }> = [
  { value: 'family', label: '家庭' },
  { value: 'health', label: '健康' },
  { value: 'birthday', label: '生日' },
  { value: 'travel', label: '旅行' },
  { value: 'daily', label: '日常' },
];

/** 凭证来源的显式中文映射，机构示例永远带有演示边界。 */
const CREDENTIAL_SOURCE_LABELS: Record<CredentialSource, string> = {
  user_filled: '用户填写',
  mutual_confirmed: '双方确认',
  institution_demo: '机构认证（示例）',
};

/** 将日期输入限制到浏览器本地今天，避免把未来记录写入 Store。 */
function getTodayString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** 中文日期展示不依赖时区解析，兼容日期型和 ISO 型演示数据。 */
function formatDate(value: string): string {
  const date = value.slice(0, 10).split('-');
  if (date.length !== 3) return value;
  return `${date[0]} 年 ${date[1]} 月 ${date[2]} 日`;
}

/** 将代码点数量用于中文标题和描述的长度校验。 */
function textLength(value: string): number {
  return Array.from(value).length;
}

/** 统一展示未知异常，避免把对象或内部堆栈直接泄露给用户。 */
function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** 上传限制与 PRD 保持一致，只允许一张 5MB 内的常见图片。 */
function validatePhoto(file: File): string | null {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowedTypes.has(file.type)) return '仅支持 JPG、PNG 或 WebP 图片。';
  if (file.size > 5 * 1024 * 1024) return '照片不能超过 5MB。';
  return null;
}

/** 创建新增或编辑生命记录的初始表单，不读取任何公开 PawTag 字段。 */
function createFormState(event?: LifeEvent): LifeFormState {
  return {
    type: event?.type ?? 'daily',
    title: event?.title ?? '',
    date: event?.date ?? getTodayString(),
    description: event?.description ?? '',
    visibility: event?.visibility ?? 'family',
    photoFile: null,
    removePhoto: false,
  };
}

/** 对提交前的字段做同步校验，确保错误原位显示且不触发异步操作。 */
function validateForm(form: LifeFormState): LifeFormErrors {
  const errors: LifeFormErrors = {};
  const title = form.title.trim();
  if (!title) errors.title = '请输入记录标题。';
  else if (textLength(title) > 30) errors.title = '标题最多 30 个字。';

  if (!form.date) errors.date = '请选择记录日期。';
  else if (form.date > getTodayString()) errors.date = '日期不能晚于今天。';

  if (textLength(form.description) > 500) errors.description = '描述最多 500 个字。';
  if (form.photoFile) {
    const photoError = validatePhoto(form.photoFile);
    if (photoError) errors.photo = photoError;
  }
  return errors;
}

/** 读取 IndexedDB 中的单张图片并在组件卸载时释放对象 URL。 */
function StoredPhoto({ photoKey, alt }: { photoKey: string; alt: string }): JSX.Element | null {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setPhotoUrl(null);
    void getImage(photoKey)
      .then((blob) => {
        if (!active || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setPhotoUrl(objectUrl);
      })
      .catch(() => {
        // 图片缺失时让记录正文继续可读，降级为无照片展示。
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoKey]);

  return photoUrl ? <img className="life-photo" src={photoUrl} alt={alt} /> : null;
}

/** 为新选文件生成预览 URL，取消选择或关闭弹窗时自动清理。 */
function FilePreview({ file }: { file: File }): JSX.Element {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setPhotoUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return photoUrl ? <img className="life-photo life-photo-preview" src={photoUrl} alt="待上传的记录照片预览" /> : <span>正在生成预览…</span>;
}

/** 生命档案主页面：管理时间线、凭证查看和手动记录的本地演示交互。 */
export default function LifePage({ petId }: { petId: string }): JSX.Element {
  const { state, actions, selectors } = useDemoStore();
  const { showError, showSuccess } = useToast();
  const pet = selectors.getPetById(state, petId);
  const canManage = pet ? selectors.canManagePet(state, petId) : false;

  const [filter, setFilter] = useState<LifeFilter>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [credentialInfoOpen, setCredentialInfoOpen] = useState(false);
  const [deleteEvent, setDeleteEvent] = useState<LifeEvent | null>(null);
  const [operation, setOperation] = useState<'save' | 'delete' | null>(null);
  const [form, setForm] = useState<LifeFormState>(() => createFormState());
  const [formErrors, setFormErrors] = useState<LifeFormErrors>({});
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  const filterButtonRefs = useRef<Record<LifeFilter, HTMLButtonElement | null>>({
    all: null,
    family: null,
    health: null,
    birthday: null,
    travel: null,
    daily: null,
  });

  const events = useMemo(() => {
    const allEvents = pet ? selectors.getPetEvents(state, petId) : [];
    return filter === 'all' ? allEvents : allEvents.filter((event) => event.type === filter);
  }, [filter, pet, petId, selectors, state]);
  const credentials = useMemo(() => (pet ? selectors.getPetCredentials(state, petId) : []), [pet, petId, selectors, state]);
  const detailEvent = useMemo(
    () => state.lifeEvents.find((event) => event.id === detailEventId) ?? null,
    [detailEventId, state.lifeEvents],
  );
  const selectedCredential = useMemo(
    () => credentials.find((credential) => credential.id === credentialId) ?? null,
    [credentialId, credentials],
  );
  const editingEvent = useMemo(
    () => state.lifeEvents.find((event) => event.id === editingEventId && event.source === 'manual') ?? null,
    [editingEventId, state.lifeEvents],
  );

  /** 用左右、Home、End 键切换筛选，按钮本身仍可用 Tab 和 Enter 操作。 */
  const handleFilterKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, current: LifeFilter): void => {
    const currentIndex = FILTERS.findIndex((item) => item.value === current);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % FILTERS.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + FILTERS.length) % FILTERS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = FILTERS.length - 1;
    if (nextIndex === currentIndex) return;
    event.preventDefault();
    const next = FILTERS[nextIndex].value;
    setFilter(next);
    filterButtonRefs.current[next]?.focus();
  };

  /** 打开新增表单并清空上一次编辑状态，默认可见性为仅家庭。 */
  const openCreateEditor = (): void => {
    setEditingEventId(null);
    setForm(createFormState());
    setFormErrors({});
    setPhotoNotice(null);
    setEditorOpen(true);
  };

  /** 打开手动记录编辑表单；系统事件不会进入此路径。 */
  const openEditEditor = (event: LifeEvent): void => {
    if (!canManage || event.source !== 'manual') return;
    setEditingEventId(event.id);
    setForm(createFormState(event));
    setFormErrors({});
    setPhotoNotice(null);
    setEditorOpen(true);
  };

  /** 保存中的弹窗不允许被关闭，避免用户误以为异步操作已取消。 */
  const closeEditor = (): void => {
    if (operation === 'save') return;
    setEditorOpen(false);
  };

  /** 文件选择即时校验；无效图片不会进入提交逻辑。 */
  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    const photoError = validatePhoto(file);
    if (photoError) {
      setForm((current) => ({ ...current, photoFile: null }));
      setFormErrors((current) => ({ ...current, photo: photoError }));
      event.currentTarget.value = '';
      return;
    }
    setForm((current) => ({ ...current, photoFile: file, removePhoto: false }));
    setFormErrors((current) => ({ ...current, photo: undefined }));
    setPhotoNotice(null);
  };

  /** 新增和编辑共用提交逻辑：先尝试保存 Blob，再只把 photoKey 交给 Store action。 */
  const handleEditorSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const errors = validateForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0 || !pet || !canManage || operation === 'save') return;

    setOperation('save');
    let photoKeys = editingEvent?.photoKeys ?? [];
    if (form.removePhoto) photoKeys = [];
    if (form.photoFile) {
      const photoKey = createEntityId('life-photo');
      try {
        await saveImage(photoKey, form.photoFile);
        photoKeys = [photoKey];
      } catch {
        setPhotoNotice('照片保存失败，可不附照片继续保存这条记录。');
        showError('照片保存失败，可不附照片继续保存这条记录。');
      }
    }

    const input: LifeEventInput = {
      petId,
      type: form.type,
      title: form.title.trim(),
      date: form.date,
      description: form.description.trim(),
      photoKeys,
      visibility: form.visibility,
    };

    try {
      if (editingEventId) {
        await actions.updateLifeEvent(editingEventId, input);
        showSuccess('生命记录已更新。');
      } else {
        await actions.addLifeEvent(input);
        showSuccess('生命记录已添加。');
      }
      setEditorOpen(false);
      setEditingEventId(null);
      setForm(createFormState());
      setFormErrors({});
      setPhotoNotice(null);
    } catch (error) {
      showError(getErrorMessage(error, '保存生命记录失败，请保留表单后重试。'));
    } finally {
      setOperation(null);
    }
  };

  /** 删除只调用 Store 删除 action，不触碰积分明细和首次奖励资格。 */
  const handleDelete = async (event: LifeEvent | null): Promise<void> => {
    if (!event || !canManage || event.source !== 'manual' || operation === 'delete') return;
    setOperation('delete');
    try {
      await actions.deleteLifeEvent(event.id);
      showSuccess('生命记录已删除，积分奖励资格保持不变。');
      setDeleteEvent(null);
      setDetailEventId((current) => (current === event.id ? null : current));
    } catch (error) {
      showError(getErrorMessage(error, '删除生命记录失败，请稍后重试。'));
    } finally {
      setOperation(null);
    }
  };

  if (!pet) {
    return <EmptyState
      title="找不到这只宠物"
      description={`宠物 ID「${petId}」不存在于当前演示浏览器，请返回示例档案继续体验。`}
      action={<Button onClick={() => { window.location.hash = '#/pets/mochi?tab=life'; }}>体验 Mochi 的生命档案</Button>}
    />;
  }

  return <section className="life-page" aria-labelledby="life-page-title">
    <header className="life-page-header">
      <div>
        <div className="life-eyebrow"><span>PAWID / LIFE ARCHIVE</span><DemoBadge /></div>
        <h1 id="life-page-title">{pet.name} 的生命档案</h1>
        <p>把一起生活的片段，整理成只属于它的时间线。</p>
      </div>
      <div className="life-header-actions">
        <StatusTag tone={canManage ? 'success' : 'neutral'}>{canManage ? '可编辑' : '只读模式'}</StatusTag>
        {canManage && <Button onClick={openCreateEditor}><Plus size={17} aria-hidden="true" />新增记录</Button>}
      </div>
    </header>

    <div className="life-privacy-note" role="note">
      <LockKeyhole size={16} aria-hidden="true" />
      <span>{canManage ? '生命记录按既有可见性保存；私密描述不会主动进入 PawTag。' : '当前为只读访问，私密生命记录不会被修改或公开。'}</span>
    </div>

    <div className="life-filter-row">
      <div className="life-filter-heading"><Clock3 size={17} aria-hidden="true" /><span>时间线筛选</span></div>
      <div className="life-filters" role="tablist" aria-label="生命档案类型筛选">
        {FILTERS.map((item) => <button
          className={`life-filter ${filter === item.value ? 'is-active' : ''}`}
          key={item.value}
          type="button"
          role="tab"
          aria-selected={filter === item.value}
          aria-controls="life-event-list"
          data-filter={item.value}
          ref={(node) => { filterButtonRefs.current[item.value] = node; }}
          onClick={() => setFilter(item.value)}
          onKeyDown={(event) => handleFilterKeyDown(event, item.value)}
        >{item.label}</button>)}
      </div>
    </div>

    <div className="life-workspace">
      <section className="life-panel life-timeline-panel" aria-labelledby="timeline-title">
        <div className="life-panel-heading">
          <div>
            <span className="life-section-kicker">LIFE MOMENTS</span>
            <h2 id="timeline-title">成长时间线</h2>
          </div>
          <span className="life-count">{events.length} 条记录</span>
        </div>
        <div id="life-event-list" className="life-event-list" role="tabpanel" aria-live="polite">
          {events.length > 0 ? events.map((event) => <LifeEventCard
            key={event.id}
            event={event}
            canManage={canManage}
            onDetail={() => setDetailEventId(event.id)}
            onEdit={() => openEditEditor(event)}
            onDelete={() => setDeleteEvent(event)}
          />) : <EmptyState
            title={filter === 'all' ? '还没有生命记录' : '这个分类暂时没有记录'}
            description={filter === 'all' ? '从今天的小事开始，留下它成长的证据。' : '换一个筛选，或新增一条属于它的记录。'}
            action={canManage
              ? <Button onClick={openCreateEditor}><Plus size={16} aria-hidden="true" />新增第一条记录</Button>
              : <Button variant="secondary" onClick={() => setFilter('all')}>查看全部记录</Button>}
          />}
        </div>
      </section>

      <aside className="life-panel life-credential-panel" aria-labelledby="credential-title">
        <div className="life-panel-heading">
          <div>
            <span className="life-section-kicker">CREDENTIALS</span>
            <h2 id="credential-title">凭证</h2>
          </div>
          <ShieldCheck size={20} aria-hidden="true" />
        </div>
        <p className="life-panel-intro">仅展示预置演示凭证，来源与状态会在详情中明确说明。</p>
        <div className="life-credential-list">
          {credentials.length > 0 ? credentials.map((credential) => <CredentialCard
            key={credential.id}
            credential={credential}
            onOpen={() => setCredentialId(credential.id)}
          />) : <EmptyState
            title="暂无预置凭证"
            description="手动健康记录只保留为用户填写，不会自动生成机构凭证。"
            action={<Button variant="secondary" onClick={() => setCredentialInfoOpen(true)}>查看凭证说明</Button>}
          />}
        </div>
        <div className="life-credential-footnote"><FileText size={15} aria-hidden="true" />凭证不代表真实机构签发或真实医疗认证。</div>
      </aside>
    </div>

    <Modal open={editorOpen} onClose={closeEditor} title={editingEvent ? '编辑生命记录' : '新增生命记录'} className="life-editor-modal">
      <form className="life-form" onSubmit={(event) => { void handleEditorSubmit(event); }} noValidate>
        <div className="life-form-intro"><span className="life-form-step">{editingEvent ? 'EDIT' : 'NEW'}</span><p>记录会保存到 {pet.name} 的家庭档案中。</p></div>
        <SelectField label="类型" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as LifeEventType }))}>
          {EVENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </SelectField>
        <InputField
          label="标题"
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          error={formErrors.title}
          placeholder="例如：第一次去海边"
          maxLength={30}
          required
        />
        <div className="life-character-count">{textLength(form.title)}/30</div>
        <InputField
          label="日期"
          type="date"
          value={form.date}
          onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
          error={formErrors.date}
          max={getTodayString()}
          required
        />
        <label className="field life-textarea-field" htmlFor="life-description">
          <span>描述</span>
          <textarea
            id="life-description"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            maxLength={500}
            rows={4}
            placeholder="写下这一天值得记住的细节"
            aria-invalid={Boolean(formErrors.description)}
          />
          <span className="life-description-footer">{textLength(form.description)}/500</span>
          {formErrors.description && <small className="field-error">{formErrors.description}</small>}
        </label>
        <label className="field life-photo-field" htmlFor="life-photo-upload">
          <span>照片（可选）</span>
          <span className="life-upload-control"><Upload size={16} aria-hidden="true" /><span>{form.photoFile ? '更换照片' : '选择一张照片'}</span><input id="life-photo-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} /></span>
          <small className="life-field-hint">支持 JPG、PNG、WebP，单张不超过 5MB。</small>
          {form.photoFile && <span className="life-photo-preview-box"><FilePreview file={form.photoFile} /><Button type="button" variant="ghost" onClick={() => setForm((current) => ({ ...current, photoFile: null }))}>取消新照片</Button></span>}
          {!form.photoFile && editingEvent && editingEvent.photoKeys.length > 0 && !form.removePhoto && <span className="life-existing-photo"><StoredPhoto photoKey={editingEvent.photoKeys[0]} alt="当前记录照片" /><span>保留当前照片</span><Button type="button" variant="ghost" onClick={() => setForm((current) => ({ ...current, removePhoto: true }))}>移除照片</Button></span>}
          {form.removePhoto && <span className="life-remove-photo">提交后将移除当前照片。<Button type="button" variant="ghost" onClick={() => setForm((current) => ({ ...current, removePhoto: false }))}>恢复当前照片</Button></span>}
          {formErrors.photo && <small className="field-error">{formErrors.photo}</small>}
          {photoNotice && <small className="field-error">{photoNotice}</small>}
        </label>
        <SelectField label="可见性" value={form.visibility} onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value as LifeEventVisibility }))}>
          <option value="family">仅家庭成员</option>
          <option value="public">公开资料</option>
        </SelectField>
        <p className="life-visibility-hint"><LockKeyhole size={14} aria-hidden="true" />不会自动把描述、健康详情或家庭成员信息写入 PawTag。</p>
        <div className="button-row life-form-actions">
          <Button type="button" variant="secondary" onClick={closeEditor} disabled={operation === 'save'}>取消</Button>
          <Button type="submit" disabled={operation === 'save'}>{operation === 'save' ? '保存中…' : editingEvent ? '保存修改' : '保存记录'}</Button>
        </div>
      </form>
    </Modal>

    <Modal open={Boolean(detailEvent)} onClose={() => setDetailEventId(null)} title={detailEvent ? `记录详情 · ${detailEvent.title}` : '记录详情'} className="life-detail-modal">
      {detailEvent && <LifeEventDetail
        event={detailEvent}
        canManage={canManage}
        onEdit={() => { setDetailEventId(null); openEditEditor(detailEvent); }}
        onDelete={() => setDeleteEvent(detailEvent)}
      />}
    </Modal>

    <Drawer open={Boolean(selectedCredential)} onClose={() => setCredentialId(null)} title={selectedCredential?.title ?? '凭证详情'} className="life-credential-drawer">
      {selectedCredential && <CredentialDetail credential={selectedCredential} />}
    </Drawer>

    <Drawer open={credentialInfoOpen} onClose={() => setCredentialInfoOpen(false)} title="凭证说明" className="life-credential-drawer">
      <div className="life-info-drawer">
        <div className="life-info-icon"><ShieldCheck size={24} aria-hidden="true" /></div>
        <h3>来源清楚，边界清楚</h3>
        <p>本页面的凭证只是本地演示数据。来源会映射为“用户填写”“双方确认”或“机构认证（示例）”，绝不暗示真实机构已经签发。</p>
        <p>手动新增的健康记录属于用户填写，不会自动生成机构凭证。</p>
        <Button variant="secondary" onClick={() => setCredentialInfoOpen(false)}>知道了</Button>
      </div>
    </Drawer>

    <ConfirmDialog
      open={Boolean(deleteEvent)}
      onClose={() => { if (operation !== 'delete') setDeleteEvent(null); }}
      onConfirm={() => { void handleDelete(deleteEvent); }}
      title="删除这条生命记录？"
    >
      删除后记录将从时间线移除；已获得的首次手动记录奖励不会重置，也不会再次发放。
    </ConfirmDialog>
  </section>;
}

/** 单条时间线卡片只暴露当前档案字段，系统记录始终标记为只读。 */
function LifeEventCard({
  event,
  canManage,
  onDetail,
  onEdit,
  onDelete,
}: {
  event: LifeEvent;
  canManage: boolean;
  onDetail: () => void;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  const typeLabel = EVENT_TYPES.find((item) => item.value === event.type)?.label ?? event.type;
  const isSystem = event.source === 'system';
  return <article className={`life-event-card ${isSystem ? 'is-system' : 'is-manual'}`}>
    <div className="life-event-marker" aria-hidden="true"><span /></div>
    <div className="life-event-content">
      <div className="life-event-topline"><span className="life-event-type">{typeLabel}</span><time dateTime={event.date}>{formatDate(event.date)}</time></div>
      <h3>{event.title}</h3>
      <p>{event.description || '这条记录没有附加描述。'}</p>
      <div className="life-event-meta">
        <StatusTag tone={isSystem ? 'neutral' : 'success'}>{isSystem ? '系统事件 · 只读' : '用户填写'}</StatusTag>
        <span>{event.visibility === 'family' ? '仅家庭成员' : '公开资料'}</span>
        {event.photoKeys.length > 0 && <span className="life-photo-indicator"><Camera size={14} aria-hidden="true" />含照片</span>}
      </div>
      <div className="life-event-actions">
        <Button variant="ghost" onClick={onDetail}>查看详情<ChevronRight size={15} aria-hidden="true" /></Button>
        {!isSystem && canManage && <Button variant="ghost" onClick={onEdit}><Pencil size={15} aria-hidden="true" />编辑</Button>}
        {!isSystem && canManage && <Button variant="ghost" className="life-delete-button" onClick={onDelete}><Trash2 size={15} aria-hidden="true" />删除</Button>}
      </div>
    </div>
  </article>;
}

/** 记录详情弹窗同时支持只读查看和手动记录的恢复性操作。 */
function LifeEventDetail({
  event,
  canManage,
  onEdit,
  onDelete,
}: {
  event: LifeEvent;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  const isSystem = event.source === 'system';
  return <div className="life-detail-content">
    <div className="life-detail-badges">
      <StatusTag tone={isSystem ? 'neutral' : 'success'}>{isSystem ? '系统事件 · 只读' : '用户填写'}</StatusTag>
      <span>{EVENT_TYPES.find((item) => item.value === event.type)?.label ?? event.type}</span>
      <span>{event.visibility === 'family' ? '仅家庭成员' : '公开资料'}</span>
    </div>
    <div className="life-detail-date"><CalendarDays size={17} aria-hidden="true" />{formatDate(event.date)}</div>
    <p className="life-detail-description">{event.description || '这条记录没有附加描述。'}</p>
    {event.photoKeys.length > 0 && <div className="life-detail-photos"><StoredPhoto photoKey={event.photoKeys[0]} alt={`${event.title} 的记录照片`} /></div>}
    <div className="life-detail-source"><span>记录来源</span><strong>{isSystem ? 'PawID 演示系统事件' : '用户手动填写'}</strong><small>{isSystem ? '系统生成内容不能编辑或删除。' : '这是家庭生命档案中的手动记录。'}</small></div>
    {!isSystem && canManage && <div className="button-row life-detail-actions"><Button onClick={onEdit}><Pencil size={16} aria-hidden="true" />编辑记录</Button><Button variant="danger" onClick={onDelete}><Trash2 size={16} aria-hidden="true" />删除记录</Button></div>}
  </div>;
}

/** 凭证卡只展示演示元信息，点击后进入右侧详情抽屉。 */
function CredentialCard({ credential, onOpen }: { credential: Credential; onOpen: () => void }): JSX.Element {
  return <button className="life-credential-card" type="button" onClick={onOpen}>
    <span className="life-credential-card-icon"><ShieldCheck size={18} aria-hidden="true" /></span>
    <span className="life-credential-card-main"><strong>{credential.title}</strong><span>{CREDENTIAL_SOURCE_LABELS[credential.source]}</span></span>
    <span className="life-credential-card-side"><StatusTag tone={credential.status === 'valid' ? 'success' : credential.status === 'pending' ? 'pending' : 'danger'}>{credential.status === 'valid' ? '有效' : credential.status === 'pending' ? '待确认' : '已过期'}</StatusTag><ChevronRight size={17} aria-hidden="true" /></span>
  </button>;
}

/** 凭证抽屉完整展示签发者、时间、状态、摘要与来源边界。 */
function CredentialDetail({ credential }: { credential: Credential }): JSX.Element {
  const isDemoInstitution = credential.source === 'institution_demo';
  return <div className="life-credential-detail">
    <div className="life-credential-detail-hero"><div className="life-credential-card-icon"><ShieldCheck size={23} aria-hidden="true" /></div><DemoBadge /></div>
    <StatusTag tone={credential.status === 'valid' ? 'success' : credential.status === 'pending' ? 'pending' : 'danger'}>{credential.status === 'valid' ? '有效' : credential.status === 'pending' ? '待确认' : '已过期'}</StatusTag>
    <dl className="life-credential-fields">
      <div><dt>来源</dt><dd>{CREDENTIAL_SOURCE_LABELS[credential.source]}</dd></div>
      <div><dt>签发者</dt><dd>{credential.issuer}</dd></div>
      <div><dt>签发时间</dt><dd>{formatDate(credential.issuedAt)}</dd></div>
      <div><dt>演示摘要</dt><dd>{credential.summary}</dd></div>
    </dl>
    <div className="life-demo-boundary"><ShieldCheck size={16} aria-hidden="true" /><span>{isDemoInstitution ? '这是机构认证（示例），不代表真实机构签发或真实医疗认证。' : '该凭证仅用于 PawID 前端演示，不构成真实认证。'}</span></div>
  </div>;
}
