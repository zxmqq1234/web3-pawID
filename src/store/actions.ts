import { cloneSeedState } from '../domain/seed';
import type {
  CreateInviteInput,
  CreateParentRelationInput,
  CreatePetInput,
  CreateDraft,
  DemoRole,
  DemoState,
  FoundReportInput,
  InventoryItemCode,
  LifeEvent,
  LifeEventInput,
  LifeRecordAnchor,
  LostCaseInput,
  Pet,
  PetChainIdentity,
  PointPackCode,
  RelationStatus,
  UpdatePetInput,
} from '../domain/types';

/** 统一的业务操作动作，Provider 将其作为单次 reducer 更新提交。 */
export type DemoAction =
  | { type: 'RUN_OPERATION'; operation: OperationAction }
  | { type: 'SET_ROLE'; role: DemoRole }
  | { type: 'SET_FAIL_NEXT'; value: boolean }
  | { type: 'CONSUME_FAIL_NEXT' }
  | { type: 'SAVE_CREATE_DRAFT'; draft: CreateDraft }
  | { type: 'CLEAR_CREATE_DRAFT' }
  | { type: 'HYDRATE'; state: DemoState }
  | { type: 'RESET'; state: DemoState };

/** 业务写入动作的完整联合类型，保证一次提交完成关联数据更新。 */
export type OperationAction =
  | { type: 'CREATE_PET'; input: CreatePetInput; petId: string; createdAt: string; operationKey: string }
  | { type: 'UPDATE_PET'; petId: string; input: UpdatePetInput; updatedAt: string }
  | { type: 'CREATE_INVITE'; input: CreateInviteInput; inviteId: string; inviterId: string; createdAt: string }
  | { type: 'DECIDE_INVITE'; inviteId: string; status: 'accepted' | 'rejected'; decidedAt: string }
  | { type: 'CREATE_PARENT_RELATION'; input: CreateParentRelationInput; relationId: string; proposedBy: string; createdAt: string }
  | { type: 'DECIDE_RELATION'; relationId: string; status: RelationStatus; decidedAt: string }
  | { type: 'ADD_LIFE_EVENT'; input: LifeEventInput; event: LifeEvent; rewardEntryId: string; rewardCreatedAt: string }
  | { type: 'UPDATE_LIFE_EVENT'; eventId: string; input: LifeEventInput; updatedAt: string }
  | { type: 'DELETE_LIFE_EVENT'; eventId: string }
  | { type: 'REDEEM_ITEM'; petId: string; code: InventoryItemCode; itemId: string; createdAt: string; pointEntryId: string; transactionId: string }
  /** 本机积分包领取：不接入支付通道，仅写入一笔正向积分流水并记录操作键防重。 */
  | { type: 'PURCHASE_POINTS'; petId: string; packCode: PointPackCode; entryId: string; createdAt: string; operationKey: string; transactionId: string }
  | { type: 'EQUIP_ITEM'; petId: string; itemId: string; equipped: boolean }
  | { type: 'OPEN_LOST_CASE'; input: LostCaseInput; caseId: string; createdAt: string }
  | { type: 'ADD_FOUND_REPORT'; input: FoundReportInput; reportId: string; createdAt: string }
  | { type: 'CLOSE_LOST_CASE'; petId: string; reunited: boolean; closedAt: string; event: LifeEvent; badgeId: string }
  | { type: 'TOGGLE_INTEREST'; serviceId: string; enabled: boolean; updatedAt: string }
  /** 写入真实链上身份注册证据（仅在链上交易回执成功后由 Store 提交）。 */
  | { type: 'ANCHOR_PET_IDENTITY'; petId: string; identity: PetChainIdentity }
  /** 写入真实链上生命档案锚定证据（仅在链上交易回执成功后由 Store 提交）。 */
  | { type: 'ANCHOR_LIFE_RECORD'; anchor: LifeRecordAnchor };

/** 模拟异步业务操作；失败由调用方在 callback 中根据 failNext 做原子消费。 */
export async function simulateOperation<T>(label: string, callback: () => T, delayMs = 160): Promise<T> {
  await new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
  try {
    return callback();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${label}失败：${error.message}`);
    }
    throw new Error(`${label}失败`);
  }
}

/** 统一生成演示实体 ID；优先使用浏览器 UUID，测试环境使用时间随机串。 */
export function createEntityId(prefix: string): string {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uuid}`;
}

/** 获得当前状态中某宠物的余额，余额始终由积分明细派生。 */
function balanceOf(state: DemoState, petId: string): number {
  return state.pointEntries
    .filter((entry) => entry.petId === petId)
    .reduce((total, entry) => total + entry.amount, 0);
}

/** 判断某奖励任务是否已经发放，所有奖励均通过宠物与任务键唯一去重。 */
function hasReward(state: DemoState, petId: string, taskKey: string): boolean {
  return state.pointEntries.some((entry) => entry.petId === petId && entry.taskKey === taskKey);
}

/** 添加一条奖励积分，同时写入扣除后的正确余额快照。 */
function addReward(state: DemoState, petId: string, amount: number, taskKey: string, title: string, createdAt: string, id: string): DemoState {
  if (hasReward(state, petId, taskKey)) return state;
  const balanceAfter = balanceOf(state, petId) + amount;
  return {
    ...state,
    pointEntries: [...state.pointEntries, { id, petId, amount, balanceAfter, kind: 'reward', taskKey, title, createdAt }],
  };
}

/** 生成创建宠物时的系统出生/创建事件。 */
function makeCreationEvent(pet: Pet, createdAt: string): LifeEvent {
  return {
    id: createEntityId('event'), petId: pet.id, type: 'family', title: `${pet.name} 的 PawID 创建`,
    date: createdAt.slice(0, 10), description: '身份创建成功（演示系统事件）。', photoKeys: [], visibility: 'family',
    source: 'system', createdAt, updatedAt: createdAt,
  };
}

/** 把待处理或已处理的操作动作应用为一个不可分割的新状态。 */
export function applyOperation(state: DemoState, operation: OperationAction): DemoState {
  switch (operation.type) {
    case 'CREATE_PET': {
      if (state.pets.some((pet) => pet.id === operation.petId) || state.processedOperationKeys.includes(operation.operationKey)) return state;
      const now = operation.createdAt;
      const input = operation.input;
      const pet: Pet = {
        id: operation.petId,
        name: input.name,
        species: input.species,
        breed: input.breed ?? '',
        gender: input.gender ?? 'unknown',
        birthDate: input.birthDate ?? null,
        coatColor: input.coatColor ?? '待补充',
        introduction: input.introduction ?? '',
        photoKey: input.photoKey ?? null,
        avatarStyle: input.avatarStyle ?? '3d',
        avatarAssetPath: input.avatarAssetPath ?? '/src/assets/avatars/preset-cat.svg',
        avatarPresetLabel: '预置形象演示',
        publicProfile: { appearance: input.coatColor ?? '待补充', isLostVisible: true },
        identityAccount: {
          network: 'Monad（模拟网络）',
          address: `0x${operation.petId.replace(/[^a-z0-9]/gi, '').slice(-12).toUpperCase()}`,
          createdAt: now,
          transactionId: `tx-${operation.petId}-demo`,
        },
        createdAt: now,
        updatedAt: now,
      };
      const event = makeCreationEvent(pet, now);
      const ownerLink = {
        id: createEntityId('guardian'), petId: pet.id, userId: 'user-xiaolin', role: 'owner' as const,
        status: 'accepted' as const, joinedAt: now,
      };
      const nextBalance = balanceOf(state, pet.id) + 100;
      return {
        ...state,
        pets: [...state.pets, pet],
        guardianLinks: [...state.guardianLinks, ownerLink],
        lifeEvents: [...state.lifeEvents, event],
        pointEntries: [...state.pointEntries, {
          id: createEntityId('points'), petId: pet.id, amount: 100, balanceAfter: nextBalance,
          kind: 'reward' as const, taskKey: `create:${pet.id}`, title: '创建 PawID 身份', createdAt: now,
        }],
        processedOperationKeys: [...state.processedOperationKeys, operation.operationKey],
        createDraft: null,
      };
    }
    case 'UPDATE_PET': {
      const existing = state.pets.find((pet) => pet.id === operation.petId);
      if (!existing) return state;
      const input = operation.input;
      return {
        ...state,
        pets: state.pets.map((pet) => pet.id === operation.petId ? {
          ...pet,
          ...input,
          publicProfile: { ...pet.publicProfile, appearance: input.coatColor ?? pet.publicProfile.appearance },
          updatedAt: operation.updatedAt,
        } : pet),
      };
    }
    case 'CREATE_INVITE': {
      if (!state.pets.some((pet) => pet.id === operation.input.petId)) return state;
      const duplicate = state.invites.some((invite) => invite.petId === operation.input.petId
        && invite.inviteeNickname === operation.input.inviteeNickname && invite.status === 'pending');
      if (duplicate) return state;
      return {
        ...state,
        invites: [...state.invites, {
          id: operation.inviteId, petId: operation.input.petId, inviterId: operation.inviterId,
          inviteeNickname: operation.input.inviteeNickname, relation: 'co_guardian', token: operation.inviteId,
          status: 'pending', createdAt: operation.createdAt, acceptedAt: null,
        }],
      };
    }
    case 'DECIDE_INVITE': {
      const invite = state.invites.find((item) => item.id === operation.inviteId);
      if (!invite || invite.status !== 'pending') return state;
      const nextInvites = state.invites.map((item) => item.id === invite.id ? {
        ...item, status: operation.status, acceptedAt: operation.status === 'accepted' ? operation.decidedAt : null,
      } : item);
      if (operation.status === 'rejected') return { ...state, invites: nextInvites };
      const existingUser = state.users.find((user) => user.nickname === invite.inviteeNickname);
      const userId = existingUser?.id ?? createEntityId('user');
      const nextUsers = existingUser ? state.users : [...state.users, { id: userId, nickname: invite.inviteeNickname, kind: 'demo' as const, createdAt: operation.decidedAt }];
      const alreadyMember = state.guardianLinks.some((link) => link.petId === invite.petId && link.userId === userId && link.status === 'accepted');
      const nextLinks = alreadyMember ? state.guardianLinks : [...state.guardianLinks, {
        id: createEntityId('guardian'), petId: invite.petId, userId, role: 'co_guardian' as const, status: 'accepted' as const, joinedAt: operation.decidedAt,
      }];
      const withInvite = { ...state, invites: nextInvites, users: nextUsers, guardianLinks: nextLinks };
      return addReward(withInvite, invite.petId, 50, `co-guardian:${invite.petId}`, '首次共同监护', operation.decidedAt, createEntityId('points'));
    }
    case 'CREATE_PARENT_RELATION': {
      const { childPetId, parentPetId, role } = operation.input;
      const duplicate = state.relations.some((relation) => relation.childPetId === childPetId
        && relation.parentPetId === parentPetId && relation.role === role);
      const occupied = state.relations.some((relation) => relation.childPetId === childPetId
        && relation.role === role && relation.status !== 'rejected');
      if (duplicate || occupied || childPetId === parentPetId) return state;
      return {
        ...state,
        relations: [...state.relations, {
          id: operation.relationId, childPetId, parentPetId, role, proposedBy: operation.proposedBy,
          status: 'pending', createdAt: operation.createdAt, decidedAt: null,
        }],
      };
    }
    case 'DECIDE_RELATION': {
      const relation = state.relations.find((item) => item.id === operation.relationId);
      if (!relation || relation.status !== 'pending') return state;
      const relations = state.relations.map((item) => item.id === relation.id ? { ...item, status: operation.status, decidedAt: operation.decidedAt } : item);
      if (operation.status === 'rejected') return { ...state, relations };
      const withRelation = { ...state, relations };
      return addReward(withRelation, relation.childPetId, 50, `parent:${relation.childPetId}`, '首次确认父母关系', operation.decidedAt, createEntityId('points'));
    }
    case 'ADD_LIFE_EVENT': {
      if (state.lifeEvents.some((event) => event.id === operation.event.id)) return state;
      const withEvent = { ...state, lifeEvents: [...state.lifeEvents, operation.event] };
      return addReward(withEvent, operation.input.petId, 20, `manual-event:${operation.input.petId}`, '首次手动成长记录', operation.rewardCreatedAt, operation.rewardEntryId);
    }
    case 'UPDATE_LIFE_EVENT': {
      const existing = state.lifeEvents.find((event) => event.id === operation.eventId && event.source === 'manual');
      if (!existing) return state;
      return {
        ...state,
        lifeEvents: state.lifeEvents.map((event) => event.id === operation.eventId ? {
          ...event,
          type: operation.input.type,
          title: operation.input.title,
          date: operation.input.date,
          description: operation.input.description ?? '',
          photoKeys: operation.input.photoKeys ?? [],
          visibility: operation.input.visibility ?? 'family',
          updatedAt: operation.updatedAt,
        } : event),
      };
    }
    case 'DELETE_LIFE_EVENT': {
      const existing = state.lifeEvents.find((event) => event.id === operation.eventId && event.source === 'manual');
      if (!existing) return state;
      return { ...state, lifeEvents: state.lifeEvents.filter((event) => event.id !== operation.eventId) };
    }
    case 'REDEEM_ITEM': {
      const catalog = fixedItemCatalog().find((item) => item.code === operation.code);
      if (!catalog || state.inventoryItems.some((item) => item.petId === operation.petId && item.code === operation.code)) return state;
      const balance = balanceOf(state, operation.petId);
      if (balance < catalog.price) return state;
      return {
        ...state,
        inventoryItems: [...state.inventoryItems, {
          ...catalog, id: operation.itemId, petId: operation.petId, owned: true, equipped: false, purchasedAt: operation.createdAt,
        }],
        pointEntries: [...state.pointEntries, {
          id: operation.pointEntryId, petId: operation.petId, amount: -catalog.price,
          balanceAfter: balance - catalog.price, kind: 'redeem', taskKey: `redeem:${operation.petId}:${operation.code}`,
          title: `兑换${catalog.name}`, createdAt: operation.createdAt, transactionId: operation.transactionId,
        }],
      };
    }
    case 'PURCHASE_POINTS': {
      // 幂等：相同操作键只入账一次，重复提交返回原状态。
      if (state.processedOperationKeys.includes(operation.operationKey)) return state;
      // 积分包必须在固定目录内，且目标宠物必须存在。
      const pack = fixedPointPackCatalog().find((candidate) => candidate.code === operation.packCode);
      if (!pack || !state.pets.some((pet) => pet.id === operation.petId)) return state;
      const balanceAfter = balanceOf(state, operation.petId) + pack.amount;
      return {
        ...state,
        pointEntries: [...state.pointEntries, {
          id: operation.entryId, petId: operation.petId, amount: pack.amount, balanceAfter,
          kind: 'purchase' as const, taskKey: null, title: `领取积分包（${pack.amount} PAWS）`,
          transactionId: operation.transactionId, createdAt: operation.createdAt,
        }],
        processedOperationKeys: [...state.processedOperationKeys, operation.operationKey],
      };
    }
    case 'EQUIP_ITEM': {
      if (!state.inventoryItems.some((item) => item.id === operation.itemId && item.petId === operation.petId && item.owned)) return state;
      return {
        ...state,
        inventoryItems: state.inventoryItems.map((item) => item.petId === operation.petId
          ? { ...item, equipped: item.id === operation.itemId ? operation.equipped : false }
          : item),
      };
    }
    case 'OPEN_LOST_CASE': {
      const active = state.lostCases.some((item) => item.petId === operation.input.petId && (item.status === 'searching' || item.status === 'reported'));
      if (active) return state;
      return {
        ...state,
        lostCases: [...state.lostCases, {
          id: operation.caseId, petId: operation.input.petId, lastLocation: operation.input.lastLocation,
          lostAt: operation.input.lostAt, description: operation.input.description ?? '', status: 'searching',
          createdAt: operation.createdAt, closedAt: null,
        }],
      };
    }
    case 'ADD_FOUND_REPORT': {
      const active = [...state.lostCases].reverse().find((item) => item.petId === operation.input.petId && (item.status === 'searching' || item.status === 'reported'));
      return {
        ...state,
        foundReports: [...state.foundReports, {
          id: operation.reportId, lostCaseId: active?.id ?? null, petId: operation.input.petId,
          location: operation.input.location, message: operation.input.message ?? '', contact: operation.input.contact ?? '', createdAt: operation.createdAt,
        }],
        lostCases: active ? state.lostCases.map((item) => item.id === active.id ? { ...item, status: 'reported' as const } : item) : state.lostCases,
      };
    }
    case 'CLOSE_LOST_CASE': {
      const active = [...state.lostCases].reverse().find((item) => item.petId === operation.petId && (item.status === 'searching' || item.status === 'reported'));
      if (!active) return state;
      const nextStatus = operation.reunited ? 'reunited' : 'closed';
      const nextState: DemoState = {
        ...state,
        lostCases: state.lostCases.map((item) => item.id === active.id ? { ...item, status: nextStatus, closedAt: operation.closedAt } : item),
      };
      if (!operation.reunited) return nextState;
      const withEvent = nextState.lifeEvents.some((event) => event.petId === operation.petId && event.title === '确认接回')
        ? nextState
        : { ...nextState, lifeEvents: [...nextState.lifeEvents, operation.event] };
      if (withEvent.badges.some((badge) => badge.petId === operation.petId && badge.code === 'home_again')) return withEvent;
      return {
        ...withEvent,
        badges: [...withEvent.badges, {
          id: operation.badgeId, petId: operation.petId, code: 'home_again', name: 'Home Again',
          reason: '确认宠物平安接回（演示）', earnedAt: operation.closedAt,
        }],
      };
    }
    case 'TOGGLE_INTEREST': {
      const current = state.serviceInterests.find((interest) => interest.serviceId === operation.serviceId);
      const next = { serviceId: operation.serviceId, interested: operation.enabled, updatedAt: operation.updatedAt };
      return current
        ? { ...state, serviceInterests: state.serviceInterests.map((interest) => interest.serviceId === operation.serviceId ? next : interest) }
        : { ...state, serviceInterests: [...state.serviceInterests, next] };
    }
    case 'ANCHOR_PET_IDENTITY': {
      // 宠物必须存在；同一 petKey 只保留首条真实证据，重复提交幂等返回原状态。
      if (!state.pets.some((pet) => pet.id === operation.petId)) return state;
      if (state.onChainIdentities.some((identity) => identity.petKey === operation.identity.petKey)) return state;
      return { ...state, onChainIdentities: [...state.onChainIdentities, operation.identity] };
    }
    case 'ANCHOR_LIFE_RECORD': {
      // 同一事件与交易哈希只保留一条锚定证据，保证回执后的写入天然幂等。
      if (state.lifeRecordAnchors.some((anchor) => anchor.eventId === operation.anchor.eventId && anchor.txHash === operation.anchor.txHash)) return state;
      return { ...state, lifeRecordAnchors: [...state.lifeRecordAnchors, operation.anchor] };
    }
  }
}

/** 固定装扮目录，业务页可直接复用名称、价格和占位资源。 */
export function fixedItemCatalog(): ReadonlyArray<Omit<DemoState['inventoryItems'][number], 'id' | 'petId' | 'owned' | 'equipped' | 'purchasedAt'>> {
  return [
    { code: 'bow', name: '蝴蝶结', price: 60, assetPath: '/src/assets/items/bow.svg' },
    { code: 'birthday_hat', name: '生日帽', price: 120, assetPath: '/src/assets/items/birthday-hat.svg' },
    { code: 'starry_cape', name: '星空披风', price: 200, assetPath: '/src/assets/items/starry-cape.svg' },
  ];
}

/** 固定积分包目录：只提供三档数量，页面不允许自定义金额，也不接入任何真实支付。 */
export function fixedPointPackCatalog(): ReadonlyArray<{ code: PointPackCode; name: string; amount: number }> {
  return [
    { code: 'pack_100', name: '尝鲜包', amount: 100 },
    { code: 'pack_300', name: '进阶包', amount: 300 },
    { code: 'pack_600', name: '囤粮包', amount: 600 },
  ];
}

/** 纯 reducer 是唯一业务状态写入入口，所有操作均返回不可变新对象。 */
export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'RUN_OPERATION':
      return applyOperation(state, action.operation);
    case 'SET_ROLE':
      return { ...state, currentRole: action.role };
    case 'SET_FAIL_NEXT':
      return { ...state, failNext: action.value };
    case 'CONSUME_FAIL_NEXT':
      return { ...state, failNext: false };
    case 'SAVE_CREATE_DRAFT':
      return { ...state, createDraft: action.draft };
    case 'CLEAR_CREATE_DRAFT':
      return { ...state, createDraft: null };
    case 'HYDRATE':
      return action.state;
    case 'RESET':
      return action.state;
  }
}

/** 从传入状态生成通用操作键，允许页面在重复点击时复用同一请求令牌。 */
export function operationKey(prefix: string, value: string): string {
  return `${prefix}:${value}`;
}

/** 仅校验当前操作会导致的可见业务错误，不修改任何状态。 */
export function validateOperation(state: DemoState, operation: OperationAction): string | null {
  switch (operation.type) {
    case 'REDEEM_ITEM': {
      const item = fixedItemCatalog().find((candidate) => candidate.code === operation.code);
      if (!item) return '该装扮不存在';
      if (state.inventoryItems.some((candidate) => candidate.petId === operation.petId && candidate.code === operation.code)) return '该装扮已在衣橱中';
      if (balanceOf(state, operation.petId) < item.price) return `余额不足，还差 ${item.price - balanceOf(state, operation.petId)} PAWS`;
      return null;
    }
    case 'PURCHASE_POINTS': {
      // 积分包只允许固定目录内的编码，编码不合法时提前给出可读错误。
      if (!fixedPointPackCatalog().some((candidate) => candidate.code === operation.packCode)) return '积分包不存在';
      return null;
    }
    case 'CREATE_INVITE': {
      const nickname = operation.input.inviteeNickname.trim();
      if (!nickname) return '请输入受邀者昵称';
      if (state.guardianLinks.some((link) => link.petId === operation.input.petId && link.status === 'accepted' && state.users.find((user) => user.id === link.userId)?.nickname === nickname)) return '该用户已经是家庭成员';
      return null;
    }
    default:
      return null;
  }
}

/** 为测试和非 React 页面提供不依赖 Provider 的余额计算。 */
export function getDerivedBalance(state: DemoState, petId: string): number {
  return balanceOf(state, petId);
}

/** 当前实现依赖的状态扩展字段类型保护，供旧 JSON 加载时做兼容。 */
export function ensureStateShape(state: DemoState): DemoState {
  return {
    ...cloneSeedState(),
    ...state,
    processedOperationKeys: state.processedOperationKeys ?? [],
    // 旧版本持久化数据没有链上证据字段，加载时补齐空数组，避免运行期 undefined。
    onChainIdentities: state.onChainIdentities ?? [],
    lifeRecordAnchors: state.lifeRecordAnchors ?? [],
  };
}
