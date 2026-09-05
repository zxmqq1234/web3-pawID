import { describe, expect, it } from 'vitest';
import { cloneSeedState } from '../src/domain/seed';
import type { LifeEventInput } from '../src/domain/types';
import { applyOperation, getDerivedBalance } from '../src/store/actions';
import type { OperationAction } from '../src/store/actions';
import { getPetBadges, getSiblings } from '../src/store/selectors';

/** 用固定输入构造操作，测试 reducer 的原子业务结果。 */
function operation<T extends OperationAction>(value: T): T {
  return value;
}

/** 测试用时间与实体标识，避免断言依赖真实时钟。 */
const now = '2026-09-05T10:00:00.000Z';

describe('PawID DemoStore 奖励与去重规则', () => {
  it('创建宠物奖励只能一次', () => {
    const state = cloneSeedState();
    const action = operation<OperationAction>({
      type: 'CREATE_PET',
      input: { requestId: 'create-once', name: 'Testy', species: 'cat' },
      petId: 'pet-testy',
      createdAt: now,
      operationKey: 'create-once',
    });
    const once = applyOperation(state, action);
    const twice = applyOperation(once, action);
    expect(once.pets).toHaveLength(state.pets.length + 1);
    expect(getDerivedBalance(once, 'pet-testy')).toBe(100);
    expect(twice.pets).toHaveLength(once.pets.length);
    expect(twice.pointEntries.filter((entry) => entry.petId === 'pet-testy')).toHaveLength(1);
  });

  it('重复接受邀请不重复加成员或积分', () => {
    const state = cloneSeedState();
    const invited = applyOperation(state, operation<OperationAction>({
      type: 'CREATE_INVITE', input: { petId: 'mochi', inviteeNickname: '阿宁' }, inviteId: 'invite-test', inviterId: 'user-xiaolin', createdAt: now,
    }));
    const accepted = applyOperation(invited, operation<OperationAction>({ type: 'DECIDE_INVITE', inviteId: 'invite-test', status: 'accepted', decidedAt: now }));
    const repeated = applyOperation(accepted, operation<OperationAction>({ type: 'DECIDE_INVITE', inviteId: 'invite-test', status: 'accepted', decidedAt: now }));
    expect(accepted.guardianLinks.filter((link) => link.petId === 'mochi')).toHaveLength(2);
    expect(repeated.guardianLinks.filter((link) => link.petId === 'mochi')).toHaveLength(2);
    expect(getDerivedBalance(repeated, 'mochi')).toBe(getDerivedBalance(state, 'mochi') + 50);
  });

  it('首次手动记录奖励只一次且删除不重置资格', () => {
    const state = cloneSeedState();
    const input: LifeEventInput = { petId: 'mochi', type: 'daily', title: '测试记录', date: '2026-09-05' };
    const add = operation<OperationAction>({
      type: 'ADD_LIFE_EVENT', input, event: { id: 'event-test', ...input, description: '', photoKeys: [], visibility: 'family', source: 'manual', createdAt: now, updatedAt: now }, rewardEntryId: 'points-test', rewardCreatedAt: now,
    });
    const afterAdd = applyOperation(state, add);
    const afterDelete = applyOperation(afterAdd, operation<OperationAction>({ type: 'DELETE_LIFE_EVENT', eventId: 'event-test' }));
    const afterSecondAdd = applyOperation(afterDelete, operation<OperationAction>({
      type: 'ADD_LIFE_EVENT',
      input,
      event: { id: 'event-test-2', ...input, description: '', photoKeys: [], visibility: 'family', source: 'manual', createdAt: now, updatedAt: now },
      rewardEntryId: 'points-test-2',
      rewardCreatedAt: now,
    }));
    expect(afterDelete.lifeEvents.some((event) => event.id === 'event-test')).toBe(false);
    expect(getDerivedBalance(afterSecondAdd, 'mochi')).toBe(getDerivedBalance(state, 'mochi') + 20);
    expect(afterSecondAdd.pointEntries.filter((entry) => entry.taskKey === 'manual-event:mochi')).toHaveLength(1);
  });

  it('重复兑换不扣分', () => {
    const state = cloneSeedState();
    const redeem = operation<OperationAction>({ type: 'REDEEM_ITEM', petId: 'mochi', code: 'bow', itemId: 'item-bow', createdAt: now, pointEntryId: 'points-bow' });
    const once = applyOperation(state, redeem);
    const twice = applyOperation(once, redeem);
    expect(once.inventoryItems.filter((item) => item.petId === 'mochi')).toHaveLength(1);
    expect(twice.inventoryItems.filter((item) => item.petId === 'mochi')).toHaveLength(1);
    expect(getDerivedBalance(twice, 'mochi')).toBe(getDerivedBalance(state, 'mochi') - 60);
  });

  it('结束寻宠不增加徽章，确认接回只首次增加 Home Again', () => {
    const state = cloneSeedState();
    const opened = applyOperation(state, operation<OperationAction>({ type: 'OPEN_LOST_CASE', input: { petId: 'mochi', lastLocation: '公园', lostAt: now }, caseId: 'lost-test', createdAt: now }));
    const closed = applyOperation(opened, operation<OperationAction>({ type: 'CLOSE_LOST_CASE', petId: 'mochi', reunited: false, closedAt: now, badgeId: 'badge-unused', event: { id: 'event-unused', petId: 'mochi', type: 'family', title: '确认接回', date: now.slice(0, 10), description: '', photoKeys: [], visibility: 'family', source: 'system', createdAt: now, updatedAt: now } }));
    expect(getPetBadges(closed, 'mochi').some((badge) => badge.code === 'home_again')).toBe(false);
    const reopened = applyOperation(closed, operation<OperationAction>({ type: 'OPEN_LOST_CASE', input: { petId: 'mochi', lastLocation: '街角', lostAt: now }, caseId: 'lost-test-2', createdAt: now }));
    const reunited = applyOperation(reopened, operation<OperationAction>({ type: 'CLOSE_LOST_CASE', petId: 'mochi', reunited: true, closedAt: now, badgeId: 'badge-home', event: { id: 'event-home', petId: 'mochi', type: 'family', title: '确认接回', date: now.slice(0, 10), description: '', photoKeys: [], visibility: 'family', source: 'system', createdAt: now, updatedAt: now } }));
    const repeated = applyOperation(reunited, operation<OperationAction>({ type: 'CLOSE_LOST_CASE', petId: 'mochi', reunited: true, closedAt: now, badgeId: 'badge-home-2', event: { id: 'event-home-2', petId: 'mochi', type: 'family', title: '确认接回', date: now.slice(0, 10), description: '', photoKeys: [], visibility: 'family', source: 'system', createdAt: now, updatedAt: now } }));
    expect(getPetBadges(reunited, 'mochi').filter((badge) => badge.code === 'home_again')).toHaveLength(1);
    expect(getPetBadges(repeated, 'mochi').filter((badge) => badge.code === 'home_again')).toHaveLength(1);
  });

  it('Luna 从共同确认父母关系派生为 Mochi 的姐妹', () => {
    const state = cloneSeedState();
    expect(getSiblings(state, 'mochi').map((pet) => pet.id)).toContain('luna');
  });
});
