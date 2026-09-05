// Web3 底层内核测试：哈希稳定性、gas 缓冲、错误分类、registry 交易流程（mock 客户端注入）
// 以及 Store 对真实链上证据的幂等写入与旧数据兼容。
// 说明：不发起真实网络请求；registry 交易路径通过注入受控 mock 客户端验证完整流程。
// 编码 UTF-8。

import { describe, expect, it } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import {
  anchorRecordWithClients,
  buildPetKey,
  GAS_BUFFER_PERCENT,
  hashProfile,
  hashRecord,
  RECORD_TYPE_CODES,
  registerPetWithClients,
  withGasBuffer,
  type Bytes32,
  type RegistryClients,
} from '../src/web3/registry';
import { Web3Error, toWeb3Error } from '../src/web3/errors';
import { getRegistryAddress, MONAD_CHAIN_ID, MONAD_RPC_URL } from '../src/config/monad';
import { cloneSeedState } from '../src/domain/seed';
import type { LifeRecordAnchor, PetChainIdentity } from '../src/domain/types';
import { applyOperation } from '../src/store/actions';
import { DEMO_STORAGE_KEY, loadDemoState } from '../src/store/storage';

/** 测试用钱包与合约地址（仅本地断言使用，不代表真实部署）。 */
const ACCOUNT = '0x1111111111111111111111111111111111111111' as const;
const REGISTRY = '0x2222222222222222222222222222222222222222' as const;
const TX_HASH = '0x' + 'ab'.repeat(32) as Bytes32;
const OWNER = '0x3333333333333333333333333333333333333333' as const;

/** 构造受控 mock 客户端集合：以可编程行为模拟钱包与公共客户端，避免真实网络。 */
function makeClients(overrides: {
  walletChainId?: number;
  writeContractError?: unknown;
  writeContractArgsCapture?: unknown[];
  receiptStatus?: 'success' | 'reverted';
  estimateGas?: bigint;
} = {}): RegistryClients {
  const walletClient = {
    getChainId: async () => overrides.walletChainId ?? MONAD_CHAIN_ID,
    getAddresses: async () => [ACCOUNT],
    writeContract: async (args: unknown) => {
      if (overrides.writeContractError) throw overrides.writeContractError;
      overrides.writeContractArgsCapture?.push(args);
      return TX_HASH;
    },
  } as unknown as WalletClient;
  const publicClient = {
    chain: undefined,
    estimateGas: async () => overrides.estimateGas ?? 21_000n,
    waitForTransactionReceipt: async () => ({
      status: overrides.receiptStatus ?? 'success',
      transactionHash: TX_HASH,
      blockNumber: 100n,
      gasUsed: 21_000n,
    }),
    readContract: async () => [OWNER, '0x' + 'cd'.repeat(32), 123n],
  } as unknown as PublicClient;
  return { walletClient, publicClient, registryAddress: REGISTRY };
}

describe('Monad 链配置', () => {
  it('链 ID 与 RPC 与冻结值一致', () => {
    expect(MONAD_CHAIN_ID).toBe(10143);
    expect(MONAD_RPC_URL).toBe('https://testnet-rpc.monad.xyz');
  });

  it('测试环境未配置环境变量时 registry 地址为 null', () => {
    expect(getRegistryAddress()).toBeNull();
  });
});

describe('稳定 keccak 哈希', () => {
  it('buildPetKey 符合 keccak256 已知向量并保持确定', () => {
    // keccak256(utf8("abc")) 的公开已知向量。
    expect(buildPetKey('abc')).toBe('0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
    expect(buildPetKey('pawid:pet:mochi')).toBe(buildPetKey('pawid:pet:mochi'));
    expect(buildPetKey('pawid:pet:mochi')).toHaveLength(66);
  });

  it('hashProfile 与键序无关且嵌套结构同样稳定', () => {
    expect(hashProfile({ name: 'Mochi', species: 'cat' })).toBe(hashProfile({ species: 'cat', name: 'Mochi' }));
    expect(hashProfile({ a: { x: 1, y: 2 }, b: [1, 2] })).toBe(hashProfile({ b: [1, 2], a: { y: 2, x: 1 } }));
  });

  it('hashRecord 对不同内容产生不同哈希，剔除 undefined 字段', () => {
    expect(hashRecord({ title: '体检' })).not.toBe(hashRecord({ title: '疫苗' }));
    expect(hashRecord({ title: '体检', note: undefined })).toBe(hashRecord({ title: '体检' }));
  });

  it('recordType 映射完整覆盖五类事件且取值合法', () => {
    expect(Object.keys(RECORD_TYPE_CODES).sort()).toEqual(['birthday', 'daily', 'family', 'health', 'travel']);
    expect(Object.values(RECORD_TYPE_CODES).every((code) => Number.isInteger(code) && code >= 0 && code <= 255)).toBe(true);
  });
});

describe('gas 估价缓冲', () => {
  it('在 estimate 基础上最多增加 10% 且整数运算', () => {
    expect(GAS_BUFFER_PERCENT).toBe(10n);
    expect(withGasBuffer(21_000n)).toBe(23_100n);
    expect(withGasBuffer(99n)).toBe(108n);
  });
});

describe('错误模型', () => {
  it('EIP-1193 4001 归类为用户拒绝，Web3Error 原样保留错误码', () => {
    expect(toWeb3Error({ code: 4001 }).code).toBe('USER_REJECTED');
    expect(toWeb3Error(new Error('User rejected the request')).code).toBe('USER_REJECTED');
    const original = new Web3Error('REGISTRY_NOT_CONFIGURED', '未配置');
    expect(toWeb3Error(original)).toBe(original);
  });

  it('链相关错误码归类为错网，普通异常落到 fallback 错误码', () => {
    expect(toWeb3Error({ code: 4902 }, 'WRONG_NETWORK').code).toBe('WRONG_NETWORK');
    expect(toWeb3Error(new Error('boom'), 'CONTRACT_ERROR').code).toBe('CONTRACT_ERROR');
  });
});

describe('registerPet 交易流程', () => {
  it('回执成功后返回真实证据并读回链上 owner，gas 带缓冲', async () => {
    const capture: unknown[] = [];
    const clients = makeClients({ writeContractArgsCapture: capture, estimateGas: 20_000n });
    const result = await registerPetWithClients(clients, {
      petKey: buildPetKey('pawid:pet:mochi'),
      profileHash: hashProfile({ name: 'Mochi' }),
      account: ACCOUNT,
    });
    expect(result.txHash).toBe(TX_HASH);
    expect(result.blockNumber).toBe(100);
    expect(result.gasUsed).toBe(21_000);
    expect(result.contractAddress).toBe(REGISTRY);
    expect(result.chainId).toBe(MONAD_CHAIN_ID);
    expect(result.owner).toBe(OWNER);
    const writeArgs = capture[0] as { gas?: bigint; address?: string; functionName?: string };
    expect(writeArgs.functionName).toBe('registerPet');
    expect(writeArgs.address).toBe(REGISTRY);
    expect(writeArgs.gas).toBe(22_000n);
  });

  it('回执 reverted 时抛出 RECEIPT_FAILED', async () => {
    const clients = makeClients({ receiptStatus: 'reverted' });
    await expect(registerPetWithClients(clients, {
      petKey: buildPetKey('pawid:pet:mochi'),
      profileHash: hashProfile({ name: 'Mochi' }),
      account: ACCOUNT,
    })).rejects.toMatchObject({ code: 'RECEIPT_FAILED' });
  });

  it('钱包拒签归类为 USER_REJECTED', async () => {
    const clients = makeClients({ writeContractError: { code: 4001, message: 'User rejected' } });
    await expect(registerPetWithClients(clients, {
      petKey: buildPetKey('pawid:pet:mochi'),
      profileHash: hashProfile({ name: 'Mochi' }),
      account: ACCOUNT,
    })).rejects.toMatchObject({ code: 'USER_REJECTED' });
  });

  it('钱包不在 Monad Testnet 时预检抛出 WRONG_NETWORK，且不发起交易', async () => {
    const capture: unknown[] = [];
    const clients = makeClients({ walletChainId: 1, writeContractArgsCapture: capture });
    await expect(registerPetWithClients(clients, {
      petKey: buildPetKey('pawid:pet:mochi'),
      profileHash: hashProfile({ name: 'Mochi' }),
      account: ACCOUNT,
    })).rejects.toMatchObject({ code: 'WRONG_NETWORK' });
    expect(capture).toHaveLength(0);
  });
});

describe('anchorRecord 交易流程', () => {
  it('回执成功后返回真实证据并按冻结签名传参', async () => {
    const capture: unknown[] = [];
    const clients = makeClients({ writeContractArgsCapture: capture });
    const result = await anchorRecordWithClients(clients, {
      petKey: buildPetKey('pawid:pet:mochi'),
      recordHash: hashRecord({ title: '体检' }),
      recordType: RECORD_TYPE_CODES.health,
      uri: '',
    });
    expect(result.txHash).toBe(TX_HASH);
    expect(result.recordType).toBe(RECORD_TYPE_CODES.health);
    expect(result.contractAddress).toBe(REGISTRY);
    const writeArgs = capture[0] as { functionName?: string; args?: unknown[] };
    expect(writeArgs.functionName).toBe('anchorRecord');
    expect(writeArgs.args?.[2]).toBe(RECORD_TYPE_CODES.health);
  });

  it('recordType 非法时直接拒绝，不进入签名流程', async () => {
    const capture: unknown[] = [];
    const clients = makeClients({ writeContractArgsCapture: capture });
    await expect(anchorRecordWithClients(clients, {
      petKey: buildPetKey('pawid:pet:mochi'),
      recordHash: hashRecord({ title: '体检' }),
      recordType: 300,
      uri: '',
    })).rejects.toMatchObject({ code: 'CONTRACT_ERROR' });
    expect(capture).toHaveLength(0);
  });
});

describe('Store 与真实链上证据', () => {
  it('初始种子不注入任何伪造链上身份', () => {
    const state = cloneSeedState();
    expect(state.onChainIdentities).toEqual([]);
    expect(state.lifeRecordAnchors).toEqual([]);
  });

  it('旧版本 localStorage 数据加载后自动补齐空链上证据字段', () => {
    const legacy = {
      users: [], pets: [], guardianLinks: [], invites: [], relations: [], lifeEvents: [],
      credentials: [], pointEntries: [], inventoryItems: [], badges: [], lostCases: [],
      foundReports: [], serviceInterests: [], currentRole: 'owner', failNext: false, processedOperationKeys: [],
    };
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(legacy));
    try {
      const loaded = loadDemoState();
      expect(loaded.onChainIdentities).toEqual([]);
      expect(loaded.lifeRecordAnchors).toEqual([]);
    } finally {
      window.localStorage.removeItem(DEMO_STORAGE_KEY);
    }
  });

  it('链上身份证据按 petKey 幂等写入，锚定证据按事件与交易幂等写入', () => {
    const now = '2026-09-05T10:00:00.000Z';
    const identity: PetChainIdentity = {
      petId: 'mochi', petKey: buildPetKey('pawid:pet:mochi'), profileHash: hashProfile({ name: 'Mochi' }),
      owner: OWNER, contractAddress: REGISTRY, txHash: TX_HASH, blockNumber: 100, chainId: MONAD_CHAIN_ID, registeredAt: now,
    };
    const once = applyOperation(cloneSeedState(), { type: 'ANCHOR_PET_IDENTITY', petId: 'mochi', identity });
    const twice = applyOperation(once, { type: 'ANCHOR_PET_IDENTITY', petId: 'mochi', identity });
    expect(once.onChainIdentities).toHaveLength(1);
    expect(twice.onChainIdentities).toHaveLength(1);
    const anchor: LifeRecordAnchor = {
      id: 'anchor-1', eventId: 'event-1', petId: 'mochi', petKey: identity.petKey,
      recordHash: hashRecord({ title: '体检' }), recordType: RECORD_TYPE_CODES.health, uri: '',
      contractAddress: REGISTRY, txHash: TX_HASH, blockNumber: 101, chainId: MONAD_CHAIN_ID, anchoredAt: now,
    };
    const anchored = applyOperation(twice, { type: 'ANCHOR_LIFE_RECORD', anchor });
    const reAnchored = applyOperation(anchored, { type: 'ANCHOR_LIFE_RECORD', anchor });
    expect(anchored.lifeRecordAnchors).toHaveLength(1);
    expect(reAnchored.lifeRecordAnchors).toHaveLength(1);
  });

  it('宠物不存在时链上身份证据不写入', () => {
    const identity: PetChainIdentity = {
      petId: 'ghost', petKey: buildPetKey('ghost'), profileHash: hashProfile({}), owner: OWNER,
      contractAddress: REGISTRY, txHash: TX_HASH, blockNumber: 100, chainId: MONAD_CHAIN_ID, registeredAt: '2026-09-05T10:00:00.000Z',
    };
    const next = applyOperation(cloneSeedState(), { type: 'ANCHOR_PET_IDENTITY', petId: 'ghost', identity });
    expect(next.onChainIdentities).toHaveLength(0);
  });
});
