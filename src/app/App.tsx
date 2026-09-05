import { useState } from 'react';
import type { ReactNode } from 'react';
import { Bell } from 'lucide-react';
import { HashRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import HomePage from '../features/home/HomePage';
import EcosystemPage from '../features/ecosystem/EcosystemPage';
import CreateWizard from '../features/create/CreateWizard';
import WorkbenchLayout, { type WorkbenchTab } from '../features/workbench/WorkbenchLayout';
import OverviewPage from '../features/overview/OverviewPage';
import FamilyPage from '../features/family/FamilyPage';
import LifePage from '../features/life/LifePage';
import AssetsPage from '../features/assets/AssetsPage';
import SafetyPage from '../features/safety/SafetyPage';
import InviteConfirmPage from '../features/invite/InviteConfirmPage';
import TagVisitorPage from '../features/tag/TagVisitorPage';
import { MessageDrawer } from '../features/messages/MessageDrawer';
import { DemoBadge, DemoControl, NotFoundPage, ToastProvider } from '../shared/ui';
import { DemoProvider, useDemoStore } from '../store/DemoProvider';

/** 工作台标签集合，路由之外的查询参数一律回落到总览。 */
const WORKBENCH_TABS: readonly WorkbenchTab[] = ['overview', 'family', 'life', 'assets', 'safety'];

/** 判断查询参数是否是受支持的工作台标签。 */
function isWorkbenchTab(value: string | null): value is WorkbenchTab {
  return value !== null && WORKBENCH_TABS.includes(value as WorkbenchTab);
}

/** 公开页演示工具：提供角色切换、重置和消息抽屉，不重复页面内部顶栏。 */
function PublicDemoTools({ showMessages, showBadge }: { showMessages: boolean; showBadge: boolean }): JSX.Element {
  const { state, selectors } = useDemoStore();
  const [messageOpen, setMessageOpen] = useState(false);
  const unreadCount = selectors.getUnreadMessages(state);

  return <>
    <aside className="public-demo-tools" aria-label="公开页演示工具">
      {showBadge && <DemoBadge />}
      <DemoControl />
      {showMessages && <button
        type="button"
        className="public-message-trigger"
        onClick={() => setMessageOpen(true)}
        aria-label={`打开消息抽屉，${unreadCount} 条未读消息`}
      >
        <Bell size={16} aria-hidden="true" />
        <span>消息</span>
        {unreadCount > 0 && <span className="public-message-count" aria-hidden="true">{unreadCount}</span>}
      </button>}
    </aside>
    {showMessages && <MessageDrawer open={messageOpen} onClose={() => setMessageOpen(false)} />}
  </>;
}

/** 轻量公开页外壳，避免给邀请页和 PawTag 访客页嵌入工作台导航。 */
function PublicShell({ children, showMessages = false, showBadge = true }: { children: ReactNode; showMessages?: boolean; showBadge?: boolean }): JSX.Element {
  return <div className="public-shell">{children}<PublicDemoTools showMessages={showMessages} showBadge={showBadge} /></div>;
}

/** 宠物工作台路由：解析 ID 与 tab，并把具体页面交给统一工作台布局。 */
function PetRoute(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const { state, selectors } = useDemoStore();
  const pet = selectors.getPetById(state, id);
  if (!pet) return <NotFoundPage reason={`找不到宠物 ID「${id}」，请确认链接是否来自本演示浏览器。`} />;

  const queryTab = new URLSearchParams(location.search).get('tab');
  const activeTab: WorkbenchTab = isWorkbenchTab(queryTab) ? queryTab : 'overview';
  const page = activeTab === 'overview'
    ? <OverviewPage petId={id} />
    : activeTab === 'family'
      ? <FamilyPage petId={id} />
      : activeTab === 'life'
        ? <LifePage petId={id} />
        : activeTab === 'assets'
          ? <AssetsPage petId={id} />
          : <SafetyPage petId={id} />;

  return <WorkbenchLayout petId={id} activeTab={activeTab}>{page}</WorkbenchLayout>;
}

/** 应用路由表，HashRouter 确保静态部署和刷新场景仍可用。 */
function AppRoutes(): JSX.Element {
  return <Routes>
    <Route path="/" element={<PublicShell showMessages showBadge={false}><HomePage /></PublicShell>} />
    <Route path="/create" element={<PublicShell showMessages showBadge={false}><CreateWizard /></PublicShell>} />
    <Route path="/pets/:id" element={<PetRoute />} />
    <Route path="/invite/:inviteId" element={<PublicShell><InviteRoute /></PublicShell>} />
    <Route path="/tag/:id" element={<PublicShell><TagRoute /></PublicShell>} />
    <Route path="/ecosystem" element={<PublicShell showMessages showBadge={false}><EcosystemPage /></PublicShell>} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>;
}

/** 邀请公开路由只传递路径参数，页面内部负责状态和受邀者权限判断。 */
function InviteRoute(): JSX.Element {
  const { inviteId = '' } = useParams<{ inviteId: string }>();
  return <InviteConfirmPage inviteId={inviteId} />;
}

/** PawTag 公开路由只传递宠物 ID，页面内部严格筛选公开资料。 */
function TagRoute(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  return <TagVisitorPage petId={id} />;
}

/** 应用根组件：Context、Toast 和 HashRouter 的唯一组合入口。 */
export default function App(): JSX.Element {
  return <DemoProvider><ToastProvider><HashRouter><AppRoutes /></HashRouter></ToastProvider></DemoProvider>;
}

/** 为业务页面提供回首页的无业务跳转组件，保持导出稳定。 */
export function HomeRedirect(): JSX.Element {
  return <Navigate to="/" replace />;
}

/** 保留应用壳使用的演示标识导出，便于业务页面复用。 */
export { DemoBadge };
