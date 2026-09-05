import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Award,
  CalendarDays,
  Camera,
  CheckCircle2,
  Edit3,
  FileBadge2,
  HeartHandshake,
  History,
  LockKeyhole,
  PawPrint,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import type { PetGender } from '../../domain/types';
import { getImage } from '../../store/storage';
import { useDemoStore } from '../../store/DemoProvider';
import {
  Button,
  CopyBox,
  Drawer,
  EmptyState,
  InputField,
  Modal,
  PetAvatar,
  SelectField,
  StatusTag,
  useToast,
} from '../../shared/ui';
import { resolveAvatarAssetPath } from '../../app/assets';
import './overview.css';

/** 总览只接收宠物 ID，由上层路由或工作台壳负责解析 Hash。 */
export interface OverviewPageProps {
  petId: string;
}

interface EditFormState {
  name: string;
  gender: PetGender;
  birthDate: string;
  introduction: string;
}

/** 从 IndexedDB 读取本地照片，读不到时让总览安全降级到预置形象。 */
function useStoredPhoto(photoKey: string | null): string | undefined {
  const [photoUrl, setPhotoUrl] = useState<string>();

  useEffect(() => {
    let disposed = false;
    let nextUrl: string | undefined;
    setPhotoUrl(undefined);
    if (!photoKey) return undefined;

    void getImage(photoKey).then((blob) => {
      if (disposed || !blob) return;
      nextUrl = URL.createObjectURL(blob);
      setPhotoUrl(nextUrl);
    }).catch(() => {
      // 图片不存在时不打断总览，使用数字形象作为演示降级。
    });

    return () => {
      disposed = true;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [photoKey]);

  return photoUrl;
}

/** 格式化日期，同时保持未知日期明确可读。 */
function formatDate(value: string | null): string {
  if (!value) return '生日未知';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '生日未知';
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

/** 由生日派生年龄，不在 Pet 中保存容易过期的年龄字段。 */
function formatAge(birthDate: string | null): string {
  if (!birthDate) return '生日未知';
  const birth = new Date(`${birthDate}T00:00:00`);
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  const birthdayPassed = today.getMonth() > birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!birthdayPassed) years -= 1;
  return years < 1 ? '未满 1 岁' : `${years} 岁`;
}

/** 将 ISO 日期转换为时间线可读的短日期。 */
function formatShortDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(date);
}

/** 性别字段转中文，未知值不伪造推断结果。 */
function formatGender(gender: PetGender): string {
  if (gender === 'female') return '女生';
  if (gender === 'male') return '男生';
  return '未知';
}

/** 从当前状态派生安全状态和陪伴天数，避免把展示值写回 Store。 */
function getOverviewStatus(lostCase: ReturnType<ReturnType<typeof useDemoStore>['selectors']['getActiveLostCase']>): { label: string; tone: 'success' | 'pending' | 'danger' } {
  if (!lostCase) return { label: '安全在家', tone: 'success' };
  if (lostCase.status === 'reported') return { label: '收到线索', tone: 'pending' };
  return { label: '寻找中', tone: 'danger' };
}

/** 总览页的资料、统计、动态、模拟身份凭证和编辑资料交互。 */
export default function OverviewPage({ petId }: OverviewPageProps): JSX.Element {
  const { state, actions, selectors } = useDemoStore();
  const { showSuccess, showError } = useToast();
  const pet = selectors.getPetById(state, petId);
  const displayPet = pet ? { ...pet, avatarAssetPath: resolveAvatarAssetPath(pet.avatarAssetPath, pet.species) } : null;
  const photoUrl = useStoredPhoto(pet?.photoKey ?? null);
  const [credentialOpen, setCredentialOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<EditFormState>({ name: '', gender: 'unknown', birthDate: '', introduction: '' });

  const overviewData = useMemo(() => {
    if (!pet) return null;
    const stats = selectors.getPetStats(state, pet.id);
    const owner = selectors.getOwner(state, pet.id);
    const lostCase = selectors.getActiveLostCase(state, pet.id);
    const events = selectors.getPetEvents(state, pet.id).slice(0, 3);
    const equipped = selectors.getEquippedItem(state, pet.id);
    const status = getOverviewStatus(lostCase);
    const companionDays = Math.max(0, Math.floor((Date.now() - new Date(pet.createdAt).getTime()) / 86400000));
    return { stats, owner, lostCase, events, equipped, status, companionDays };
  }, [pet, selectors, state]);

  /** 打开编辑弹窗时从当前宠物资料建立局部草稿，失败不会污染 Store。 */
  const openEditor = (): void => {
    if (!pet) return;
    setForm({ name: pet.name, gender: pet.gender, birthDate: pet.birthDate ?? '', introduction: pet.introduction });
    setFormError('');
    setEditorOpen(true);
  };

  /** 校验并保存可编辑资料，更新失败时保留原表单以便修正或重试。 */
  const handleSave = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!pet) return;
    const name = form.name.trim();
    const today = new Date().toISOString().slice(0, 10);
    if (name.length < 1 || name.length > 20) {
      setFormError('姓名需要填写 1–20 个字符。');
      return;
    }
    if (form.birthDate && form.birthDate > today) {
      setFormError('生日不能晚于今天。');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      await actions.updatePet(pet.id, {
        name,
        gender: form.gender,
        birthDate: form.birthDate || null,
        introduction: form.introduction,
      });
      setEditorOpen(false);
      showSuccess('资料已保存，PawID 编号保持不变。');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '保存失败，请稍后重试。');
      showError('资料保存失败，表单内容已保留。');
    } finally {
      setSaving(false);
    }
  };

  if (!pet || !overviewData) {
    return <section className="overview-page"><EmptyState title="这只宠物还不存在" description={`没有找到 PawID「${petId}」对应的演示宠物，请检查链接或从宠物选择器重新进入。`} /></section>;
  }

  const canManage = selectors.canManagePet(state, pet.id);
  const speciesLabel = pet.species === 'cat' ? '猫咪' : '狗狗';
  const pawId = `PawID-${pet.id}`;
  const identity = pet.identityAccount;
  const recentPhotoLabel = photoUrl ? '本地照片' : '本地照片缩略图（待上传）';

  return <section className="overview-page" aria-labelledby="overview-title">
    <header className="overview-heading">
      <div>
        <span className="overview-eyebrow">数字生命护照 · 总览</span>
        <h1 id="overview-title">你好，{pet.name}</h1>
        <p>把它的身份、家庭、成长和安全，都放在同一个温暖的地方。</p>
      </div>
      <div className="overview-heading-actions">
        <StatusTag tone="neutral"><Sparkles size={14} aria-hidden="true" />数字形象：预置形象演示</StatusTag>
        <Button variant="secondary" onClick={() => setCredentialOpen(true)}><FileBadge2 size={16} aria-hidden="true" />身份凭证（模拟）</Button>
        {canManage && <Button onClick={openEditor}><Edit3 size={16} aria-hidden="true" />编辑资料</Button>}
      </div>
    </header>

    {!canManage && <div className="overview-readonly" role="status"><LockKeyhole size={17} aria-hidden="true" /><span>当前为只读预览：你没有这只宠物的监护权限，资料与身份凭证仅供查看。</span></div>}

    <div className="overview-hero-grid">
      <article className="overview-portrait-card">
        <div className="overview-card-kicker"><span>数字形象</span><span className="overview-demo-label">预置形象演示</span></div>
        <PetAvatar pet={displayPet ?? pet} photoUrl={photoUrl} equippedAssetPath={overviewData.equipped?.assetPath} size="large" />
        <div className="overview-portrait-name"><strong>{pet.name}</strong><span>{pet.avatarPresetLabel}</span></div>
        {overviewData.equipped && <div className="overview-equipped"><Sparkles size={14} aria-hidden="true" />当前穿戴：{overviewData.equipped.name}</div>}
      </article>

      <article className="overview-identity-card">
        <div className="overview-section-title"><div><span className="overview-card-kicker">身份资料</span><h2>{pet.name} 的 PawID 卡</h2></div><StatusTag tone={overviewData.status.tone}><CheckCircle2 size={14} aria-hidden="true" />{overviewData.status.label}</StatusTag></div>
        <div className="overview-photo-strip" aria-label="本地照片缩略图区">
          <div className={`overview-photo-thumb${photoUrl ? ' has-photo' : ''}`}>
            {photoUrl ? <img src={photoUrl} alt={`${pet.name} 的本地照片`} /> : <><Camera size={20} aria-hidden="true" /><span>暂无本地照片</span></>}
          </div>
          <div className="overview-photo-copy"><span>{recentPhotoLabel}</span><strong>{pet.publicProfile.appearance}</strong><small>仅存储在当前演示浏览器</small></div>
        </div>
        <dl className="overview-facts">
          <div><dt>物种 / 品种</dt><dd>{speciesLabel} · {pet.breed || '品种未知'}</dd></div>
          <div><dt>性别</dt><dd>{formatGender(pet.gender)}</dd></div>
          <div><dt>年龄 / 生日</dt><dd>{formatAge(pet.birthDate)} · {formatDate(pet.birthDate)}</dd></div>
          <div><dt>PawID</dt><dd className="overview-mono">{pawId}</dd></div>
          <div><dt>主监护人</dt><dd>{overviewData.owner?.user?.nickname ?? '尚未设置'}</dd></div>
          <div><dt>陪伴天数</dt><dd>{overviewData.companionDays} 天</dd></div>
        </dl>
        <div className="overview-safety-note"><ShieldCheck size={18} aria-hidden="true" /><span><strong>安全状态</strong>{overviewData.lostCase ? `${overviewData.status.label} · ${overviewData.lostCase.lastLocation}` : '安全在家，PawTag 可持续守护。'}</span><a href={`#/pets/${pet.id}?tab=safety`}>查看守护</a></div>
      </article>
    </div>

    <div className="overview-stat-grid" aria-label="宠物统计">
      <a className="overview-stat-card" href={`#/pets/${pet.id}?tab=family`}><span className="overview-stat-icon stat-family"><HeartHandshake size={19} aria-hidden="true" /></span><span><strong>{overviewData.stats.memberCount}</strong><small>家庭成员</small></span><span className="overview-stat-arrow">→</span></a>
      <a className="overview-stat-card" href={`#/pets/${pet.id}?tab=life`}><span className="overview-stat-icon stat-life"><History size={19} aria-hidden="true" /></span><span><strong>{overviewData.stats.eventCount}</strong><small>成长记录</small></span><span className="overview-stat-arrow">→</span></a>
      <a className="overview-stat-card" href={`#/pets/${pet.id}?tab=assets`}><span className="overview-stat-icon stat-badge"><Award size={19} aria-hidden="true" /></span><span><strong>{overviewData.stats.badgeCount}</strong><small>徽章</small></span><span className="overview-stat-arrow">→</span></a>
      <a className="overview-stat-card" href={`#/pets/${pet.id}?tab=assets`}><span className="overview-stat-icon stat-points"><WalletCards size={19} aria-hidden="true" /></span><span><strong>{overviewData.stats.balance}</strong><small>PAWS 余额</small></span><span className="overview-stat-arrow">→</span></a>
    </div>

    <div className="overview-lower-grid">
      <article className="overview-panel overview-shortcuts-panel">
        <div className="overview-panel-heading"><div><span className="overview-card-kicker">现在就去</span><h2>快捷操作</h2></div><PawPrint size={20} aria-hidden="true" /></div>
        <div className="overview-shortcuts">
          <a href={`#/pets/${pet.id}?tab=family`}><span className="shortcut-icon shortcut-family"><HeartHandshake size={18} aria-hidden="true" /></span><span><strong>邀请家人</strong><small>一起守护 {pet.name}</small></span><span>→</span></a>
          <a href={`#/pets/${pet.id}?tab=life`}><span className="shortcut-icon shortcut-life"><CalendarDays size={18} aria-hidden="true" /></span><span><strong>记录成长</strong><small>留下今天的故事</small></span><span>→</span></a>
          <a href={`#/pets/${pet.id}?tab=assets`}><span className="shortcut-icon shortcut-assets"><Sparkles size={18} aria-hidden="true" /></span><span><strong>兑换装扮</strong><small>用 PAWS 点亮形象</small></span><span>→</span></a>
          <a href={`#/pets/${pet.id}?tab=safety`}><span className="shortcut-icon shortcut-safety"><ShieldCheck size={18} aria-hidden="true" /></span><span><strong>防丢设置</strong><small>让它更安全地回家</small></span><span>→</span></a>
        </div>
      </article>

      <article className="overview-panel overview-events-panel">
        <div className="overview-panel-heading"><div><span className="overview-card-kicker">时间线</span><h2>最近动态</h2></div><a href={`#/pets/${pet.id}?tab=life`}>查看全部</a></div>
        {overviewData.events.length > 0 ? <ol className="overview-events">{overviewData.events.map((event) => <li key={event.id}><span className="overview-event-dot" aria-hidden="true" /><div><div className="overview-event-meta"><time dateTime={event.date}>{formatShortDate(event.date)}</time><span>{event.type === 'health' ? '健康' : event.type === 'birthday' ? '生日' : event.type === 'travel' ? '旅行' : event.type === 'daily' ? '日常' : '家庭'}</span></div><strong>{event.title}</strong><p>{event.description || '一条新的成长记录。'}</p></div></li>)}</ol> : <EmptyState title="还没有成长动态" description="去生命档案记录一个值得纪念的瞬间吧。" action={<a className="button button-primary" href={`#/pets/${pet.id}?tab=life`}>去记录</a>} />}
      </article>
    </div>

    <Drawer open={credentialOpen} onClose={() => setCredentialOpen(false)} title="身份凭证（模拟）" className="overview-credential-drawer">
      <div className="overview-simulation-note"><Sparkles size={17} aria-hidden="true" /><span>以下身份、账户与交易均为前端演示数据，不连接真实钱包或区块链。</span></div>
      <div className="overview-credential-intro"><span className="overview-credential-avatar"><PawPrint size={20} aria-hidden="true" /></span><div><strong>{pet.name} · PawID 身份</strong><p>数字身份创建于 {formatDate(identity.createdAt.slice(0, 10))}</p></div></div>
      <div className="overview-credential-list">
        <div><span>身份编号</span><CopyBox value={pawId} label="身份编号" /></div>
        <div><span>创建时间</span><strong>{formatDate(identity.createdAt.slice(0, 10))}</strong></div>
        <div><span>网络</span><strong>Monad 测试演示网络 <em>模拟</em></strong></div>
        <div><span>模拟账户</span><CopyBox value={identity.address} label="模拟账户地址" /></div>
        <div><span>模拟交易 ID</span><CopyBox value={identity.transactionId} label="模拟交易 ID" /></div>
      </div>
      <p className="overview-no-explorer"><LockKeyhole size={15} aria-hidden="true" />为了避免误解，这里不会跳转区块浏览器。</p>
    </Drawer>

    <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={`编辑 ${pet.name} 的资料`} className="overview-editor-modal">
      <form onSubmit={(event) => void handleSave(event)} noValidate>
        <div className="overview-form-note"><Edit3 size={16} aria-hidden="true" />仅修改公开资料，PawID 编号不会变化。</div>
        <InputField label="姓名" value={form.name} maxLength={20} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} error={formError && (form.name.trim().length < 1 || form.name.trim().length > 20) ? formError : undefined} />
        <SelectField label="性别" value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value as PetGender }))}>
          <option value="unknown">未知</option><option value="female">女生</option><option value="male">男生</option>
        </SelectField>
        <InputField label="生日（可留空）" type="date" max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))} error={formError && form.birthDate > new Date().toISOString().slice(0, 10) ? formError : undefined} />
        <label className="overview-textarea-field"><span>介绍</span><textarea value={form.introduction} rows={4} onChange={(event) => setForm((current) => ({ ...current, introduction: event.target.value }))} placeholder="写下它最独特的一面" /></label>
        {formError && <p className="overview-form-error" role="alert">{formError}</p>}
        <div className="button-row overview-editor-actions"><Button variant="secondary" type="button" onClick={() => setEditorOpen(false)}>取消</Button><Button type="submit" disabled={saving}>{saving ? '保存中…' : '保存资料'}</Button></div>
      </form>
    </Modal>
  </section>;
}
