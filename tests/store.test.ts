import { describe, expect, it } from 'vitest';
import { cloneSeedState } from '../src/domain/seed';
import type { LifeEventInput } from '../src/domain/types';
import { applyOperation, getDerivedBalance } from '../src/store/actions';
import type { OperationAction } from '../src/store/actions';
import { getPetBadges, getPointsCirculation, getSiblings } from '../src/store/selectors';

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
    const redeem = operation<OperationAction>({ type: 'REDEEM_ITEM', petId: 'mochi', code: 'bow', itemId: 'item-bow', createdAt: now, pointEntryId: 'points-bow', transactionId: 'ptx-test-bow' });
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

describe('PawID DemoStore 积分流通规则', () => {
  it('领取积分包增加余额并写入带交易编号的流水', () => {
    const state = cloneSeedState();
    const after = applyOperation(state, operation<OperationAction>({
      type: 'PURCHASE_POINTS', petId: 'mochi', packCode: 'pack_300', entryId: 'points-pack-1', createdAt: now, operationKey: 'purchase-test-1', transactionId: 'ptx-pack-1',
    }));
    expect(getDerivedBalance(after, 'mochi')).toBe(getDerivedBalance(state, 'mochi') + 300);
    const entries = after.pointEntries.filter((entry) => entry.petId === 'mochi' && entry.kind === 'purchase');
    expect(entries).toHaveLength(1);
    expect(entries[0].amount).toBe(300);
    expect(entries[0].transactionId).toBe('ptx-pack-1');
    expect(entries[0].balanceAfter).toBe(getDerivedBalance(after, 'mochi'));
  });

  it('相同 requestId 的重复领取只入账一次', () => {
    const state = cloneSeedState();
    const purchase = operation<OperationAction>({
      type: 'PURCHASE_POINTS', petId: 'mochi', packCode: 'pack_100', entryId: 'points-pack-2', createdAt: now, operationKey: 'purchase:mochi:pack_100:req-1', transactionId: 'ptx-pack-2',
    });
    const once = applyOperation(state, purchase);
    const twice = applyOperation(once, purchase);
    expect(getDerivedBalance(twice, 'mochi')).toBe(getDerivedBalance(state, 'mochi') + 100);
    expect(twice.pointEntries.filter((entry) => entry.kind === 'purchase')).toHaveLength(1);
  });

  it('积分流通统计由流水准确派生', () => {
    const state = cloneSeedState();
    const purchased = applyOperation(state, operation<OperationAction>({
      type: 'PURCHASE_POINTS', petId: 'mochi', packCode: 'pack_600', entryId: 'points-pack-3', createdAt: now, operationKey: 'purchase-test-3', transactionId: 'ptx-pack-3',
    }));
    const redeemed = applyOperation(purchased, operation<OperationAction>({ type: 'REDEEM_ITEM', petId: 'mochi', code: 'bow', itemId: 'item-bow', createdAt: now, pointEntryId: 'points-bow-3', transactionId: 'ptx-bow-3' }));
    const before = getPointsCirculation(state, 'mochi');
    const after = getPointsCirculation(redeemed, 'mochi');
    expect(after.balance).toBe(getDerivedBalance(redeemed, 'mochi'));
    expect(after.totalEarned).toBe(before.totalEarned + 600);
    expect(after.totalSpent).toBe(before.totalSpent + 60);
    expect(after.transactionCount).toBe(before.transactionCount + 2);
    expect(after.balance).toBe(after.totalEarned - after.totalSpent);
  });
});
