import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DemoControl, DemoBadge, FeatureSlot, NotFoundPage, ToastProvider, TopBar } from '../shared/ui';
import { DemoProvider, useDemoStore } from '../store/DemoProvider';

/** 工作台导航占位布局，业务 Agent 接入页面时保留统一外壳。 */
function WorkspaceShell(): JSX.Element {
  const location = useLocation();
  const { selectors, state } = useDemoStore();
  const petId = location.pathname.startsWith('/pets/') ? location.pathname.split('/')[2] ?? 'mochi' : 'mochi';
  const pet = selectors.getPetById(state, petId);
  const tabs = [
    { key: 'overview', label: '总览' },
    { key: 'family', label: '家庭族谱' },
    { key: 'life', label: '生命档案' },
    { key: 'assets', label: '成长资产' },
    { key: 'safety', label: '防丢守护' },
  ];
  if (!pet) return <NotFoundPage reason={`找不到宠物 ID「${petId}」，请确认链接是否来自本演示浏览器。`} />;
  const currentTab = new URLSearchParams(location.search).get('tab') ?? 'overview';
  return <div className="app-shell"><TopBar messageSlot={<span className="message-count" aria-label={`未读消息 ${selectors.getUnreadMessages(state)} 条`}>消息 {selectors.getUnreadMessages(state)}</span>}><span className="workspace-pet">当前宠物：{pet.name}</span></TopBar><div className="workspace-layout"><nav className="workspace-nav" aria-label="宠物工作台导航">{tabs.map((tab) => <a className={currentTab === tab.key ? 'active' : ''} key={tab.key} href={`#/pets/${pet.id}?tab=${tab.key}`}>{tab.label}</a>)}<a href="#/ecosystem">服务生态</a><div className="workspace-nav-control"><DemoControl /></div></nav><main className="workspace-content"><FeatureSlot title={`${pet.name} · ${tabs.find((tab) => tab.key === currentTab)?.label ?? '工作台'}`} description="工作台页面由业务功能 Agent 接入，状态内核和统一组件已就绪。" /></main></div></div>;
}

/** 公开路由的最小占位页面，保留路由参数以便业务 Agent 直接接入。 */
function PublicSlot({ title }: { title: string }): JSX.Element {
  return <div className="app-shell"><TopBar><span>{title}</span></TopBar><main className="page-container"><FeatureSlot title={title} /></main></div>;
}

/** 应用路由表，HashRouter 确保静态部署刷新可用。 */
function AppRoutes(): JSX.Element {
  return <Routes><Route path="/" element={<PublicSlot title="PawID · 宠物数字生命护照" />} /><Route path="/create" element={<PublicSlot title="创建身份" />} /><Route path="/pets/:id" element={<WorkspaceShell />} /><Route path="/invite/:inviteId" element={<PublicSlot title="邀请确认" />} /><Route path="/tag/:id" element={<PublicSlot title="PawTag 访客页" />} /><Route path="/ecosystem" element={<PublicSlot title="服务生态" />} /><Route path="*" element={<NotFoundPage />} /></Routes>;
}

/** 应用根组件：Context、Toast 和 HashRouter 的唯一组合入口。 */
export default function App(): JSX.Element {
  return <DemoProvider><ToastProvider><HashRouter><AppRoutes /></HashRouter></ToastProvider></DemoProvider>;
}

/** 为未来页面提供回首页的无业务跳转组件，保持导出稳定。 */
export function HomeRedirect(): JSX.Element {
  return <Navigate to="/" replace />;
}

/** 保留应用壳使用的演示标识导出，便于业务页面复用。 */
export { DemoBadge };
