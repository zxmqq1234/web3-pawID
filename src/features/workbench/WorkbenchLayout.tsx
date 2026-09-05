import { useState } from 'react';
import type { ReactNode } from 'react';
import { Bell, BookOpen, CircleDollarSign, HeartHandshake, Home, ShieldCheck } from 'lucide-react';
import { DemoControl, EmptyState, TopBar } from '../../shared/ui';
import { useDemoStore } from '../../store/DemoProvider';
import { MessageDrawer } from '../messages/MessageDrawer';
import './workbench.css';

/** 工作台支持的五个宠物业务标签。 */
export type WorkbenchTab = 'overview' | 'family' | 'life' | 'assets' | 'safety';

/** 工作台壳通过 props 接收路由解析结果，避免与具体路由实现耦合。 */
export interface WorkbenchLayoutProps {
  petId: string;
  activeTab: WorkbenchTab;
  children: ReactNode;
}

/** 导航项只保存展示信息，链接统一由当前宠物 ID 和标签生成。 */
const WORKBENCH_TABS: ReadonlyArray<{ key: WorkbenchTab; label: string; icon: typeof Home }> = [
  { key: 'overview', label: '总览', icon: Home },
  { key: 'family', label: '家庭族谱', icon: HeartHandshake },
  { key: 'life', label: '生命档案', icon: BookOpen },
  { key: 'assets', label: '成长资产', icon: CircleDollarSign },
  { key: 'safety', label: '防丢守护', icon: ShieldCheck },
];

/** 生成保留当前 tab 的 Hash 链接，切换宠物时不丢失工作上下文。 */
function petTabHref(petId: string, tab: WorkbenchTab): string {
  return `#/pets/${encodeURIComponent(petId)}?tab=${tab}`;
}

/**
 * PawID 宠物工作台统一外壳：桌面侧栏、移动底栏、宠物选择器和消息入口均在此集中呈现。
 */
export default function WorkbenchLayout({ petId, activeTab, children }: WorkbenchLayoutProps): JSX.Element {
  const { state, selectors } = useDemoStore();
  const [messageOpen, setMessageOpen] = useState(false);
  const pet = selectors.getPetById(state, petId);
  const unreadCount = selectors.getUnreadMessages(state);

  /** 宠物选择器通过真实 Hash 链接切换对象，当前 tab 始终保持不变。 */
  const handlePetChange = (nextPetId: string): void => {
    window.location.hash = petTabHref(nextPetId, activeTab);
  };

  if (!pet) {
    return <main className="workbench-missing"><EmptyState title="找不到这只宠物" description={`没有找到 PawID「${petId}」对应的演示宠物，请从选择器重新选择。`} /></main>;
  }

  return <div className="workbench-shell">
    <TopBar messageSlot={<button
      type="button"
      className="workbench-message-trigger"
      aria-label={`打开消息抽屉，${unreadCount} 条未读消息`}
      onClick={() => setMessageOpen(true)}
    >
      <Bell size={17} aria-hidden="true" />
      <span>消息</span>
      {unreadCount > 0 && <span className="workbench-message-count" aria-hidden="true">{unreadCount}</span>}
    </button>}>
      <div className="workbench-topbar-context">
        <span className="workbench-topbar-label">当前宠物</span>
        <label className="workbench-pet-picker">
          <span className="sr-only">选择当前宠物</span>
          <select value={pet.id} onChange={(event) => handlePetChange(event.target.value)} aria-label="选择当前宠物">
            {state.pets.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.species === 'cat' ? '猫咪' : '狗狗'}</option>)}
          </select>
        </label>
      </div>
    </TopBar>

    <div className="workbench-layout">
      <aside className="workbench-sidebar">
        <div className="workbench-sidebar-heading">
          <span className="workbench-sidebar-eyebrow">Pet workspace</span>
          <strong>{pet.name}</strong>
        </div>
        <nav className="workbench-nav" aria-label="宠物工作台导航">
          {WORKBENCH_TABS.map(({ key, label, icon: Icon }) => <a
            className={`workbench-nav-link${activeTab === key ? ' is-active' : ''}`}
            href={petTabHref(pet.id, key)}
            aria-current={activeTab === key ? 'page' : undefined}
            key={key}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </a>)}
        </nav>
        <a className="workbench-ecosystem-link" href="#/ecosystem">
          <span className="workbench-ecosystem-mark" aria-hidden="true">+</span>
          <span>服务生态</span>
        </a>
        <div className="workbench-sidebar-control"><DemoControl /></div>
      </aside>

      <main className="workbench-content">{children}</main>
    </div>

    <MessageDrawer open={messageOpen} onClose={() => setMessageOpen(false)} />
  </div>;
}
