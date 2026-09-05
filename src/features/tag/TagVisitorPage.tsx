import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, Info, MapPin, MessageCircle, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import type { PublicPetProfile } from '../../store/selectors';
import { useDemoStore } from '../../store/DemoProvider';
import { getImage } from '../../store/storage';
import { Button, EmptyState, InputField, StatusTag, useToast } from '../../shared/ui';
import './tag.css';

interface TagVisitorPageProps {
  petId: string;
}

interface ReportForm {
  location: string;
  message: string;
  contact: string;
}

/** 将公开状态映射为清晰的文字、颜色和图标，避免只依赖颜色传达风险。 */
function getPublicStatusMeta(status: PublicPetProfile['safetyStatus']): { label: string; tone: 'success' | 'pending' | 'danger' | 'neutral'; icon: JSX.Element; title: string; description: string } {
  switch (status) {
    case 'searching':
      return { label: '寻找中', tone: 'danger', icon: <ShieldAlert size={22} aria-hidden="true" />, title: '这只宠物正在寻找中', description: '如果你见过它，请留下地点和线索，帮助家人核实。' };
    case 'reported':
      return { label: '收到线索', tone: 'pending', icon: <MessageCircle size={22} aria-hidden="true" />, title: '已经收到新的发现线索', description: '请继续提交你掌握的地点或留言，线索会交给监护人核对。' };
    default:
      return { label: '安全在家', tone: 'success', icon: <ShieldCheck size={22} aria-hidden="true" />, title: '目前显示安全在家', description: '如果你刚刚发现了它，仍然可以留下线索，让监护人确认信息。' };
  }
}

/** 将物种代码转成访客易懂的公开文案。 */
function speciesLabel(species: PublicPetProfile['species']): string {
  return species === 'dog' ? '狗狗' : '猫咪';
}

/** 将 ISO 时间转为访客可读的中文时间。 */
function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** 公开 PawTag 访客页：只展示公开资料，并提供不请求定位权限的线索表单。 */
export function TagVisitorPage({ petId }: TagVisitorPageProps): JSX.Element {
  const { state, selectors, actions } = useDemoStore();
  const { showError } = useToast();
  const profile = selectors.getPublicPetProfile(state, petId);
  const statusMeta = getPublicStatusMeta(profile?.safetyStatus ?? 'safe');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState<ReportForm>({ location: '', message: '', contact: '' });
  const [locationError, setLocationError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  /** 本地照片只从用户已保存的公开 photoKey 读取，失败时不降级到数字形象。 */
  useEffect(() => {
    let mounted = true;
    let nextObjectUrl: string | null = null;
    setPhotoUrl(null);
    if (!profile?.photoKey) {
      setPhotoLoading(false);
      return () => { mounted = false; };
    }
    setPhotoLoading(true);
    void getImage(profile.photoKey)
      .then((blob) => {
        if (!mounted) return;
        if (blob) {
          nextObjectUrl = URL.createObjectURL(blob);
          setPhotoUrl(nextObjectUrl);
        }
        setPhotoLoading(false);
      })
      .catch(() => {
        if (mounted) setPhotoLoading(false);
      });
    return () => {
      mounted = false;
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
    };
  }, [profile?.photoKey]);

  /** 手动提交线索，位置必填但不触发浏览器定位权限。 */
  const submitReport = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const location = reportForm.location.trim();
    if (!location) {
      setLocationError('请填写发现地点');
      return;
    }
    setLocationError(undefined);
    setSubmitting(true);
    try {
      await actions.addFoundReport({
        petId,
        location,
        message: reportForm.message.trim(),
        contact: reportForm.contact.trim(),
      });
      setSubmitted(true);
      setReportOpen(false);
      setReportForm({ location: '', message: '', contact: '' });
    } catch (error) {
      showError(error instanceof Error ? error.message : '线索提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (!profile) {
    return <main className="tag-visitor-page tag-missing-page"><div className="tag-missing-shell"><EmptyState title="这个 PawTag 暂时无法打开" description="此内容仅在创建它的演示浏览器可用。请回到体验示例，或让创建者在同源同浏览器中打开这张 PawTag。" action={<a className="tag-example-link" href="#/tag/mochi"><Sparkles size={15} aria-hidden="true" />体验示例</a>} /><p className="tag-sync-note">同源同浏览器演示可同步，不同设备不会实时共享。</p></div></main>;
  }

  return <main className="tag-visitor-page">
    <div className="tag-visitor-shell">
      <header className="tag-visitor-header">
        <div className="tag-brand-mark" aria-hidden="true">P</div>
        <div><span className="tag-brand-name">PawTag</span><span className="tag-demo-label">演示访客页</span></div>
      </header>

      <section className="tag-profile-card" aria-label={`${profile.name} 的公开资料`}>
        <div className="tag-photo-frame">
          {photoUrl ? <img src={photoUrl} alt={`${profile.name} 的公开照片`} /> : <div className="tag-photo-placeholder" aria-label={photoLoading ? '公开照片加载中' : '暂无公开照片'}>{photoLoading ? '照片加载中…' : '暂无公开照片'}</div>}
        </div>
        <div className="tag-profile-copy">
          <span className="tag-card-kicker">PUBLIC PET PROFILE</span>
          <h1>{profile.name}</h1>
          <p className="tag-species">{speciesLabel(profile.species)}</p>
          <div className="tag-appearance"><span>外观特征</span><p>{profile.appearance || '暂无公开外观特征'}</p></div>
        </div>
      </section>

      <section className={`tag-status-card tag-status-${statusMeta.tone}`} aria-label="当前安全状态">
        <div className="tag-status-icon" aria-hidden="true">{statusMeta.icon}</div>
        <div><StatusTag tone={statusMeta.tone}>{statusMeta.label}</StatusTag><h2>{statusMeta.title}</h2><p>{statusMeta.description}</p></div>
      </section>

      {profile.lostCase && <section className="tag-lost-card" aria-label="走失说明">
        <div className="tag-section-heading"><ShieldAlert size={19} aria-hidden="true" /><h2>走失说明</h2></div>
        <dl className="tag-lost-details"><div><dt>最后出现地点</dt><dd>{profile.lostCase.lastLocation}</dd></div><div><dt>最后出现时间</dt><dd>{formatDateTime(profile.lostCase.lostAt)}</dd></div></dl>
        {profile.lostCase.description && <p className="tag-lost-description">{profile.lostCase.description}</p>}
      </section>}

      <section className="tag-found-section" aria-label="提交发现线索">
        {!reportOpen && <Button className="tag-found-button" onClick={() => { setReportOpen(true); setSubmitted(false); }}><MapPin size={18} aria-hidden="true" />我发现了它</Button>}
        {submitted && <p className="tag-submitted-message" role="status"><CheckCircle2 size={17} aria-hidden="true" />线索已记录（演示）</p>}
        {reportOpen && <form className="tag-report-form" onSubmit={(event) => void submitReport(event)}>
          <div className="tag-section-heading"><MapPin size={19} aria-hidden="true" /><div><h2>告诉监护人你发现了它</h2><p>请手动填写，不会请求定位权限。</p></div></div>
          <InputField label="发现地点" placeholder="例如：人民公园北门" value={reportForm.location} error={locationError} disabled={submitting} onChange={(event) => setReportForm((current) => ({ ...current, location: event.target.value }))} required />
          <label className="tag-textarea-field"><span>留言（选填）</span><textarea rows={4} placeholder="外观、时间或你观察到的情况" value={reportForm.message} disabled={submitting} onChange={(event) => setReportForm((current) => ({ ...current, message: event.target.value }))} /></label>
          <label className="tag-textarea-field"><span>回访联系方式（选填）</span><input type="text" placeholder="例如：微信昵称或邮箱" value={reportForm.contact} disabled={submitting} onChange={(event) => setReportForm((current) => ({ ...current, contact: event.target.value }))} /></label>
          <div className="tag-report-actions"><Button type="button" variant="secondary" disabled={submitting} onClick={() => setReportOpen(false)}>取消</Button><Button type="submit" disabled={submitting}>{submitting ? '记录中…' : '提交线索'}</Button></div>
        </form>}
      </section>

      <footer className="tag-visitor-footer"><Info size={15} aria-hidden="true" /><span>同源同浏览器演示可同步，不同设备不会实时共享。PawID 演示不会发送真实通知。<br /><a href="#/">回到首页</a> · <a href="#/tag/mochi">体验示例</a></span></footer>
    </div>
  </main>;
}

export default TagVisitorPage;
