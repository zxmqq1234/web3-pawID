import type {
  Badge,
  DemoState,
  FoundReport,
  GuardianLink,
  InventoryItem,
  LifeEvent,
  LostCase,
  Pet,
  User,
} from '../domain/types';

/** 宠物统计由状态数组实时派生，避免保存可过期的计数副本。 */
export interface PetStats {
  memberCount: number;
  eventCount: number;
  badgeCount: number;
  balance: number;
  siblingCount: number;
}

/** 面向家庭 UI 的成员展示数据。 */
export interface GuardianView {
  link: GuardianLink;
  user: User | null;
}

/** PawTag 公开资料，主动排除家庭、账户和健康等私密字段。 */
export interface PublicPetProfile {
  id: string;
  name: string;
  species: Pet['species'];
  breed: string;
  coatColor: string;
  appearance: string;
  photoKey: string | null;
  avatarAssetPath: string;
  avatarStyle: Pet['avatarStyle'];
  safetyStatus: 'safe' | 'searching' | 'reported' | 'closed' | 'reunited';
  lostCase: LostCase | null;
}

/** 根据 ID 读取宠物；无效 ID 返回 null，供页面显示解释型空状态。 */
export function getPetById(state: DemoState, petId: string): Pet | null {
  return state.pets.find((pet) => pet.id === petId) ?? null;
}

/** 读取宠物当前余额，积分流水是唯一事实来源。 */
export function getPetBalance(state: DemoState, petId: string): number {
  return state.pointEntries.filter((entry) => entry.petId === petId).reduce((total, entry) => total + entry.amount, 0);
}

/** 返回当前宠物所有已接受的监护成员，主监护人排在共同监护人前。 */
export function getGuardians(state: DemoState, petId: string): GuardianView[] {
  return state.guardianLinks
    .filter((link) => link.petId === petId && link.status === 'accepted')
    .sort((left, right) => (left.role === 'owner' ? -1 : right.role === 'owner' ? 1 : 0))
    .map((link) => ({ link, user: state.users.find((user) => user.id === link.userId) ?? null }));
}

/** 找到宠物的主监护人；没有监护关系时返回 null。 */
export function getOwner(state: DemoState, petId: string): GuardianView | null {
  return getGuardians(state, petId).find((guardian) => guardian.link.role === 'owner') ?? null;
}

/** 读取宠物生命档案，默认按日期倒序供时间线使用。 */
export function getPetEvents(state: DemoState, petId: string): LifeEvent[] {
  return state.lifeEvents.filter((event) => event.petId === petId).sort((left, right) => right.date.localeCompare(left.date));
}

/** 读取宠物凭证并保持种子顺序。 */
export function getPetCredentials(state: DemoState, petId: string) {
  return state.credentials.filter((credential) => credential.petId === petId);
}

/** 读取宠物衣橱中已经拥有的物品。 */
export function getPetInventory(state: DemoState, petId: string): InventoryItem[] {
  return state.inventoryItems.filter((item) => item.petId === petId && item.owned);
}

/** 返回当前唯一穿戴的装扮，没有穿戴时返回 null。 */
export function getEquippedItem(state: DemoState, petId: string): InventoryItem | null {
  return getPetInventory(state, petId).find((item) => item.equipped) ?? null;
}

/** 读取宠物徽章，按获得时间倒序展示。 */
export function getPetBadges(state: DemoState, petId: string): Badge[] {
  return state.badges.filter((badge) => badge.petId === petId).sort((left, right) => right.earnedAt.localeCompare(left.earnedAt));
}

/** 当前有效寻宠事件只取 searching/reported，结束事件通过历史列表另行展示。 */
export function getActiveLostCase(state: DemoState, petId: string): LostCase | null {
  return [...state.lostCases].reverse().find((item) => item.petId === petId && (item.status === 'searching' || item.status === 'reported')) ?? null;
}

/** 读取当前宠物全部线索，按提交时间倒序。 */
export function getFoundReports(state: DemoState, petId: string): FoundReport[] {
  return state.foundReports.filter((report) => report.petId === petId).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

/**
 * 根据共同确认父母关系派生兄弟姐妹，不写入冗余 sibling 关系。
 * 只要与当前宠物共享任一已确认父母，即可列为姐妹/兄弟候选。
 */
export function getSiblings(state: DemoState, petId: string): Pet[] {
  const parentIds = new Set(state.relations
    .filter((relation) => relation.childPetId === petId && relation.status === 'accepted')
    .map((relation) => relation.parentPetId));
  if (parentIds.size === 0) return [];
  const siblingIds = new Set(state.relations
    .filter((relation) => parentIds.has(relation.parentPetId) && relation.status === 'accepted' && relation.childPetId !== petId)
    .map((relation) => relation.childPetId));
  return state.pets.filter((pet) => siblingIds.has(pet.id));
}

/** 返回可安全放入 PawTag 的公开数据，不包含监护人、联系方式、账户或健康详情。 */
export function getPublicPetProfile(state: DemoState, petId: string): PublicPetProfile | null {
  const pet = getPetById(state, petId);
  if (!pet) return null;
  const lostCase = getActiveLostCase(state, petId);
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    coatColor: pet.coatColor,
    appearance: pet.publicProfile.appearance,
    photoKey: pet.photoKey,
    avatarAssetPath: pet.avatarAssetPath,
    avatarStyle: pet.avatarStyle,
    safetyStatus: lostCase?.status ?? 'safe',
    lostCase,
  };
}

/** 页面操作权限模拟：主监护人和共同监护人可管理，访客只读。 */
export function canManagePet(state: DemoState, petId: string, userId?: string): boolean {
  if (state.currentRole === 'visitor') return false;
  const effectiveUserId = userId ?? (state.currentRole === 'owner' ? 'user-xiaolin' : 'user-aning');
  return state.guardianLinks.some((link) => link.petId === petId && link.userId === effectiveUserId && link.status === 'accepted');
}

/** 消息入口的未读数量用待处理邀请和新线索数量模拟。 */
export function getUnreadMessages(state: DemoState): number {
  const pendingInvites = state.invites.filter((invite) => invite.status === 'pending').length;
  const reportedCases = state.lostCases.filter((lostCase) => lostCase.status === 'reported').length;
  return pendingInvites + reportedCases;
}

/** 一次性返回工作台常用统计。 */
export function getPetStats(state: DemoState, petId: string): PetStats {
  return {
    memberCount: getGuardians(state, petId).length,
    eventCount: getPetEvents(state, petId).length,
    badgeCount: getPetBadges(state, petId).length,
    balance: getPetBalance(state, petId),
    siblingCount: getSiblings(state, petId).length,
  };
}
