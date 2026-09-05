import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, WheelEvent } from 'react';
import { ArrowRight, Check, GitBranch, LocateFixed, Plus, Search, UserPlus, Users, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { DemoState, ParentRole, Pet, Relation, RelationStatus } from '../../domain/types';
import type { GuardianView } from '../../store/selectors';
import { useDemoStore } from '../../store/DemoProvider';
import { Button, CopyBox, Drawer, EmptyState, InputField, Modal, PetAvatar, QrCode, SelectField, StatusTag, useToast } from '../../shared/ui';
import { resolveAvatarAssetPath } from '../../app/assets';
import './family.css';

interface FamilyPageProps {
  petId: string;
}

type FamilyTab = 'guardians' | 'tree';

type SelectedPet = {
  pet: Pet;
  relationship: string;
  relationStatus: RelationStatus | null;
};

/** 将记录时间格式化为适合家庭卡片阅读的中文日期。 */
function formatDate(value: string | null): string {
  if (!value) return '待确认';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** 将物种和性别转为页面上可读的短标签。 */
function describePet(pet: Pet): string {
  const species = pet.species === 'cat' ? '猫咪' : '狗狗';
  const gender = pet.gender === 'female' ? '母' : pet.gender === 'male' ? '公' : '性别未知';
  return `${species} · ${gender} · ${pet.breed || '品种待补充'}`;
}

/** 统一呈现邀请状态，文字和颜色同时表达业务状态。 */
function inviteStatus(status: 'pending' | 'accepted' | 'rejected'): { label: string; tone: 'success' | 'pending' | 'danger' } {
  if (status === 'accepted') return { label: '已接受', tone: 'success' };
  if (status === 'rejected') return { label: '已拒绝', tone: 'danger' };
  return { label: '待处理', tone: 'pending' };
}

/** 统一呈现亲缘关系状态，减少页面内的状态分支。 */
function relationStatus(status: RelationStatus): { label: string; tone: 'success' | 'pending' | 'danger' } {
  if (status === 'accepted') return { label: '双方确认', tone: 'success' };
  if (status === 'rejected') return { label: '已拒绝', tone: 'danger' };
  return { label: '待对方确认', tone: 'pending' };
}

/** 检查候选宠物是否会沿已有亲缘边形成祖先循环。 */
function wouldCreateAncestorCycle(state: DemoState, childPetId: string, parentPetId: string): boolean {
  const visited = new Set<string>();
  const queue = [parentPetId];
  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) continue;
    if (currentId === childPetId) return true;
    visited.add(currentId);
    state.relations
      .filter((relation) => relation.childPetId === currentId && relation.status !== 'rejected')
      .forEach((relation) => queue.push(relation.parentPetId));
  }
  return false;
}

/** 对新增父母申请执行全部可在提交前确定的界面校验。 */
function validateParentCandidate(state: DemoState, child: Pet, candidate: Pet | null, role: ParentRole): string | null {
  if (!candidate) return '请先搜索并选择一只宠物';
  if (candidate.id === child.id) return '不能把当前宠物设为自己的父母';
  if (candidate.species !== child.species) return '父母和子女必须是同一物种';
  const activeRelations = state.relations.filter((relation) => relation.childPetId === child.id && relation.status !== 'rejected');
  if (activeRelations.some((relation) => relation.role === role)) return `${role === 'father' ? '父亲' : '母亲'}槽位已有记录`;
  if (activeRelations.some((relation) => relation.parentPetId === candidate.id)) return '同一只宠物不能同时承担两个父母角色';
  if ((role === 'father' && candidate.gender === 'female') || (role === 'mother' && candidate.gender === 'male')) {
    return '已知性别与所选父母角色冲突';
  }
  if (candidate.birthDate && child.birthDate && candidate.birthDate >= child.birthDate) return '已知生日要求父母早于子女出生';
  if (wouldCreateAncestorCycle(state, child.id, candidate.id)) return '该关系会形成祖先循环，无法提交';
  return null;
}

/** 家庭页中的成员卡，主监护人与共同监护人共用同一视觉结构。 */
function GuardianCard({ guardian, pet }: { guardian: GuardianView; pet: Pet }): JSX.Element {
  const name = guardian.user?.nickname ?? '未识别成员';
  const isOwner = guardian.link.role === 'owner';
  const displayPet = { ...pet, avatarAssetPath: resolveAvatarAssetPath(pet.avatarAssetPath, pet.species) };
  return <article className={`guardian-card ${isOwner ? 'guardian-card-owner' : ''}`}>
    <div className="guardian-card-top"><PetAvatar pet={displayPet} size="small" showPresetLabel={false} /><div><p className="eyebrow">{isOwner ? '主监护人' : '共同监护人'}</p><h3>{name}</h3><p className="muted-text">{isOwner ? '负责家庭邀请与资料维护' : '已接受共同守护'}</p></div><StatusTag tone="success">已加入</StatusTag></div>
    <div className="guardian-card-meta"><span>加入时间</span><strong>{formatDate(guardian.link.joinedAt)}</strong></div>
  </article>;
}

/** SVG 族谱节点的内部数据，不将图谱布局写入 Store。 */
interface GraphNode {
  id: string;
  pet: Pet | null;
  x: number;
  y: number;
  relationship: string;
  status: RelationStatus | 'placeholder';
  role?: ParentRole;
}

interface GraphEdge {
  id: string;
  from: GraphNode;
  to: GraphNode;
  status: RelationStatus;
}

interface FamilyGraphProps {
  state: DemoState;
  petId: string;
  siblings: Pet[];
  onSelectPet: (selection: SelectedPet) => void;
  onAddParent: (role: ParentRole) => void;
}

/** 在纯 SVG 画布中绘制三代局部族谱，并提供拖拽、缩放和回中。 */
function FamilyGraph({ state, petId, siblings, onSelectPet, onAddParent }: FamilyGraphProps): JSX.Element {
  const pet = state.pets.find((item) => item.id === petId);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pointerStart = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);
  const activeRelations = useMemo(() => state.relations.filter((relation) => relation.status !== 'rejected'), [state.relations]);

  /** 将缩放限制在产品建议范围内，避免节点缩到不可读或被放大出画布。 */
  function changeZoom(delta: number): void {
    setZoom((current) => Math.min(1.45, Math.max(0.65, Number((current + delta).toFixed(2)))));
  }

  /** 恢复默认视口，画布内容仍限制在自身 SVG 内部移动。 */
  function centerCanvas(): void {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }

  /** 处理画布滚轮缩放并阻止页面同步滚动。 */
  function handleWheel(event: WheelEvent<SVGSVGElement>): void {
    event.preventDefault();
    changeZoom(event.deltaY > 0 ? -0.08 : 0.08);
  }

  /** 记录指针起点，后续移动只改变族谱视口偏移。 */
  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>): void {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerStart.current = { clientX: event.clientX, clientY: event.clientY, panX: pan.x, panY: pan.y };
  }

  /** 在 SVG 内部移动图谱，不触碰页面布局宽度。 */
  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>): void {
    if (!pointerStart.current) return;
    const start = pointerStart.current;
    setPan({ x: start.panX + (event.clientX - start.clientX) / zoom, y: start.panY + (event.clientY - start.clientY) / zoom });
  }

  /** 释放画布指针捕获，结束一次拖拽。 */
  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>): void {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pointerStart.current = null;
  }

  if (!pet) return <EmptyState title="暂时无法绘制族谱" description="当前宠物资料不存在，族谱节点无法加载。" />;

  const parentRelations = (['father', 'mother'] as ParentRole[]).map((role) => activeRelations.find((relation) => relation.childPetId === pet.id && relation.role === role) ?? null);
  const parentNodes: GraphNode[] = parentRelations.map((relation, index) => {
    const role = index === 0 ? 'father' : 'mother';
    const parentPet = relation ? state.pets.find((item) => item.id === relation.parentPetId) ?? null : null;
    return {
      id: relation?.id ?? `placeholder-${role}`,
      pet: parentPet,
      x: role === 'father' ? 370 : 610,
      y: 210,
      relationship: role === 'father' ? '父亲' : '母亲',
      status: relation?.status ?? 'placeholder',
      role,
    };
  });
  const currentAndSiblings: GraphNode[] = [pet, ...siblings].map((item, index) => {
    let x = 490;
    if (index > 0) {
      const siblingIndex = index - 1;
      x = siblingIndex % 2 === 0 ? 145 + Math.floor(siblingIndex / 2) * 150 : 835 - Math.floor(siblingIndex / 2) * 150;
    }
    return { id: item.id, pet: item, x, y: 355, relationship: item.id === pet.id ? '当前宠物' : '兄弟姐妹（派生）', status: 'accepted' };
  });
  const nodeByPetId = new Map(currentAndSiblings.map((node) => [node.pet?.id ?? node.id, node]));
  const grandparentNodes: GraphNode[] = [];
  const grandparentEdges: GraphEdge[] = [];
  parentNodes.forEach((parentNode) => {
    if (!parentNode.pet) return;
    const relationList = activeRelations.filter((relation) => relation.childPetId === parentNode.pet?.id);
    relationList.forEach((relation, index) => {
      const existing = grandparentNodes.find((node) => node.pet?.id === relation.parentPetId);
      const grandparentPet = state.pets.find((item) => item.id === relation.parentPetId) ?? null;
      const grandparentNode = existing ?? {
        id: relation.id,
        pet: grandparentPet,
        x: parentNode.x + (index === 0 ? -66 : 66),
        y: 75,
        relationship: relation.role === 'father' ? '祖父' : '祖母',
        status: relation.status,
        role: relation.role,
      };
      if (!existing) grandparentNodes.push(grandparentNode);
      grandparentEdges.push({ id: `edge-${relation.id}`, from: grandparentNode, to: parentNode, status: relation.status });
    });
  });
  const edges: GraphEdge[] = [];
  parentNodes.forEach((parentNode) => {
    if (parentNode.status !== 'placeholder') {
      const relation = parentRelations.find((candidate) => candidate?.id === parentNode.id);
      if (relation) {
        currentAndSiblings.filter((node) => node.pet && (node.pet.id === pet.id || siblings.some((sibling) => sibling.id === node.pet?.id) && activeRelations.some((candidate) => candidate.childPetId === node.pet?.id && candidate.parentPetId === relation.parentPetId && candidate.status === 'accepted'))).forEach((childNode) => {
          edges.push({ id: `edge-${parentNode.id}-${childNode.id}`, from: parentNode, to: childNode, status: relation.status });
        });
      }
    } else {
      const currentNode = nodeByPetId.get(pet.id);
      if (currentNode) edges.push({ id: `edge-${parentNode.id}-${currentNode.id}`, from: parentNode, to: currentNode, status: 'pending' });
    }
  });
  const allNodes = [...grandparentNodes, ...parentNodes, ...currentAndSiblings];

  /** 节点键盘操作和点击共用同一选择入口。 */
  function selectNode(node: GraphNode): void {
    if (!node.pet) {
      if (node.role) onAddParent(node.role);
      return;
    }
    onSelectPet({ pet: node.pet, relationship: node.relationship, relationStatus: node.status === 'placeholder' ? null : node.status });
  }

  /** 将 Enter 和空格映射为 SVG 节点的可访问点击。 */
  function handleNodeKeyDown(event: KeyboardEvent<SVGGElement>, node: GraphNode): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    selectNode(node);
  }

  return <section className="family-graph-shell" aria-labelledby="family-graph-title">
    <div className="family-section-heading"><div><p className="eyebrow">三代局部关系</p><h2 id="family-graph-title">宠物族谱</h2></div><div className="family-graph-actions"><Button variant="secondary" onClick={() => changeZoom(0.1)} title="放大族谱"><ZoomIn size={16} aria-hidden="true" />放大</Button><Button variant="secondary" onClick={() => changeZoom(-0.1)} title="缩小族谱"><ZoomOut size={16} aria-hidden="true" />缩小</Button><Button variant="ghost" onClick={centerCanvas} title="回到族谱中心"><LocateFixed size={16} aria-hidden="true" />回到中心</Button></div></div>
    <p className="muted-text">可拖动画布，滚轮缩放。虚线表示待确认关系；同层的兄弟姐妹由已确认父母关系自动派生。</p>
    <div className="family-graph-canvas" aria-label="可拖拽的三代宠物族谱">
      <svg className="family-svg" viewBox="0 0 980 450" role="img" aria-labelledby="family-graph-title" onWheel={handleWheel} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {grandparentEdges.concat(edges).map((edge) => <line className={`family-graph-edge family-graph-edge-${edge.status}`} key={edge.id} x1={edge.from.x} y1={edge.from.y + 39} x2={edge.to.x} y2={edge.to.y - 39} />)}
          {allNodes.map((node) => <g className={`family-graph-node family-graph-node-${node.status}`} key={node.id} transform={`translate(${node.x} ${node.y})`} role="button" tabIndex={0} aria-label={node.pet ? `${node.pet.name}，${node.relationship}` : `添加${node.role === 'father' ? '父亲' : '母亲'}`} onClick={() => selectNode(node)} onKeyDown={(event) => handleNodeKeyDown(event, node)}>
            <rect x="-75" y="-39" width="150" height="78" rx="18" />
            {node.pet ? <><circle className="family-node-avatar" cx="-49" cy="0" r="24" /><text className="family-node-mark" x="-49" y="6" textAnchor="middle">{node.pet.name.slice(0, 1)}</text><text className="family-node-name" x="-14" y="-9">{node.pet.name}</text><text className="family-node-meta" x="-14" y="12">{node.relationship}</text><text className="family-node-status" x="-14" y="29">{node.status === 'pending' ? '待确认' : node.status === 'accepted' ? '双方确认' : ''}</text></> : <><text className="family-placeholder-mark" x="0" y="-4" textAnchor="middle"><tspan>＋</tspan></text><text className="family-node-meta" x="0" y="20" textAnchor="middle">添加{node.role === 'father' ? '父亲' : '母亲'}</text></>}
          </g>)}
        </g>
      </svg>
    </div>
    <div className="family-graph-legend"><span><i className="legend-dot legend-dot-current" />当前宠物</span><span><i className="legend-line legend-line-solid" />双方确认</span><span><i className="legend-line legend-line-dashed" />待确认</span></div>
  </section>;
}

/** 家庭共同监护、邀请确认入口和三代族谱的主页面。 */
export default function FamilyPage({ petId }: FamilyPageProps): JSX.Element {
  const { state, actions, selectors } = useDemoStore();
  const { showError, showSuccess } = useToast();
  const pet = selectors.getPetById(state, petId);
  const [tab, setTab] = useState<FamilyTab>('guardians');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteNickname, setInviteNickname] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteRequestNickname, setInviteRequestNickname] = useState('');
  const [createdInviteId, setCreatedInviteId] = useState<string | null>(null);
  const [parentOpen, setParentOpen] = useState(false);
  const [parentRole, setParentRole] = useState<ParentRole>('father');
  const [parentSearch, setParentSearch] = useState('');
  const [parentSelectedId, setParentSelectedId] = useState('');
  const [parentError, setParentError] = useState('');
  const [selectedPet, setSelectedPet] = useState<SelectedPet | null>(null);
  const [familyCelebration, setFamilyCelebration] = useState(false);

  const guardians = useMemo(() => pet ? selectors.getGuardians(state, pet.id) : [], [pet, selectors, state]);
  const siblings = useMemo(() => pet ? selectors.getSiblings(state, pet.id) : [], [pet, selectors, state]);
  const petInvites = useMemo(() => pet ? state.invites.filter((invite) => invite.petId === pet.id).sort((left, right) => right.createdAt.localeCompare(left.createdAt)) : [], [pet, state.invites]);
  const childRelations = useMemo(() => pet ? state.relations.filter((relation) => relation.childPetId === pet.id).sort((left, right) => right.createdAt.localeCompare(left.createdAt)) : [], [pet, state.relations]);
  const canManage = pet ? selectors.canManagePet(state, pet.id) : false;
  const canInvite = canManage && state.currentRole === 'owner';
  const owner = guardians.find((guardian) => guardian.link.role === 'owner');
  const createdInvite = createdInviteId ? state.invites.find((invite) => invite.id === createdInviteId) ?? null : null;
  const acceptedInvite = petInvites.find((invite) => invite.status === 'accepted' && invite.acceptedAt) ?? null;
  const parentCandidates = useMemo(() => state.pets.filter((candidate) => candidate.id !== petId && (!parentSearch.trim() || `${candidate.name} ${candidate.id} ${candidate.breed}`.toLowerCase().includes(parentSearch.trim().toLowerCase()))), [parentSearch, petId, state.pets]);

  /** 观察 Store 新增邀请，以便把生成结果展示在当前弹窗内。 */
  useEffect(() => {
    if (!inviteRequestNickname || createdInviteId) return;
    const nextInvite = [...state.invites].reverse().find((invite) => invite.petId === petId && invite.inviteeNickname === inviteRequestNickname && invite.status === 'pending');
    if (!nextInvite) return;
    setCreatedInviteId(nextInvite.id);
    setInviteRequestNickname('');
  }, [createdInviteId, inviteRequestNickname, petId, state.invites]);

  /** 接受邀请回到家庭页时显示一次性 CSS 彩带，重载后不重复打扰。 */
  useEffect(() => {
    if (!acceptedInvite) return undefined;
    const key = `pawid-family-celebration:${petId}:${acceptedInvite.id}`;
    try {
      if (window.sessionStorage.getItem(key) === 'shown') return undefined;
      window.sessionStorage.setItem(key, 'shown');
      setFamilyCelebration(true);
      const timer = window.setTimeout(() => setFamilyCelebration(false), 5200);
      return () => window.clearTimeout(timer);
    } catch {
      setFamilyCelebration(true);
      return undefined;
    }
  }, [acceptedInvite, petId]);

  /** 切换家庭页的两个键盘可访问业务面板。 */
  function selectTab(nextTab: FamilyTab): void {
    setTab(nextTab);
  }

  /** 使用方向键在家庭/族谱标签间移动焦点。 */
  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const nextTab = tab === 'guardians' ? 'tree' : 'guardians';
    setTab(nextTab);
  }

  /** 打开邀请弹窗并清理上次提交的局部反馈。 */
  function openInviteModal(): void {
    setInviteNickname('');
    setInviteError('');
    setInviteRequestNickname('');
    setCreatedInviteId(null);
    setInviteOpen(true);
  }

  /** 关闭邀请弹窗；失败时的表单保留在打开状态，不会丢失输入。 */
  function closeInviteModal(): void {
    setInviteOpen(false);
  }

  /** 校验昵称并调用 Store 创建共同监护邀请。 */
  async function submitInvite(): Promise<void> {
    if (inviteSubmitting) return;
    const nickname = inviteNickname.trim();
    const length = Array.from(nickname).length;
    if (length < 1 || length > 20) {
      setInviteError('昵称需要为 1-20 个字');
      return;
    }
    const memberNames = guardians.map((guardian) => guardian.user?.nickname).filter((name): name is string => Boolean(name));
    if (memberNames.includes(nickname)) {
      setInviteError('不能邀请主监护人或已有家庭成员');
      return;
    }
    if (petInvites.some((invite) => invite.inviteeNickname === nickname && invite.status === 'pending')) {
      setInviteError('这位家人已有待处理邀请，请勿重复发送');
      return;
    }
    setInviteError('');
    setCreatedInviteId(null);
    setInviteRequestNickname(nickname);
    setInviteSubmitting(true);
    try {
      await actions.createInvite({ petId, inviteeNickname: nickname });
      showSuccess('邀请已在本机生成；跨设备发送尚未接入，可先留档链接');
    } catch (error) {
      const message = error instanceof Error ? error.message : '邀请生成失败，请保留表单后重试';
      setInviteError(message);
      setInviteRequestNickname('');
      showError(message);
    } finally {
      setInviteSubmitting(false);
    }
  }

  /** 在当前浏览器打开邀请确认页，以本机受邀者身份查看。 */
  function openInviteLink(inviteId: string): void {
    window.location.hash = `#/invite/${inviteId}`;
  }

  /** 打开添加父母弹窗并按当前缺失槽位预选角色。 */
  function openParentModal(role: ParentRole = 'father'): void {
    setParentRole(role);
    setParentSearch('');
    setParentSelectedId('');
    setParentError('');
    setParentOpen(true);
  }

  /** 关闭添加父母弹窗并保留 Store 中已经提交的关系状态。 */
  function closeParentModal(): void {
    setParentOpen(false);
  }

  /** 执行父母候选校验并提交待确认关系申请。 */
  async function submitParentRelation(): Promise<void> {
    if (!pet) return;
    const candidate = state.pets.find((item) => item.id === parentSelectedId) ?? null;
    const error = validateParentCandidate(state, pet, candidate, parentRole);
    if (error) {
      setParentError(error);
      return;
    }
    setParentError('');
    try {
      await actions.createParentRelation({ childPetId: pet.id, parentPetId: candidate!.id, role: parentRole });
      showSuccess('亲缘申请已提交，图谱中的关系会以虚线等待确认');
      closeParentModal();
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : '亲缘申请失败，请保留选择后重试';
      setParentError(message);
      showError(message);
    }
  }

  /** 在本机以对方身份处理父母关系申请；跨设备独立确认尚未接入。 */
  async function decideParentRelation(relation: Relation, status: 'accepted' | 'rejected'): Promise<void> {
    try {
      await actions.decideRelation(relation.id, status);
      showSuccess(status === 'accepted' ? '已在本机代为确认这组亲缘关系' : '已在本机代为拒绝这组亲缘关系');
    } catch (error) {
      const message = error instanceof Error ? error.message : '处理亲缘申请失败';
      showError(message);
    }
  }

  if (!pet) return <EmptyState title="找不到这只宠物" description={`没有找到宠物 ID「${petId}」，请从有效的 PawID 链接进入。`} action={<Button onClick={() => { window.location.hash = '#/'; }}>回到首页</Button>} />;

  const inviteUrl = createdInvite ? `${window.location.origin}#/invite/${createdInvite.id}` : '';
  const profileCredential = selectedPet ? state.credentials.find((credential) => credential.petId === selectedPet.pet.id) : null;
  const profileHasPermission = selectedPet ? selectors.canManagePet(state, selectedPet.pet.id) : false;
  const roleDescription = state.currentRole === 'owner' ? '当前身份：主监护人' : state.currentRole === 'invitee' ? '当前身份：受邀者（本机）' : '当前身份：访客（只读）';
  const displayPet = { ...pet, avatarAssetPath: resolveAvatarAssetPath(pet.avatarAssetPath, pet.species) };

  return <div className="family-page">
    <header className="family-page-header"><div><p className="eyebrow">{roleDescription}</p><h1>{pet.name} 的监护家庭与宠物族谱</h1><p className="family-lede">把陪伴它成长的人和血缘关系，放在同一份可确认的家庭记录里。</p></div><div className="family-header-actions"><StatusTag tone={canManage ? 'success' : 'neutral'}>{canManage ? '可管理资料' : '只读资料'}</StatusTag>{!canManage && <span className="family-permission-note">当前身份没有监护权限，操作按钮已禁用。</span>}</div></header>
    {familyCelebration && <div className="family-celebration" role="status" aria-live="polite"><span className="ribbon ribbon-one">PAWS</span><span className="ribbon ribbon-two">+50</span><span className="ribbon ribbon-three">一起守护</span><strong>首次共同守护奖励 +50 PAWS 积分（仅本机记录）</strong><span>{acceptedInvite?.inviteeNickname ?? '新家人'} 已加入家庭</span></div>}
    <div className="family-tabs" role="tablist" aria-label="家庭功能切换"><button type="button" role="tab" aria-selected={tab === 'guardians'} tabIndex={tab === 'guardians' ? 0 : -1} className={tab === 'guardians' ? 'active' : ''} onClick={() => selectTab('guardians')} onKeyDown={handleTabKeyDown}><Users size={17} aria-hidden="true" />监护家庭</button><button type="button" role="tab" aria-selected={tab === 'tree'} tabIndex={tab === 'tree' ? 0 : -1} className={tab === 'tree' ? 'active' : ''} onClick={() => selectTab('tree')} onKeyDown={handleTabKeyDown}><GitBranch size={17} aria-hidden="true" />宠物族谱</button></div>
    {tab === 'guardians' && <section className="family-panel" role="tabpanel" aria-label="监护家庭">
      <div className="family-section-heading"><div><p className="eyebrow">共同照护</p><h2>监护家庭</h2></div><Button onClick={openInviteModal} disabled={!canInvite} title={!canInvite ? '只有有权限的主监护人可以邀请家人' : '邀请家人'}><UserPlus size={17} aria-hidden="true" />邀请家人</Button></div>
      {!canInvite && <p className="family-readonly-hint">只有主监护人可以发起邀请；当前资料仍可查看，但邀请按钮不可用。</p>}
      <div className="guardian-list">{guardians.length > 0 ? guardians.map((guardian) => <GuardianCard key={guardian.link.id} guardian={guardian} pet={pet} />) : <EmptyState title="还没有监护成员" description="这只宠物暂时没有可展示的监护关系。" />}</div>
      <section className="family-subsection"><div className="family-section-heading"><div><p className="eyebrow">邀请记录</p><h2>待处理邀请</h2></div><span className="muted-text">{petInvites.length} 条记录</span></div>{petInvites.length === 0 ? <EmptyState title="暂无邀请" description="主监护人可以邀请家人一起记录陪伴。" /> : <div className="invite-list">{petInvites.map((invite) => { const status = inviteStatus(invite.status); return <article className="invite-record" key={invite.id}><div><div className="invite-record-title"><strong>{invite.inviteeNickname}</strong><StatusTag tone={status.tone}>{status.label}</StatusTag></div><p className="muted-text">共同监护 · 发起于 {formatDate(invite.createdAt)}{invite.acceptedAt ? ` · 加入于 ${formatDate(invite.acceptedAt)}` : ''}</p></div>{invite.status === 'pending' && <ArrowRight size={17} aria-hidden="true" className="muted-icon" />}</article>; })}</div>}</section>
      <section className="family-subsection"><div className="family-section-heading"><div><p className="eyebrow">新成员</p><h2>共同守护卡</h2></div></div>{acceptedInvite ? <div className="family-pair-card"><div className="family-pair-avatar"><PetAvatar pet={displayPet} size="small" showPresetLabel={false} /><span className="pair-plus">＋</span><PetAvatar pet={displayPet} size="small" showPresetLabel={false} /></div><div><strong>{owner?.user?.nickname ?? '主监护人'} 与 {acceptedInvite.inviteeNickname}</strong><p className="muted-text">一起陪伴 {pet.name} 成长 · {formatDate(acceptedInvite.acceptedAt)}</p><span className="family-reward-copy">首次共同守护奖励 +50 PAWS 积分（仅本机记录）</span></div></div> : <EmptyState title="等待共同守护者加入" description="接受邀请后，这里会展示双人宠物卡与加入时间。" />}</section>
    </section>}
    {tab === 'tree' && <section className="family-panel" role="tabpanel" aria-label="宠物族谱"><FamilyGraph state={state} petId={pet.id} siblings={siblings} onSelectPet={setSelectedPet} onAddParent={(role) => { if (canManage) openParentModal(role); }} /><section className="family-subsection relation-subsection"><div className="family-section-heading"><div><p className="eyebrow">关系申请</p><h2>父母关系处理</h2></div><Button variant="secondary" disabled={!canManage} onClick={() => openParentModal()} title={!canManage ? '当前身份没有新增亲缘关系的权限' : '添加父母'}><Plus size={17} aria-hidden="true" />添加父母</Button></div>{!canManage && <p className="family-readonly-hint">当前身份没有监护权限，亲缘资料只读；申请和处理按钮已禁用。</p>}{childRelations.length === 0 ? <p className="muted-text">还没有父母关系记录，可以从图谱中的虚线节点开始添加。</p> : <div className="relation-list">{childRelations.map((relation) => { const relationView = relationStatus(relation.status); const parent = state.pets.find((candidate) => candidate.id === relation.parentPetId); return <article className="relation-record" key={relation.id}><div><strong>{relation.role === 'father' ? '父亲' : '母亲'}：{parent?.name ?? '未知宠物'}</strong><p className="muted-text">{parent ? describePet(parent) : '资料不存在'} · 提交于 {formatDate(relation.createdAt)}</p></div><div className="relation-record-actions"><StatusTag tone={relationView.tone}>{relationView.label}</StatusTag>{relation.status === 'pending' && <><Button variant="secondary" disabled={!canManage} onClick={() => void decideParentRelation(relation, 'accepted')} title={!canManage ? '当前身份没有处理亲缘申请的权限' : '在本机以对方身份确认'}><Check size={15} aria-hidden="true" />代为确认</Button><Button variant="ghost" disabled={!canManage} onClick={() => void decideParentRelation(relation, 'rejected')} title={!canManage ? '当前身份没有处理亲缘申请的权限' : '在本机以对方身份拒绝'}><X size={15} aria-hidden="true" />代为拒绝</Button></>}</div></article>; })}</div>}</section></section>}
    <Modal open={inviteOpen} onClose={closeInviteModal} title="邀请家人一起守护"><p className="muted-text">跨设备邀请尚未接入：邀请记录仅保存在本机浏览器，邀请链接也不是安全凭证，只用于在本机打开确认页。</p><InputField label="受邀者昵称" value={inviteNickname} maxLength={20} placeholder="例如：阿宁" onChange={(event) => setInviteNickname(event.target.value)} error={inviteError} /><div className="button-row"><Button onClick={() => void submitInvite()} disabled={!canInvite || inviteSubmitting}><UserPlus size={16} aria-hidden="true" />{inviteSubmitting ? '生成中…' : '生成邀请'}</Button><Button variant="secondary" onClick={closeInviteModal}>稍后处理</Button></div>{createdInvite && <div className="invite-created"><div className="invite-created-heading"><Check size={18} aria-hidden="true" /><strong>邀请已生成</strong></div><p className="muted-text">当前无法跨设备发送。可先复制链接或二维码留档，并在本机以受邀者身份打开确认页。</p><CopyBox value={inviteUrl} label="邀请链接" /><QrCode value={inviteUrl} label="共同监护邀请二维码（本机使用）" /><Button variant="secondary" onClick={() => openInviteLink(createdInvite.id)}><ArrowRight size={16} aria-hidden="true" />以受邀者身份打开</Button></div>}</Modal>
    <Modal open={parentOpen} onClose={closeParentModal} title="添加父母关系"><p className="muted-text">按名称或 PawID 搜索已有宠物。提交后会先进入待确认状态。</p><SelectField label="父母角色" value={parentRole} onChange={(event) => setParentRole(event.target.value as ParentRole)}><option value="father">父亲</option><option value="mother">母亲</option></SelectField><label className="family-search-field"><span>搜索宠物</span><div className="family-search-input"><Search size={16} aria-hidden="true" /><input value={parentSearch} placeholder="名称、PawID 或品种" onChange={(event) => { setParentSearch(event.target.value); setParentSelectedId(''); }} /></div></label><div className="parent-candidate-list">{parentCandidates.length === 0 ? <p className="muted-text">没有匹配的宠物。</p> : parentCandidates.slice(0, 12).map((candidate) => <button className={`parent-candidate ${parentSelectedId === candidate.id ? 'selected' : ''}`} type="button" key={candidate.id} onClick={() => { setParentSelectedId(candidate.id); setParentError(''); }}><span className="parent-candidate-mark">{candidate.name.slice(0, 1)}</span><span><strong>{candidate.name}</strong><small>{candidate.id} · {describePet(candidate)}</small></span>{parentSelectedId === candidate.id && <Check size={17} aria-hidden="true" />}</button>)}</div>{parentError && <p className="field-error" role="alert">{parentError}</p>}<div className="button-row"><Button onClick={() => void submitParentRelation()} disabled={!canManage}><Plus size={16} aria-hidden="true" />提交申请</Button><Button variant="secondary" onClick={closeParentModal}>取消</Button></div></Modal>
    <Drawer open={Boolean(selectedPet)} onClose={() => setSelectedPet(null)} title={selectedPet ? `${selectedPet.pet.name} 的节点资料` : '节点资料'}>{selectedPet && <div className="pet-profile-drawer"><PetAvatar pet={{ ...selectedPet.pet, avatarAssetPath: resolveAvatarAssetPath(selectedPet.pet.avatarAssetPath, selectedPet.pet.species) }} size="small" showPresetLabel={false} /><div className="pet-profile-title"><h3>{selectedPet.pet.name}</h3><p className="muted-text">{describePet(selectedPet.pet)}</p><StatusTag tone={selectedPet.relationStatus === 'pending' ? 'pending' : 'success'}>{selectedPet.relationship}</StatusTag></div><dl className="profile-details"><div><dt>关系标签</dt><dd>{selectedPet.relationStatus === 'accepted' ? '双方确认' : selectedPet.relationStatus === 'pending' ? '用户填写 · 待确认' : '用户填写'}</dd></div><div><dt>资料来源</dt><dd>{profileCredential?.source === 'institution_demo' ? '机构登记（尚未接入真实机构）' : profileCredential?.source === 'mutual_confirmed' ? '双方确认' : '用户填写'}</dd></div><div><dt>出生日期</dt><dd>{selectedPet.pet.birthDate ?? '未填写'}</dd></div><div><dt>简介</dt><dd>{selectedPet.pet.introduction || '暂无简介'}</dd></div></dl>{profileHasPermission ? <a className="family-profile-link" href={`#/pets/${selectedPet.pet.id}?tab=overview`}>查看档案<ArrowRight size={15} aria-hidden="true" /></a> : <p className="family-readonly-hint">当前浏览器没有这只宠物的监护权限，仅展示公开资料。</p>}</div>}</Drawer>
  </div>;
}
