import { useState } from 'react';
import { ArrowLeft, Check, Home, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { Invite } from '../../domain/types';
import { useDemoStore } from '../../store/DemoProvider';
import { Button, EmptyState, PetAvatar, StatusTag, useToast } from '../../shared/ui';
import { resolveAvatarAssetPath } from '../../app/assets';
import './invite.css';

interface InviteConfirmPageProps {
  inviteId: string;
}

/** 将邀请状态映射为公开页可读的颜色和文案。 */
function getInviteStatus(status: Invite['status']): { label: string; tone: 'success' | 'pending' | 'danger' } {
  if (status === 'accepted') return { label: '已接受', tone: 'success' };
  if (status === 'rejected') return { label: '已拒绝', tone: 'danger' };
  return { label: '待你确认', tone: 'pending' };
}

/** 公开邀请页的兜底入口，不依赖当前浏览器是否保存了邀请状态。 */
function InviteUnavailable(): JSX.Element {
  return <main className="invite-public-page"><EmptyState title="这份邀请暂时无法打开" description="邀请 ID 无效，或这份邀请是在其他浏览器生成的。演示数据仅保存在当前浏览器中，请让主监护人重新生成邀请。" action={<div className="button-row"><Button onClick={() => { window.location.hash = '#/'; }}><Home size={16} aria-hidden="true" />回到首页</Button><Button variant="secondary" onClick={() => { window.location.hash = '#/pets/mochi?tab=overview'; }}>体验 Mochi</Button></div>} /></main>;
}

/** 公开邀请确认页：只允许模拟受邀者处理待确认邀请。 */
export default function InviteConfirmPage({ inviteId }: InviteConfirmPageProps): JSX.Element {
  const { state, actions } = useDemoStore();
  const { showError, showSuccess } = useToast();
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const invite = state.invites.find((item) => item.id === inviteId);
  const pet = invite ? state.pets.find((item) => item.id === invite.petId) ?? null : null;
  const inviter = invite ? state.users.find((user) => user.id === invite.inviterId) ?? null : null;
  const displayPet = pet ? { ...pet, avatarAssetPath: resolveAvatarAssetPath(pet.avatarAssetPath, pet.species) } : null;
  const status = invite ? getInviteStatus(invite.status) : null;
  const isInvitee = state.currentRole === 'invitee';
  const canDecide = Boolean(invite && pet && invite.status === 'pending' && isInvitee);

  /** 处理接受或拒绝，避免双击造成重复请求并保留 Store 的状态幂等保护。 */
  async function decide(statusToSet: 'accepted' | 'rejected'): Promise<void> {
    if (!invite || busy || !canDecide) return;
    setBusy(true);
    try {
      await actions.decideInvite(invite.id, statusToSet);
      if (statusToSet === 'accepted') {
        setCelebrate(true);
        showSuccess('共同守护者已解锁，一起陪伴它成长');
      } else {
        showSuccess('已拒绝这份共同监护邀请');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '处理邀请失败，请稍后重试';
      showError(message);
    } finally {
      setBusy(false);
    }
  }

  if (!invite || !pet) return <InviteUnavailable />;

  const statusAfterAction = state.invites.find((item) => item.id === invite.id)?.status ?? invite.status;
  const isAccepted = statusAfterAction === 'accepted';
  const isRejected = statusAfterAction === 'rejected';

  return <main className="invite-public-page">
    <div className="invite-public-brand"><a href="#/" className="invite-back-link"><ArrowLeft size={16} aria-hidden="true" />PawID</a><span className="invite-demo-label">邀请确认 · 演示</span></div>
    <section className="invite-confirm-card" aria-labelledby="invite-confirm-title">
      {celebrate && isAccepted && <div className="invite-celebration" role="status" aria-live="polite"><Sparkles size={24} aria-hidden="true" /><div><strong>共同守护者解锁</strong><span>一起陪伴它成长</span></div><span className="invite-confetti confetti-a">+50</span><span className="invite-confetti confetti-b">PAWS</span></div>}
      <div className="invite-card-icon"><ShieldCheck size={30} aria-hidden="true" /></div>
      <p className="eyebrow">共同监护邀请</p>
      <h1 id="invite-confirm-title">{inviter?.nickname ?? '一位家人'} 邀请你守护 {pet.name}</h1>
      <p className="invite-intro">受邀者：<strong>{invite.inviteeNickname}</strong> · 关系：共同监护人</p>
      <div className="invite-pet-summary"><PetAvatar pet={displayPet ?? pet} size="medium" /><div><h2>{pet.name}</h2><p>{pet.species === 'cat' ? '猫咪' : '狗狗'} · {pet.breed || '品种待补充'} · {pet.gender === 'female' ? '母' : pet.gender === 'male' ? '公' : '性别未知'}</p><p className="muted-text">{pet.introduction || '这是一份等待家人共同确认的陪伴记录。'}</p></div></div>
      <div className="invite-relation-summary"><div><span>邀请人</span><strong>{inviter?.nickname ?? '已隐藏'}</strong></div><div><span>守护对象</span><strong>{pet.name}</strong></div><div><span>邀请关系</span><strong>共同监护人</strong></div></div>
      <div className="invite-status-block"><StatusTag tone={status?.tone ?? 'neutral'}>{isAccepted ? '已接受' : isRejected ? '已拒绝' : status?.label ?? '待确认'}</StatusTag>{isAccepted && <p>你已经成为 {pet.name} 的共同守护者，可以和家人一起陪伴它成长。</p>}{isRejected && <p>这份邀请已拒绝，不能再次接收。若要加入家庭，请让主监护人重新发起邀请。</p>}{!isAccepted && !isRejected && <p>{isInvitee ? '确认后，你会成为这只宠物的共同守护者。' : '当前模拟身份不是受邀者，无法处理这份邀请。'}</p>}</div>
      {canDecide && <div className="invite-action-row"><Button onClick={() => void decide('accepted')} disabled={busy}><Check size={17} aria-hidden="true" />接受邀请</Button><Button variant="secondary" onClick={() => void decide('rejected')} disabled={busy}><X size={17} aria-hidden="true" />拒绝</Button></div>}
      {!canDecide && !isAccepted && !isRejected && <div className="invite-readonly-note"><ShieldCheck size={17} aria-hidden="true" /><span>{state.currentRole === 'owner' ? '主监护人不能接受自己发出的邀请，请切换为模拟受邀者。' : '访客身份只读，只有受邀者可以接受或拒绝邀请。'}</span></div>}
      {(isAccepted || isRejected) && <div className="invite-readonly-note"><Check size={17} aria-hidden="true" /><span>邀请状态已经确定，不可重复操作。</span></div>}
      {isAccepted && <section className="invite-twin-card" aria-label="共同守护双宠物卡"><div className="invite-twin-member"><PetAvatar pet={displayPet ?? pet} size="small" showPresetLabel={false} /><strong>{inviter?.nickname ?? '主监护人'}</strong><span>主监护人</span></div><div className="invite-twin-plus" aria-hidden="true">＋</div><div className="invite-twin-member"><PetAvatar pet={displayPet ?? pet} size="small" showPresetLabel={false} /><strong>{invite.inviteeNickname}</strong><span>共同监护人</span></div></section>}
      {isAccepted && <a className="invite-family-link" href={`#/pets/${pet.id}?tab=family`}>进入 {pet.name} 的监护家庭 <ArrowLeft size={16} aria-hidden="true" className="invite-link-arrow" /></a>}
    </section>
    <nav className="invite-footer-links" aria-label="邀请页辅助导航"><a href="#/"><Home size={15} aria-hidden="true" />回到首页</a><a href="#/pets/mochi?tab=overview">体验 Mochi</a></nav>
  </main>;
}
