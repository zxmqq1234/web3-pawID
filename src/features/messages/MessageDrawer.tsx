import { Bell, ChevronRight, CircleDollarSign, HeartHandshake, Search, Sparkles } from 'lucide-react';
import { Drawer, EmptyState, StatusTag } from '../../shared/ui';
import { useDemoStore } from '../../store/DemoProvider';
import './messages.css';

/** 消息抽屉由未来 TopBar 插槽控制开关，不依赖路由组件。 */
export interface MessageDrawerProps {
  open: boolean;
  onClose: () => void;
}

/** 消息状态只用于给邀请结果提供文字与颜色，不改变业务数据。 */
function inviteStatusLabel(status: 'pending' | 'accepted' | 'rejected'): { label: string; tone: 'pending' | 'success' | 'danger' } {
  if (status === 'accepted') return { label: '已接受', tone: 'success' };
  if (status === 'rejected') return { label: '已拒绝', tone: 'danger' };
  return { label: '待处理', tone: 'pending' };
}

/** 相对轻量的日期文案，异常日期仍保留原始字符串以便排查演示数据。 */
function messageDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(date);
}

/**
 * 顶栏消息抽屉：集中展示邀请、积分奖励和寻宠线索，并把每条内容连接到真实宠物标签。
 */
export function MessageDrawer({ open, onClose }: MessageDrawerProps): JSX.Element {
  const { state, selectors } = useDemoStore();
  const unreadCount = selectors.getUnreadMessages(state);

  /** 消息来自现有数组派生，最近内容优先；无操作型消息不会伪装成未读。 */
  const invites = [...state.invites].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 4);
  const rewards = [...state.pointEntries]
    .filter((entry) => entry.kind === 'reward')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 4);
  const clues = [...state.foundReports]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 4);
  const hasMessages = invites.length > 0 || rewards.length > 0 || clues.length > 0;

  return <Drawer open={open} onClose={onClose} title="消息" className="message-drawer">
    <div className="message-drawer-summary">
      <div className="message-drawer-summary-icon"><Bell size={19} aria-hidden="true" /></div>
      <div><strong>{unreadCount > 0 ? `${unreadCount} 条待处理消息` : '消息都处理好了'}</strong><p>{unreadCount > 0 ? '邀请和寻宠线索需要你的关注。' : '这里会保留最近的邀请、奖励和寻宠线索。'}</p></div>
    </div>

    {!hasMessages ? <EmptyState title="暂时没有消息" description="完成一次邀请、获得成长奖励或收到寻宠线索后，相关提醒会出现在这里。" /> : <div className="message-sections">
      {invites.length > 0 && <section className="message-section" aria-labelledby="message-invites-title">
        <div className="message-section-heading"><span className="message-section-icon message-icon-invite"><HeartHandshake size={15} aria-hidden="true" /></span><h3 id="message-invites-title">邀请结果</h3><span>{invites.length}</span></div>
        <div className="message-list">{invites.map((invite) => {
          const status = inviteStatusLabel(invite.status);
          return <a className="message-item" href={`#/pets/${encodeURIComponent(invite.petId)}?tab=family`} onClick={onClose} key={invite.id}>
            <span className="message-item-icon"><HeartHandshake size={16} aria-hidden="true" /></span>
            <span className="message-item-body"><strong>{invite.inviteeNickname} 的共同监护邀请</strong><small>{messageDate(invite.createdAt)} · {invite.status === 'pending' ? '等待处理' : '邀请状态已更新'}</small></span>
            <StatusTag tone={status.tone}>{status.label}</StatusTag><ChevronRight size={16} aria-hidden="true" />
          </a>;
        })}</div>
      </section>}

      {rewards.length > 0 && <section className="message-section" aria-labelledby="message-rewards-title">
        <div className="message-section-heading"><span className="message-section-icon message-icon-reward"><CircleDollarSign size={15} aria-hidden="true" /></span><h3 id="message-rewards-title">积分奖励</h3><span>{rewards.length}</span></div>
        <div className="message-list">{rewards.map((entry) => <a className="message-item" href={`#/pets/${encodeURIComponent(entry.petId)}?tab=assets`} onClick={onClose} key={entry.id}>
          <span className="message-item-icon"><Sparkles size={16} aria-hidden="true" /></span>
          <span className="message-item-body"><strong>{entry.title}</strong><small>{messageDate(entry.createdAt)} · 成长资产已更新</small></span>
          <span className="message-points">+{entry.amount} <small>PAWS</small></span><ChevronRight size={16} aria-hidden="true" />
        </a>)}</div>
      </section>}

      {clues.length > 0 && <section className="message-section" aria-labelledby="message-clues-title">
        <div className="message-section-heading"><span className="message-section-icon message-icon-clue"><Search size={15} aria-hidden="true" /></span><h3 id="message-clues-title">寻宠线索</h3><span>{clues.length}</span></div>
        <div className="message-list">{clues.map((report) => <a className="message-item" href={`#/pets/${encodeURIComponent(report.petId)}?tab=safety`} onClick={onClose} key={report.id}>
          <span className="message-item-icon"><Search size={16} aria-hidden="true" /></span>
          <span className="message-item-body"><strong>有人在「{report.location}」发现线索</strong><small>{messageDate(report.createdAt)} · 点击查看守护状态</small></span>
          <StatusTag tone="pending">收到线索</StatusTag><ChevronRight size={16} aria-hidden="true" />
        </a>)}</div>
      </section>}
    </div>}
  </Drawer>;
}
