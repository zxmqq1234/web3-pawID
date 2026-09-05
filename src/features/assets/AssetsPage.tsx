import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleHelp,
  Coins,
  Crown,
  Gift,
  LockKeyhole,
  Shirt,
  Sparkles,
  WalletCards,
  X,
} from 'lucide-react';
import type {
  Badge,
  InventoryItem,
  InventoryItemCode,
  GuardianLink,
  LifeEvent,
  Pet,
  PointEntry,
  Relation,
} from '../../domain/types';
import { fixedItemCatalog } from '../../store/actions';
import { useDemoStore } from '../../store/DemoProvider';
import { Button, DemoBadge, EmptyState, Modal, PetAvatar, StatusTag, useToast } from '../../shared/ui';
import './assets.css';

/** 成长资产页接收路由层提供的宠物 ID，不直接依赖路由。 */
export interface AssetsPageProps {
  petId: string;
}

type AssetTab = 'badges' | 'wardrobe' | 'points';
type TaskKey = 'identity' | 'guardians' | 'parents' | 'record' | 'home-again';

interface GrowthTask {
  key: TaskKey;
  title: string;
  description: string;
  reward: number;
  done: boolean;
  date: string | null;
  href: string;
}

interface RedeemTarget {
  code: InventoryItemCode;
  name: string;
  price: number;
  assetPath: string;
}

const TAB_ITEMS: Array<{ key: AssetTab; label: string; icon: typeof BadgeCheck }> = [
  { key: 'badges', label: '徽章', icon: BadgeCheck },
  { key: 'wardrobe', label: '衣橱', icon: Shirt },
  { key: 'points', label: '积分明细', icon: Coins },
];

/** 通过 Vite URL 处理目录内图片，确保开发与生产构建都能加载本地资源。 */
const LOCAL_ITEM_PATHS: Record<InventoryItemCode, string> = {
  bow: new URL('./items/bow.svg', import.meta.url).href,
  birthday_hat: new URL('./items/birthday-hat.svg', import.meta.url).href,
  starry_cape: new URL('./items/starry-cape.svg', import.meta.url).href,
};
const LOCAL_AVATAR_PATHS: Record<Pet['species'], string> = {
  cat: new URL('./avatars/cat.svg', import.meta.url).href,
  dog: new URL('./avatars/dog.svg', import.meta.url).href,
};

/** 统一格式化演示时间，保留中文阅读语境并避免 UTC 日期错位。 */
function formatDate(value: string | null): string {
  if (!value) return '待完成';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

/** 归一化任务链接，定位到当前宠物的可操作页面；没有交易或外部跳转。 */
function taskHref(taskKey: TaskKey, petId: string): string {
  if (taskKey === 'identity') return '#/create';
  if (taskKey === 'guardians') return `#/pets/${petId}?tab=family`;
  if (taskKey === 'parents') return `#/pets/${petId}?tab=family`;
  if (taskKey === 'record') return `#/pets/${petId}?tab=life`;
  return `#/pets/${petId}?tab=safety`;
}

/** 使用资产功能目录内的本地装扮图，避免依赖基线中的占位路径。 */
function localItemPath(code: InventoryItemCode): string {
  return LOCAL_ITEM_PATHS[code];
}

/** 使用资产功能目录内的本地数字形象图，避免外链和失效资源。 */
function localAvatarPath(species: Pet['species']): string {
  return LOCAL_AVATAR_PATHS[species];
}

/** 用状态事实派生成长任务，任务完成情况不保存额外副本。 */
function deriveGrowthTasks(
  pet: Pet,
  badges: Badge[],
  pointEntries: PointEntry[],
  guardianLinks: GuardianLink[],
  relations: Relation[],
  lifeEvents: LifeEvent[],
): GrowthTask[] {
  const identityReward = pointEntries.find((entry) => entry.petId === pet.id && entry.taskKey === `create:${pet.id}`);
  const identityBadge = badges.find((badge) => badge.petId === pet.id && badge.code === 'identity_passport');
  const identityEntry = identityReward?.createdAt ?? identityBadge?.earnedAt ?? null;
  const hasIdentity = Boolean(identityReward || identityBadge);
  const coGuardianReward = pointEntries.find((entry) => entry.petId === pet.id && entry.taskKey === `co-guardian:${pet.id}`);
  const parentReward = pointEntries.find((entry) => entry.petId === pet.id && entry.taskKey === `parent:${pet.id}`);
  const manualReward = pointEntries.find((entry) => entry.petId === pet.id && entry.taskKey === `manual-event:${pet.id}`);
  const coGuardian = guardianLinks
    .filter((link) => link.petId === pet.id && link.role === 'co_guardian' && link.status === 'accepted')
    .sort((left, right) => (left.joinedAt ?? '').localeCompare(right.joinedAt ?? ''))[0];
  const parentRelation = relations
    .filter((relation) => relation.childPetId === pet.id && relation.status === 'accepted')
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
  const manualEvent = lifeEvents
    .filter((event) => event.petId === pet.id && event.source === 'manual')
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
  const homeAgain = badges.find((badge) => badge.petId === pet.id && badge.code === 'home_again');

  return [
    { key: 'identity', title: '创建 PawID 身份', description: '为宠物建立一份可持续成长的数字身份。', reward: 100, done: hasIdentity, date: identityReward?.createdAt ?? identityEntry, href: taskHref('identity', pet.id) },
    { key: 'guardians', title: '首次共同监护', description: '邀请一位重要家人，一起照顾这份成长记录。', reward: 50, done: Boolean(coGuardianReward), date: coGuardianReward?.createdAt ?? coGuardian?.joinedAt ?? null, href: taskHref('guardians', pet.id) },
    { key: 'parents', title: '首次确认父母关系', description: '让家族关系更完整，留下亲缘的来处。', reward: 50, done: Boolean(parentReward), date: parentReward?.createdAt ?? parentRelation?.decidedAt ?? parentRelation?.createdAt ?? null, href: taskHref('parents', pet.id) },
    { key: 'record', title: '首次手动记录', description: '写下一个今天值得记住的生命片段。', reward: 20, done: Boolean(manualReward), date: manualReward?.createdAt ?? manualEvent?.createdAt ?? null, href: taskHref('record', pet.id) },
    { key: 'home-again', title: '确认接回 · Home Again', description: '平安回家，是最值得收藏的一枚徽章。', reward: 0, done: Boolean(homeAgain), date: homeAgain?.earnedAt ?? null, href: taskHref('home-again', pet.id) },
  ];
}

/** 将流水按发生时间倒序排列，余额仍由 selector 实时求和。 */
function sortPointEntries(entries: PointEntry[]): PointEntry[] {
  return [...entries].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

/** 资产页主视图：只读资产摘要，操作通过 Store actions 提交。 */
export function AssetsPage({ petId }: AssetsPageProps): JSX.Element {
  const { state, actions, selectors } = useDemoStore();
  const { showError, showSuccess } = useToast();
  const [tab, setTab] = useState<AssetTab>('badges');
  const [redeemTarget, setRedeemTarget] = useState<RedeemTarget | null>(null);
  const [busyCode, setBusyCode] = useState<InventoryItemCode | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  const pet = selectors.getPetById(state, petId);
  const balance = selectors.getPetBalance(state, petId);
  const badges = selectors.getPetBadges(state, petId);
  const inventory = selectors.getPetInventory(state, petId);
  const equippedItem = selectors.getEquippedItem(state, petId);
  const pointEntries = sortPointEntries(state.pointEntries.filter((entry) => entry.petId === petId));
  const tasks = useMemo(() => pet ? deriveGrowthTasks(pet, badges, pointEntries, state.guardianLinks, state.relations, state.lifeEvents) : [], [badges, pet, pointEntries, state.guardianLinks, state.lifeEvents, state.relations]);
  const catalog = fixedItemCatalog().map((item) => ({ ...item, assetPath: localItemPath(item.code) }));
  const ownedCodes = new Set(inventory.map((item) => item.code));
  const remainingTasks = tasks.filter((task) => !task.done);
  const petAddress = pet?.identityAccount.address ?? '';
  const modalBalanceAfter = redeemTarget ? balance - redeemTarget.price : balance;
  const modalShortfall = redeemTarget ? Math.max(0, redeemTarget.price - balance) : 0;
  const canManage = selectors.canManagePet(state, petId);

  /** 让键盘左右方向切换 tab，Tab 键本身仍可正常移动焦点。 */
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const currentIndex = TAB_ITEMS.findIndex((item) => item.key === tab);
    const nextIndex = event.key === 'ArrowRight'
      ? (currentIndex + 1) % TAB_ITEMS.length
      : (currentIndex - 1 + TAB_ITEMS.length) % TAB_ITEMS.length;
    setTab(TAB_ITEMS[nextIndex].key);
    document.getElementById(`assets-tab-${TAB_ITEMS[nextIndex].key}`)?.focus();
  };

  /** 预览阶段只打开 Modal，确认按钮才会触发真实的兑换 action。 */
  const openRedeemModal = (item: RedeemTarget): void => {
    setOperationError(null);
    setRedeemTarget(item);
  };

  /** 兑换失败时保留 Modal 和用户当前上下文，方便修正后重试。 */
  const confirmRedeem = async (): Promise<void> => {
    if (!redeemTarget || !canManage || busyCode) return;
    setBusyCode(redeemTarget.code);
    setOperationError(null);
    try {
      await actions.redeemItem(petId, redeemTarget.code);
      setRedeemTarget(null);
      showSuccess(`已兑换${redeemTarget.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '兑换失败，请稍后重试';
      setOperationError(message);
      showError(message);
    } finally {
      setBusyCode(null);
    }
  };

  /** 装扮穿戴与卸下都由 Store 保证一次仅一件，不在页面复制状态。 */
  const toggleEquip = async (item: InventoryItem): Promise<void> => {
    if (!canManage || busyItemId) return;
    setBusyItemId(item.id);
    setOperationError(null);
    try {
      await actions.equipItem(petId, item.id, !item.equipped);
      showSuccess(item.equipped ? `已卸下${item.name}` : `已穿戴${item.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新穿戴失败，请重试';
      setOperationError(message);
      showError(message);
    } finally {
      setBusyItemId(null);
    }
  };

  if (!pet) {
    return <div className="assets-page assets-page-empty"><EmptyState title="还没有这位宠物" description="请从有效的 PawID 宠物链接进入成长资产。" /></div>;
  }

  const assetPet = { ...pet, avatarAssetPath: localAvatarPath(pet.species) };

  return <div className="assets-page">
    <header className="assets-hero">
      <div className="assets-hero-copy">
        <DemoBadge />
        <p className="assets-kicker"><Sparkles size={15} aria-hidden="true" />成长资产 · 只读档案</p>
        <h1>属于 <span>{pet.name}</span> 的成长资产</h1>
        <p className="assets-lead">每一次被认真记录，都会成为 {pet.name} 生命里可收藏的光。</p>
        <div className="assets-hero-meta"><StatusTag tone={canManage ? 'success' : 'neutral'}>{canManage ? '可管理资产' : '访客只读'}</StatusTag><span>所有积分与账户均为演示，不充值、不提现、不发生真实交易。</span></div>
      </div>
      <div className="assets-hero-subject" aria-label={`${pet.name} 的成长资产主体`}>
        <div className="assets-orbit assets-orbit-one" />
        <div className="assets-orbit assets-orbit-two" />
        <PetAvatar pet={assetPet} equippedAssetPath={equippedItem ? localItemPath(equippedItem.code) : undefined} size="large" />
        <span className="assets-subject-caption"><Crown size={14} aria-hidden="true" />{equippedItem ? `穿戴中 · ${equippedItem.name}` : '等待一件专属装扮'}</span>
      </div>
    </header>

    <section className="assets-summary-grid" aria-label="资产摘要">
      <article className="assets-summary-card assets-summary-paws">
        <div className="assets-summary-icon"><Coins size={20} aria-hidden="true" /></div>
        <div><p>PAWS 余额</p><strong>{balance}</strong><span>可用于兑换演示装扮</span></div>
        <span className="summary-spark">实时派生</span>
      </article>
      <article className="assets-summary-card">
        <div className="assets-summary-icon assets-summary-icon-lilac"><BadgeCheck size={20} aria-hidden="true" /></div>
        <div><p>徽章收藏</p><strong>{badges.length}</strong><span>枚成长纪念</span></div>
      </article>
      <article className="assets-summary-card">
        <div className="assets-summary-icon assets-summary-icon-peach"><Shirt size={20} aria-hidden="true" /></div>
        <div><p>已拥有装扮</p><strong>{inventory.length}</strong><span>{equippedItem ? `正在穿戴 ${equippedItem.name}` : '还没有穿戴装扮'}</span></div>
      </article>
      <article className="assets-summary-card assets-account-card">
        <div className="assets-summary-icon assets-summary-icon-blue"><WalletCards size={20} aria-hidden="true" /></div>
        <div><p>模拟账户</p><strong>{pet.identityAccount.network}</strong><span title={petAddress}>{petAddress}</span></div>
      </article>
    </section>

    <section className="assets-tasks-panel" aria-labelledby="growth-tasks-title">
      <div className="assets-section-heading"><div><p className="assets-kicker">COLLECT THE LITTLE MOMENTS</p><h2 id="growth-tasks-title">成长任务</h2></div><span className="task-progress">{tasks.filter((task) => task.done).length}/{tasks.length} 已完成</span></div>
      <div className="task-list">{tasks.map((task) => <article className={`task-row ${task.done ? 'task-row-done' : ''}`} key={task.key}>
        <div className="task-status" aria-label={task.done ? '已完成' : '待完成'}>{task.done ? <Check size={17} aria-hidden="true" /> : <span>{task.reward || '·'}</span>}</div>
        <div className="task-copy"><div className="task-title-row"><h3>{task.title}</h3>{task.done ? <StatusTag tone="success">已获得</StatusTag> : task.reward > 0 ? <span className="task-reward">+{task.reward} PAWS</span> : null}</div><p>{task.description}</p></div>
        <div className="task-action">{task.done ? <span className="task-date">{formatDate(task.date)}</span> : <a href={task.href}>去完成 <ChevronRight size={15} aria-hidden="true" /></a>}</div>
      </article>)}</div>
    </section>

    <section className="assets-detail-panel" aria-label="成长资产详情">
      <div className="assets-tabs" role="tablist" aria-label="成长资产详情分类">
        {TAB_ITEMS.map(({ key, label, icon: Icon }) => <button type="button" role="tab" key={key} id={`assets-tab-${key}`} aria-selected={tab === key} aria-controls={`assets-panel-${key}`} tabIndex={tab === key ? 0 : -1} className={tab === key ? 'assets-tab assets-tab-active' : 'assets-tab'} onClick={() => setTab(key)} onKeyDown={onTabKeyDown}><Icon size={17} aria-hidden="true" />{label}{key === 'badges' && <span>{badges.length}</span>}{key === 'wardrobe' && <span>{inventory.length}</span>}</button>)}
      </div>
      {tab === 'badges' && <div className="assets-tab-panel" role="tabpanel" id="assets-panel-badges" aria-labelledby="assets-tab-badges">
        <div className="panel-intro"><div><p className="assets-kicker">MEMORIES WORTH KEEPING</p><h2>徽章收藏</h2></div><p>每枚徽章都记录一个真实发生过的成长瞬间。</p></div>
        {badges.length === 0 ? <EmptyState title="还没有徽章" description="完成成长任务，收下第一枚纪念徽章吧。" /> : <div className="badge-grid">{badges.map((badge) => <article className="badge-card" key={badge.id}><div className="badge-medal"><BadgeCheck size={30} aria-hidden="true" /></div><div className="badge-card-copy"><span className="badge-label">PAWID BADGE</span><h3>{badge.name}</h3><p>{badge.reason}</p><time dateTime={badge.earnedAt}>{formatDate(badge.earnedAt)}</time></div></article>)}</div>}
      </div>}
      {tab === 'wardrobe' && <div className="assets-tab-panel" role="tabpanel" id="assets-panel-wardrobe" aria-labelledby="assets-tab-wardrobe">
        <div className="panel-intro"><div><p className="assets-kicker">A LITTLE EXTRA CHARM</p><h2>衣橱与装扮</h2></div><p>{canManage ? '点击拥有的装扮即可穿戴或卸下，一次只穿一件。' : '当前为只读模式，可查看拥有与穿戴状态。'}</p></div>
        <div className="wardrobe-feature"><div className="wardrobe-feature-avatar"><PetAvatar pet={assetPet} equippedAssetPath={equippedItem ? localItemPath(equippedItem.code) : undefined} size="medium" /></div><div><span className="badge-label">CURRENT LOOK</span><h3>{equippedItem ? `${pet.name} 正在穿戴 ${equippedItem.name}` : `${pet.name} 还没有穿戴装扮`}</h3><p>{equippedItem ? '这件装扮已经叠加到数字形象上。' : '兑换一件喜欢的装扮，为今天留下新的样子。'}</p></div></div>
        <div className="catalog-grid">{catalog.map((item) => { const owned = ownedCodes.has(item.code); const ownedItem = inventory.find((candidate) => candidate.code === item.code); return <article className={`catalog-card ${owned ? 'catalog-card-owned' : ''}`} key={item.code}><div className="catalog-image"><img src={item.assetPath} alt={`${item.name} 装扮预览`} /><span>{owned ? '已拥有' : `${item.price} PAWS`}</span></div><div className="catalog-card-body"><div><h3>{item.name}</h3>{ownedItem?.equipped && <StatusTag tone="success">穿戴中</StatusTag>}</div>{ownedItem ? (canManage ? <Button variant={ownedItem.equipped ? 'secondary' : 'primary'} disabled={busyItemId === ownedItem.id} onClick={() => void toggleEquip(ownedItem)}>{busyItemId === ownedItem.id ? '保存中…' : ownedItem.equipped ? '卸下' : '穿戴'}</Button> : <span className="catalog-readonly">只读查看</span>) : (canManage ? <Button variant="secondary" onClick={() => openRedeemModal(item)}>查看并兑换</Button> : <span className="catalog-readonly">只读查看</span>)}</div></article>; })}</div>
        {operationError && <p className="assets-inline-error" role="alert"><CircleHelp size={16} aria-hidden="true" />{operationError}</p>}
      </div>}
      {tab === 'points' && <div className="assets-tab-panel" role="tabpanel" id="assets-panel-points" aria-labelledby="assets-tab-points">
        <div className="panel-intro"><div><p className="assets-kicker">EVERY STEP COUNTS</p><h2>积分明细</h2></div><p>积分余额由全部流水实时派生，按最新变更倒序排列。</p></div>
        {pointEntries.length === 0 ? <EmptyState title="还没有积分明细" description="完成一项成长任务后，这里会留下第一笔记录。" /> : <div className="points-table-wrap"><table className="points-table"><thead><tr><th scope="col">时间</th><th scope="col">事项</th><th scope="col">增减</th><th scope="col">变更后余额</th></tr></thead><tbody>{pointEntries.map((entry) => <tr key={entry.id}><td><time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time></td><td><span className="point-title">{entry.title}</span>{entry.kind === 'seed' && <small>演示种子数据</small>}</td><td className={entry.amount >= 0 ? 'point-positive' : 'point-negative'}>{entry.amount >= 0 ? <ArrowUpRight size={15} aria-hidden="true" /> : <ArrowDownLeft size={15} aria-hidden="true" />}{entry.amount > 0 ? '+' : ''}{entry.amount} PAWS</td><td><strong>{entry.balanceAfter} PAWS</strong></td></tr>)}</tbody></table></div>}
      </div>}
    </section>

    <section className="assets-notice"><LockKeyhole size={18} aria-hidden="true" /><div><strong>关于演示资产</strong><p>PAWS、模拟账户和装扮兑换仅用于产品体验，不支持充值、提现、转账或任何真实交易。{!canManage && '你当前没有编辑权限，页面处于只读状态。'}</p></div></section>

    <Modal open={Boolean(redeemTarget)} onClose={() => { if (!busyCode) setRedeemTarget(null); }} title="确认兑换装扮" className="redeem-modal">
      {redeemTarget && <div className="redeem-content"><div className="redeem-preview"><img src={localItemPath(redeemTarget.code)} alt={`${redeemTarget.name} 预览`} /><span><Gift size={14} aria-hidden="true" />装扮预览</span></div><div className="redeem-copy"><span className="badge-label">A NEW LOOK FOR {pet.name.toUpperCase()}</span><h3>{redeemTarget.name}</h3><p>兑换后会加入 {pet.name} 的衣橱，你可以随时穿戴或卸下。</p><div className="redeem-numbers"><div><span>价格</span><strong>{redeemTarget.price} <small>PAWS</small></strong></div><div><span>当前余额</span><strong>{balance} <small>PAWS</small></strong></div><div className={modalShortfall > 0 ? 'redeem-after redeem-after-negative' : 'redeem-after'}><span>兑换后</span><strong>{modalBalanceAfter} <small>PAWS</small></strong></div></div>{modalShortfall > 0 && <div className="redeem-shortfall" role="alert"><CircleHelp size={17} aria-hidden="true" /><div><strong>还差 {modalShortfall} PAWS</strong><p>先完成成长任务，再回来兑换。{remainingTasks.length > 0 && <>{' '}<a href={remainingTasks[0].href}>去完成任务 <ChevronRight size={14} aria-hidden="true" /></a></>}</p></div></div>}{operationError && <p className="assets-inline-error" role="alert"><X size={16} aria-hidden="true" />{operationError}</p>}<div className="button-row redeem-actions"><Button variant="secondary" disabled={Boolean(busyCode)} onClick={() => setRedeemTarget(null)}>取消</Button><Button disabled={!canManage || modalShortfall > 0 || Boolean(busyCode)} onClick={() => void confirmRedeem()}>{busyCode ? '兑换中…' : modalShortfall > 0 ? '余额不足' : '确认兑换'}</Button></div>{!canManage && <p className="readonly-hint">当前为访客只读模式，不能兑换或穿戴装扮。</p>}</div></div>}
    </Modal>
  </div>;
}

export default AssetsPage;
