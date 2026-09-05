import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import type { PropsWithChildren } from 'react';
import type {
  CreateDraft,
  CreateInviteInput,
  CreateParentRelationInput,
  CreatePetInput,
  DemoRole,
  DemoState,
  FoundReportInput,
  InventoryItemCode,
  LifeEventInput,
  LostCaseInput,
  UpdatePetInput,
} from '../domain/types';
import { cloneSeedState } from '../domain/seed';
import {
  applyOperation,
  createEntityId,
  demoReducer,
  getDerivedBalance,
  type OperationAction,
  simulateOperation,
} from './actions';
import { clearImageStore, clearStoredDemoState, loadDemoState, saveDemoState } from './storage';
import * as selectors from './selectors';

/** 统一状态与异步 action 的 Store 上下文。 */
export interface DemoStoreValue {
  state: DemoState;
  actions: DemoActions;
  selectors: typeof selectors;
}

/** 所有业务页面稳定调用的异步 action 集合。 */
export interface DemoActions {
  createPet(input: CreatePetInput): Promise<void>;
  updatePet(petId: string, input: UpdatePetInput): Promise<void>;
  createInvite(input: CreateInviteInput): Promise<void>;
  decideInvite(inviteId: string, status: 'accepted' | 'rejected'): Promise<void>;
  createParentRelation(input: CreateParentRelationInput): Promise<void>;
  decideRelation(relationId: string, status: 'accepted' | 'rejected'): Promise<void>;
  addLifeEvent(input: LifeEventInput): Promise<void>;
  updateLifeEvent(eventId: string, input: LifeEventInput): Promise<void>;
  deleteLifeEvent(eventId: string): Promise<void>;
  redeemItem(petId: string, code: InventoryItemCode): Promise<void>;
  equipItem(petId: string, itemId: string, equipped?: boolean): Promise<void>;
  openLostCase(input: LostCaseInput): Promise<void>;
  addFoundReport(input: FoundReportInput): Promise<void>;
  closeLostCase(petId: string, reunited?: boolean): Promise<void>;
  toggleInterest(serviceId: string): Promise<void>;
  setRole(role: DemoRole): void;
  setFailNext(value: boolean): void;
  consumeFailNext(): void;
  saveCreateDraft(draft: CreateDraft): void;
  clearCreateDraft(): void;
  resetDemo(): Promise<void>;
}

const DemoStoreContext = createContext<DemoStoreValue | null>(null);

/** Provider 只负责持久化、失败注入和 dispatch 编排，不承载具体业务页面。 */
export function DemoProvider({ children }: PropsWithChildren): JSX.Element {
  const [state, dispatch] = useReducer(demoReducer, undefined, loadDemoState);

  useEffect(() => {
    saveDemoState(state);
  }, [state]);

  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== 'pawid_demo_v1' || !event.newValue) return;
      dispatch({ type: 'HYDRATE', state: loadDemoState() });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /** 统一执行模拟异步操作；failNext 在写入前清零，失败绝不提交业务动作。 */
  const run = useCallback(async (label: string, operationFactory: () => OperationAction): Promise<void> => {
    await simulateOperation(label, () => {
      if (state.failNext) {
        dispatch({ type: 'CONSUME_FAIL_NEXT' });
        throw new Error('已按演示控制注入失败，请保留表单后重试');
      }
      dispatch({ type: 'RUN_OPERATION', operation: operationFactory() });
    });
  }, [state.failNext]);

  const actions = useMemo<DemoActions>(() => ({
    createPet: (input) => run('创建身份', () => ({
      type: 'CREATE_PET', input, petId: createEntityId('pet'), createdAt: new Date().toISOString(),
      operationKey: input.requestId ?? createEntityId('create'),
    })),
    updatePet: (petId, input) => run('更新资料', () => ({ type: 'UPDATE_PET', petId, input, updatedAt: new Date().toISOString() })),
    createInvite: (input) => run('生成邀请', () => ({
      type: 'CREATE_INVITE', input, inviteId: createEntityId('invite'), inviterId: state.currentRole === 'invitee' ? 'user-aning' : 'user-xiaolin', createdAt: new Date().toISOString(),
    })),
    decideInvite: (inviteId, status) => run('处理邀请', () => ({ type: 'DECIDE_INVITE', inviteId, status, decidedAt: new Date().toISOString() })),
    createParentRelation: (input) => run('提交亲缘申请', () => ({
      type: 'CREATE_PARENT_RELATION', input, relationId: createEntityId('relation'), proposedBy: state.currentRole === 'invitee' ? 'user-aning' : 'user-xiaolin', createdAt: new Date().toISOString(),
    })),
    decideRelation: (relationId, status) => run('处理亲缘申请', () => ({ type: 'DECIDE_RELATION', relationId, status, decidedAt: new Date().toISOString() })),
    addLifeEvent: (input) => run('新增生命记录', () => {
      const createdAt = new Date().toISOString();
      return {
        type: 'ADD_LIFE_EVENT', input,
        event: {
          id: createEntityId('event'), petId: input.petId, type: input.type, title: input.title, date: input.date,
          description: input.description ?? '', photoKeys: input.photoKeys ?? [], visibility: input.visibility ?? 'family', source: 'manual', createdAt, updatedAt: createdAt,
        },
        rewardEntryId: createEntityId('points'), rewardCreatedAt: createdAt,
      };
    }),
    updateLifeEvent: (eventId, input) => run('编辑生命记录', () => ({ type: 'UPDATE_LIFE_EVENT', eventId, input, updatedAt: new Date().toISOString() })),
    deleteLifeEvent: (eventId) => run('删除生命记录', () => ({ type: 'DELETE_LIFE_EVENT', eventId })),
    redeemItem: (petId, code) => run('兑换装扮', () => ({
      type: 'REDEEM_ITEM', petId, code, itemId: createEntityId('item'), createdAt: new Date().toISOString(), pointEntryId: createEntityId('points'),
    })),
    equipItem: (petId, itemId, equipped = true) => run('更新穿戴', () => ({ type: 'EQUIP_ITEM', petId, itemId, equipped })),
    openLostCase: (input) => run('标记走失', () => ({ type: 'OPEN_LOST_CASE', input, caseId: createEntityId('lost'), createdAt: new Date().toISOString() })),
    addFoundReport: (input) => run('提交线索', () => ({ type: 'ADD_FOUND_REPORT', input, reportId: createEntityId('report'), createdAt: new Date().toISOString() })),
    closeLostCase: (petId, reunited = true) => run(reunited ? '确认接回' : '结束寻宠', () => {
      const closedAt = new Date().toISOString();
      return {
        type: 'CLOSE_LOST_CASE', petId, reunited, closedAt, badgeId: createEntityId('badge'),
        event: {
          id: createEntityId('event'), petId, type: 'family', title: '确认接回', date: closedAt.slice(0, 10),
          description: '宠物已平安回到家中（演示系统事件）。', photoKeys: [], visibility: 'family', source: 'system', createdAt: closedAt, updatedAt: closedAt,
        },
      };
    }),
    toggleInterest: (serviceId) => run('记录服务意向', () => ({
      type: 'TOGGLE_INTEREST', serviceId, enabled: !state.serviceInterests.some((interest) => interest.serviceId === serviceId && interest.interested), updatedAt: new Date().toISOString(),
    } as OperationAction)),
    setRole: (role) => dispatch({ type: 'SET_ROLE', role }),
    setFailNext: (value) => dispatch({ type: 'SET_FAIL_NEXT', value }),
    consumeFailNext: () => dispatch({ type: 'CONSUME_FAIL_NEXT' }),
    saveCreateDraft: (draft) => dispatch({ type: 'SAVE_CREATE_DRAFT', draft }),
    clearCreateDraft: () => dispatch({ type: 'CLEAR_CREATE_DRAFT' }),
    resetDemo: async () => {
      await simulateOperation('重置演示', async () => {
        clearStoredDemoState();
        await clearImageStore();
        dispatch({ type: 'RESET', state: cloneSeedState() });
      });
    },
  }), [run, state.currentRole, state.serviceInterests]);

  const value = useMemo<DemoStoreValue>(() => ({ state, actions, selectors }), [state, actions]);
  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>;
}

/** 读取唯一业务 Store；脱离 Provider 使用时立即给出清晰错误。 */
export function useDemoStore(): DemoStoreValue {
  const context = useContext(DemoStoreContext);
  if (!context) throw new Error('useDemoStore 必须在 DemoProvider 内使用');
  return context;
}

/** 让测试和简单脚本可直接把动作应用为新状态。 */
export function reduceDemoState(state: DemoState, operation: OperationAction): DemoState {
  return applyOperation(state, operation);
}

/** 导出余额辅助，业务页面不需要复制积分求和逻辑。 */
export { getDerivedBalance };
