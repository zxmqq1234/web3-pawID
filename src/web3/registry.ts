// PawIDRegistry 链上交互内核（真实 Monad Testnet 写操作）。
// 说明：
// - 只依赖 registryAbi.ts 这一唯一 ABI 来源，本文件不重复定义 ABI。
// - 交易流程固定为：网络预检 → estimateGas（+10% buffer）→ 钱包签名发送 → 等待回执 →
//   回执 status === 'success' 才返回真实证据（txHash、blockNumber、owner、contractAddress）。
// - 所有失败路径都收敛为可恢复的 Web3Error（拒签、错网、RPC、回执失败、未配置地址等）。
// - petKey/profileHash/recordHash 一律使用 viem keccak256 的稳定输入，保证跨端可复算。
// 编码 UTF-8。

import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  http,
  keccak256,
  toBytes,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { getRegistryAddress, monadChain, MONAD_CHAIN_ID, MONAD_RPC_URL } from '../config/monad';
import { registryAbi } from './registryAbi';
import { getInjectedProvider } from './provider';
import { Web3Error, toWeb3Error } from './errors';

/** 32 字节哈希（bytes32）的十六进制字面量类型。 */
export type Bytes32 = `0x${string}`;

// 冻结接口的一部分：registry 模块直接暴露合约地址读取（实现来自 config/monad.ts）。
export { getRegistryAddress };

/** 交易 gas 的额外缓冲比例：在 estimateGas 基础上最多加 10%。 */
export const GAS_BUFFER_PERCENT = 10n;

/** 生命档案事件类型到合约 uint8 recordType 的稳定映射（与合约枚举顺序一致）。 */
export const RECORD_TYPE_CODES = {
  family: 0,
  health: 1,
  birthday: 2,
  travel: 3,
  daily: 4,
} as const;

/**
 * 稳定序列化：递归按键名排序并剔除 undefined 字段。
 * 同一资料无论对象键序如何，序列化结果与哈希完全一致。
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

/** 由稳定种子字符串派生宠物链上主键 petKey（keccak256）。 */
export function buildPetKey(seed: string): Bytes32 {
  return keccak256(toBytes(seed));
}

/** 由任意资料对象派生资料哈希 profileHash（稳定序列化后 keccak256）。 */
export function hashProfile(value: unknown): Bytes32 {
  return keccak256(toBytes(stableStringify(value)));
}

/** 由记录内容派生记录哈希 recordHash（与 profileHash 同一稳定 keccak 规则，语义独立命名）。 */
export function hashRecord(value: unknown): Bytes32 {
  return keccak256(toBytes(stableStringify(value)));
}

/** registry 交互所需的客户端集合，测试时可注入 mock 实现。 */
export interface RegistryClients {
  /** 钱包客户端（签名与发送交易）。 */
  walletClient: WalletClient;
  /** 公共客户端（估价、回执与合约读取）。 */
  publicClient: PublicClient;
  /** Registry 合约地址。 */
  registryAddress: Address;
}

/** 一次成功链上交易的通用真实证据。 */
export interface ChainTxEvidence {
  /** 交易哈希。 */
  txHash: Hash;
  /** 交易所在区块号。 */
  blockNumber: number;
  /** 实际消耗 gas。 */
  gasUsed: number;
  /** Registry 合约地址。 */
  contractAddress: Address;
  /** 链 ID（应为 10143）。 */
  chainId: number;
}

/** 宠物身份上链注册结果：额外包含链上读回的真实 owner。 */
export interface RegisterPetResult extends ChainTxEvidence {
  petKey: Bytes32;
  profileHash: Bytes32;
  owner: Address;
}

/** 生命档案锚定结果。 */
export interface AnchorRecordResult extends ChainTxEvidence {
  petKey: Bytes32;
  recordHash: Bytes32;
  recordType: number;
  uri: string;
}

/** 按冻结上限（10%）为估价结果加缓冲。 */
export function withGasBuffer(estimated: bigint): bigint {
  return (estimated * (100n + GAS_BUFFER_PERCENT)) / 100n;
}

/** 组装默认客户端：钱包走浏览器 EIP-1193，公共读取走官方 RPC。 */
export function createDefaultRegistryClients(): RegistryClients {
  const registryAddress = getRegistryAddress();
  if (!registryAddress) {
    throw new Web3Error('REGISTRY_NOT_CONFIGURED', '未配置 VITE_MONAD_REGISTRY_ADDRESS，链上注册不可用');
  }
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Web3Error('NO_WALLET', '未检测到浏览器钱包，请先安装 MetaMask 等钱包后重试');
  }
  return {
    walletClient: createWalletClient({ chain: monadChain, transport: custom(provider) }),
    publicClient: createPublicClient({ chain: monadChain, transport: http(MONAD_RPC_URL) }),
    registryAddress: registryAddress as Address,
  };
}

/** 等待交易回执，并强制校验 status === 'success'；失败一律抛 RECEIPT_FAILED。 */
async function waitForSuccessReceipt(clients: RegistryClients, txHash: Hash) {
  const receipt = await clients.publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') {
    throw new Web3Error('RECEIPT_FAILED', '交易已上链但执行失败（reverted），请检查合约状态后重试');
  }
  return receipt;
}

/** 把成功回折转换为通用证据对象。 */
function toEvidence(clients: RegistryClients, receipt: { transactionHash: Hash; blockNumber: bigint; gasUsed: bigint }): ChainTxEvidence {
  return {
    txHash: receipt.transactionHash,
    blockNumber: Number(receipt.blockNumber),
    gasUsed: Number(receipt.gasUsed),
    contractAddress: clients.registryAddress,
    chainId: clients.publicClient.chain?.id ?? MONAD_CHAIN_ID,
  };
}

/** 写交易前的网络预检：钱包当前网络不是 Monad Testnet 时直接报可恢复错误。 */
async function ensureMonadNetwork(clients: RegistryClients): Promise<void> {
  const walletChainId = await clients.walletClient.getChainId();
  if (walletChainId !== MONAD_CHAIN_ID) {
    throw new Web3Error('WRONG_NETWORK', '钱包当前不在 Monad Testnet，请切换网络后重试');
  }
}

/**
 * 真实执行 registerPet：估价 → 签名发送 → 等回执 → 读回 owner。
 * 仅在回执成功后返回证据；任何一步失败都抛出可恢复的 Web3Error。
 */
export async function registerPetWithClients(
  clients: RegistryClients,
  params: { petKey: Bytes32; profileHash: Bytes32; account: Address },
): Promise<RegisterPetResult> {
  try {
    await ensureMonadNetwork(clients);
    const data = encodeFunctionData({
      abi: registryAbi,
      functionName: 'registerPet',
      args: [params.petKey, params.profileHash],
    });
    const estimated = await clients.publicClient.estimateGas({
      account: params.account,
      to: clients.registryAddress,
      data,
    });
    const txHash = await clients.walletClient.writeContract({
      address: clients.registryAddress,
      abi: registryAbi,
      functionName: 'registerPet',
      args: [params.petKey, params.profileHash],
      account: params.account,
      chain: monadChain,
      gas: withGasBuffer(estimated),
    });
    const receipt = await waitForSuccessReceipt(clients, txHash);
    const pet = await clients.publicClient.readContract({
      address: clients.registryAddress,
      abi: registryAbi,
      functionName: 'getPet',
      args: [params.petKey],
    });
    const [owner] = pet;
    return { ...toEvidence(clients, receipt), petKey: params.petKey, profileHash: params.profileHash, owner };
  } catch (error) {
    throw toWeb3Error(error, 'CONTRACT_ERROR');
  }
}

/**
 * 真实执行 anchorRecord：从钱包取当前账户 → 估价 → 签名发送 → 等回执。
 * 冻结签名不含 account，账户统一通过 eth_accounts（getAddresses）获取。
 */
export async function anchorRecordWithClients(
  clients: RegistryClients,
  params: { petKey: Bytes32; recordHash: Bytes32; recordType: number; uri: string },
): Promise<AnchorRecordResult> {
  try {
    if (!Number.isInteger(params.recordType) || params.recordType < 0 || params.recordType > 255) {
      throw new Web3Error('CONTRACT_ERROR', 'recordType 必须是 0-255 的整数');
    }
    await ensureMonadNetwork(clients);
    const addresses = await clients.walletClient.getAddresses();
    const account = addresses[0];
    if (!account) {
      throw new Web3Error('NO_WALLET', '钱包尚未连接账户，请先完成钱包连接');
    }
    const data = encodeFunctionData({
      abi: registryAbi,
      functionName: 'anchorRecord',
      args: [params.petKey, params.recordHash, params.recordType, params.uri],
    });
    const estimated = await clients.publicClient.estimateGas({
      account,
      to: clients.registryAddress,
      data,
    });
    const txHash = await clients.walletClient.writeContract({
      address: clients.registryAddress,
      abi: registryAbi,
      functionName: 'anchorRecord',
      args: [params.petKey, params.recordHash, params.recordType, params.uri],
      account,
      chain: monadChain,
      gas: withGasBuffer(estimated),
    });
    const receipt = await waitForSuccessReceipt(clients, txHash);
    return { ...toEvidence(clients, receipt), petKey: params.petKey, recordHash: params.recordHash, recordType: params.recordType, uri: params.uri };
  } catch (error) {
    throw toWeb3Error(error, 'CONTRACT_ERROR');
  }
}

/** 冻结接口：注册宠物身份上链，返回真实 txHash、blockNumber 与链上 owner。 */
export async function registerPetOnChain(params: {
  petKey: Bytes32;
  profileHash: Bytes32;
  account: Address;
}): Promise<RegisterPetResult> {
  return registerPetWithClients(createDefaultRegistryClients(), params);
}

/** 冻结接口：锚定生命档案记录哈希上链，返回真实交易证据。 */
export async function anchorRecordOnChain(params: {
  petKey: Bytes32;
  recordHash: Bytes32;
  recordType: number;
  uri: string;
}): Promise<AnchorRecordResult> {
  return anchorRecordWithClients(createDefaultRegistryClients(), params);
}
