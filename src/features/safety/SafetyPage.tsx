import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Copy, ExternalLink, MapPin, ShieldCheck, Siren, Sparkles } from 'lucide-react';
import type { FormEvent } from 'react';
import type { LostCaseStatus } from '../../domain/types';
import { useDemoStore } from '../../store/DemoProvider';
import { Button, ConfirmDialog, CopyBox, EmptyState, InputField, Modal, QrCode, StatusTag, useToast } from '../../shared/ui';
import './safety.css';

interface SafetyPageProps {
  petId: string;
}

interface LostForm {
  lastLocation: string;
  lostAt: string;
  description: string;
}

interface FormErrors {
  lastLocation?: string;
  lostAt?: string;
}

/** 生成当前浏览器可打开的 PawTag 地址，不依赖路由组件。 */
function makeTagUrl(petId: string): string {
  if (typeof window === 'undefined') return `#/tag/${encodeURIComponent(petId)}`;
  return `${window.location.origin}${window.location.pathname}#/tag/${encodeURIComponent(petId)}`;
}

/** 把状态映射成同时包含文字和颜色的安全标签。 */
function getStatusMeta(status: LostCaseStatus | 'safe'): { label: string; tone: 'success' | 'pending' | 'danger' | 'neutral'; icon: JSX.Element } {
  switch (status) {
    case 'searching':
      return { label: '寻找中', tone: 'danger', icon: <Siren size={18} aria-hidden="true" /> };
    case 'reported':
      return { label: '收到线索', tone: 'pending', icon: <MapPin size={18} aria-hidden="true" /> };
    default:
      return { label: '安全在家', tone: 'success', icon: <ShieldCheck size={18} aria-hidden="true" /> };
  }
}

/** 统一展示本地日期时间，输入异常时退回原始值。 */
function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** 获得 datetime-local 的当前时间上限，避免用户选择未来时间。 */
function getDateTimeMax(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

/** 防丢守护工作台：提供 PawTag 分享、走失处置和线索历史。 */
export function SafetyPage({ petId }: SafetyPageProps): JSX.Element {
  const { state, selectors, actions } = useDemoStore();
  const { showError, showSuccess } = useToast();
  const pet = selectors.getPetById(state, petId);
  const activeCase = selectors.getActiveLostCase(state, petId);
  const reports = selectors.getFoundReports(state, petId);
  const historicalCases = useMemo(
    () => state.lostCases.filter((item) => item.petId === petId).slice().reverse(),
    [petId, state.lostCases],
  );
  const tagUrl = useMemo(() => makeTagUrl(petId), [petId]);
  const isOwner = state.currentRole === 'owner' && selectors.canManagePet(state, petId);
  const statusMeta = getStatusMeta(activeCase?.status ?? 'safe');

  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'reunited' | 'closed' | null>(null);
  const [lostForm, setLostForm] = useState<LostForm>({ lastLocation: '', lostAt: '', description: '' });
  const [lostErrors, setLostErrors] = useState<FormErrors>({});
  const [submittingLost, setSubmittingLost] = useState(false);
  const [closingCase, setClosingCase] = useState(false);
  const [pendingCaseNotice, setPendingCaseNotice] = useState(false);
  const [caseEventId, setCaseEventId] = useState<string | null>(null);
  const [reunitedNotice, setReunitedNotice] = useState(false);

  /** 提交后等待 Store 状态刷新，再显示真实生成的寻宠事件 ID。 */
  useEffect(() => {
    if (!pendingCaseNotice || !activeCase) return;
    setCaseEventId(activeCase.id);
    setPendingCaseNotice(false);
    showSuccess(`已标记走失，事件 ID：${activeCase.id}`);
  }, [activeCase, pendingCaseNotice, showSuccess]);

  /** 走失表单只在本地校验必填项与时间，失败时不清除用户输入。 */
  const submitLostCase = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const errors: FormErrors = {};
    const location = lostForm.lastLocation.trim();
    if (!location) errors.lastLocation = '请填写最后出现地点';
    if (!lostForm.lostAt) {
      errors.lostAt = '请选择最后出现时间';
    } else {
      const lostAtTime = new Date(lostForm.lostAt).getTime();
      if (Number.isNaN(lostAtTime)) errors.lostAt = '请输入有效时间';
      else if (lostAtTime > Date.now()) errors.lostAt = '时间不能晚于当前时间';
    }
    setLostErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmittingLost(true);
    try {
      await actions.openLostCase({
        petId,
        lastLocation: location,
        lostAt: new Date(lostForm.lostAt).toISOString(),
        description: lostForm.description.trim(),
      });
      setPendingCaseNotice(true);
      setLostModalOpen(false);
      setLostForm({ lastLocation: '', lostAt: '', description: '' });
      setLostErrors({});
    } catch (error) {
      showError(error instanceof Error ? error.message : '标记走失失败，请稍后重试');
    } finally {
      setSubmittingLost(false);
    }
  };

  /** 二次确认后关闭当前寻宠事件；奖励和徽章由 Store 统一派生。 */
  const finishLostCase = async (reunited: boolean): Promise<void> => {
    if (closingCase || !activeCase) return;
    setClosingCase(true);
    try {
      await actions.closeLostCase(petId, reunited);
      if (reunited) setReunitedNotice(true);
      showSuccess(reunited ? '已记录平安接回，Home Again 已获得' : '本次寻宠已结束');
    } catch (error) {
      showError(error instanceof Error ? error.message : '结束寻宠失败，请稍后重试');
    } finally {
      setClosingCase(false);
    }
  };

  if (!pet) {
    return <main className="safety-page safety-page-empty"><EmptyState title="找不到这只宠物" description={`没有找到宠物 ID「${petId}」。这条 PawID 记录仅保存在创建它的浏览器中。`} action={<a className="safety-inline-link" href="#/tag/mochi">打开体验档案</a>} /></main>;
  }

  return <main className="safety-page">
    <header className="safety-header">
      <div>
        <span className="safety-eyebrow">SAFETY / PAWTAG</span>
        <h1>{pet.name} 的防丢守护</h1>
        <p>把 PawTag 二维码留在项圈上，发现它的人可以快速留下线索。</p>
      </div>
      <StatusTag tone={statusMeta.tone}>{statusMeta.label}</StatusTag>
    </header>

    <section className="safety-top-grid" aria-label="PawTag 与安全状态">
      <article className="safety-card tag-card">
        <div className="card-heading">
          <div><span className="card-kicker">PAWTAG</span><h2>公开访客入口</h2></div>
          <span className="tag-chip">#{pet.id}</span>
        </div>
        <div className="tag-card-content">
          <QrCode value={tagUrl} label="扫描查看 PawTag（本机记录）" />
          <div className="tag-share-copy">
            <p className="tag-share-title">让捡到它的人快速联系</p>
            <p className="muted-text">二维码只打开公开访客页，不会暴露主人的联系方式、住址或家庭资料。</p>
            <p className="muted-text">PawTag 页面和线索仅保存在本机浏览器：暂不支持跨设备实时同步、短信推送、实时定位或机构联动。</p>
            <CopyBox value={tagUrl} label="PawTag 访客链接" />
            <a className="safety-preview-link" href={tagUrl}><ExternalLink size={15} aria-hidden="true" />预览访客页</a>
          </div>
        </div>
      </article>

      <article className={`safety-card safety-status-card status-card-${statusMeta.tone}`}>
        <div className="status-orb" aria-hidden="true">{statusMeta.icon}</div>
        <div className="status-card-copy">
          <span className="card-kicker">CURRENT SAFETY</span>
          <h2>{statusMeta.label}</h2>
          <p>{activeCase ? (activeCase.status === 'reported' ? '访客已经留下新线索，请尽快查看线索列表。' : '这只宠物正在寻找中，请通过 PawTag 收集线索。') : '当前没有进行中的寻宠事件，状态会同步到本机 PawTag 页面。'}</p>
        </div>
        {isOwner && !activeCase && <Button className="lost-button" variant="danger" onClick={() => setLostModalOpen(true)}><Siren size={16} aria-hidden="true" />标记走失</Button>}
        {!isOwner && <p className="read-only-note">共同监护人和访客可查看，只有主监护人能操作寻宠状态。</p>}
        {activeCase && isOwner && <div className="case-actions">
          <Button variant="primary" disabled={closingCase} onClick={() => setConfirmAction('reunited')}><CheckCircle2 size={16} aria-hidden="true" />确认已接回</Button>
          <Button variant="secondary" disabled={closingCase} onClick={() => setConfirmAction('closed')}>结束本次寻宠</Button>
        </div>}
        {caseEventId && <p className="event-notice" role="status"><CheckCircle2 size={15} aria-hidden="true" />寻宠事件已创建：<code>{caseEventId}</code></p>}
        {reunitedNotice && <p className="reward-notice" role="status"><Sparkles size={15} aria-hidden="true" />Home Again 已获得，徽章由本机记录统一保存。</p>}
      </article>
    </section>

    <section className="safety-detail-grid" aria-label="寻宠信息与线索">
      <article className="safety-card case-card">
        <div className="card-heading"><div><span className="card-kicker">LOST CASE</span><h2>寻宠信息</h2></div>{activeCase && <StatusTag tone={activeCase.status === 'reported' ? 'pending' : 'danger'}>{activeCase.status === 'reported' ? '收到线索' : '寻找中'}</StatusTag>}</div>
        {activeCase ? <div className="case-detail-list">
          <div><MapPin size={17} aria-hidden="true" /><span><b>最后出现地点</b>{activeCase.lastLocation}</span></div>
          <div><Clock3 size={17} aria-hidden="true" /><span><b>最后出现时间</b>{formatDateTime(activeCase.lostAt)}</span></div>
          <div className="case-description"><span><b>补充说明</b>{activeCase.description || '暂无补充说明'}</span></div>
          <p className="helper-callout">线索不等于寻回。请核对线索内容后，再由主监护人确认接回或结束本次寻宠。</p>
        </div> : <div className="case-safe-placeholder"><ShieldCheck size={23} aria-hidden="true" /><p>目前没有进行中的寻宠事件。</p><span>下一次走失会创建新的事件 ID，历史事件不会被覆盖。</span></div>}
      </article>

      <article className="safety-card reports-card">
        <div className="card-heading"><div><span className="card-kicker">FOUND REPORTS</span><h2>访客线索</h2></div><span className="report-count">{reports.length} 条</span></div>
        <p className="muted-text">访客在本机 PawTag 页面手动填写的线索会记录在这里；线索不等于寻回。</p>
        {reports.length > 0 ? <ul className="report-list">{reports.map((report) => <li key={report.id}>
          <div className="report-meta"><span><MapPin size={14} aria-hidden="true" />{report.location}</span><time dateTime={report.createdAt}>{formatDateTime(report.createdAt)}</time></div>
          {report.message && <p>{report.message}</p>}
          {report.contact && <div className="report-contact"><Copy size={13} aria-hidden="true" />回访方式：{report.contact}</div>}
        </li>)}</ul> : <div className="report-empty"><MapPin size={21} aria-hidden="true" /><p>暂无线索</p><span>访客可从 PawTag 提交发现地点和留言。</span></div>}
      </article>
    </section>

    <section className="safety-card history-card">
      <div className="card-heading"><div><span className="card-kicker">HISTORY</span><h2>历史事件</h2></div><span className="report-count">保留全部记录</span></div>
      {historicalCases.length > 0 ? <ul className="history-list">{historicalCases.map((item) => <li key={item.id}><div><StatusTag tone={item.status === 'reunited' ? 'success' : 'neutral'}>{item.status === 'reunited' ? '已接回' : item.status === 'closed' ? '已结束' : item.status === 'reported' ? '收到线索' : '寻找中'}</StatusTag><code>{item.id}</code></div><span>{item.lastLocation} · {formatDateTime(item.lostAt)}</span></li>)}</ul> : <p className="muted-text history-empty">还没有历史寻宠事件。</p>}
    </section>

    <Modal open={lostModalOpen} onClose={() => { if (!submittingLost) setLostModalOpen(false); }} title="标记走失">
      <form className="lost-form" onSubmit={(event) => void submitLostCase(event)}>
        <p className="modal-intro">请填写最后确认的位置和时间。位置会用于帮助访客判断线索，不会请求定位权限。</p>
        <InputField label="最后出现地点" placeholder="例如：小区东门旁的咖啡店" value={lostForm.lastLocation} error={lostErrors.lastLocation} disabled={submittingLost} onChange={(event) => setLostForm((current) => ({ ...current, lastLocation: event.target.value }))} required />
        <InputField label="最后出现时间" type="datetime-local" max={getDateTimeMax()} value={lostForm.lostAt} error={lostErrors.lostAt} disabled={submittingLost} onChange={(event) => setLostForm((current) => ({ ...current, lostAt: event.target.value }))} required />
        <label className="local-textarea-field"><span>补充说明（选填）</span><textarea rows={4} placeholder="外观、佩戴物或需要注意的细节" value={lostForm.description} disabled={submittingLost} onChange={(event) => setLostForm((current) => ({ ...current, description: event.target.value }))} /></label>
        <div className="button-row"><Button type="button" variant="secondary" disabled={submittingLost} onClick={() => setLostModalOpen(false)}>取消</Button><Button type="submit" variant="danger" disabled={submittingLost}>{submittingLost ? '提交中…' : '确认标记走失'}</Button></div>
      </form>
    </Modal>

    <ConfirmDialog open={confirmAction !== null} onClose={() => { if (!closingCase) setConfirmAction(null); }} onConfirm={() => { const action = confirmAction; setConfirmAction(null); if (action) void finishLostCase(action === 'reunited'); }} title={confirmAction === 'reunited' ? '确认已接回？' : '结束本次寻宠？'}>
      {confirmAction === 'reunited' ? '确认宠物已经平安回到家中？确认后会记录 Home Again 获得，并结束当前寻宠事件。' : '确认结束本次寻宠？结束后不会发放接回奖励，但历史事件和访客线索仍会保留。'}
    </ConfirmDialog>
  </main>;
}

export default SafetyPage;
