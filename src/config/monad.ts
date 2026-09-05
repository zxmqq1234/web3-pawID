// Monad Testnet 链与 Registry 合约的前端配置。
// 说明：
// - 链定义优先复用 wagmi/chains 的 monadTestnet，不在本仓库手写链 ID、RPC 或浏览器地址。
// - 合约地址一律来自环境变量 VITE_MONAD_REGISTRY_ADDRESS，仓库内不写死任何部署地址。
// 编码 UTF-8。

import { monadTestnet } from 'wagmi/chains';

/** Monad Testnet 链对象（chainId 10143）。 */
export const monadChain = monadTestnet;

/** Monad Testnet 链 ID（冻结值 10143）。 */
export const MONAD_CHAIN_ID: number = monadTestnet.id;

/** Monad Testnet 官方 RPC（取自 wagmi 链定义，避免手写第二份 URL）。 */
export const MONAD_RPC_URL: string = monadTestnet.rpcUrls.default.http[0];

/** 合法 EVM 地址（0x + 40 位十六进制）的窄校验模式。 */
const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

/** 判断字符串是否是合法 EVM 地址，供 registry 配置与环境变量校验复用。 */
export function isEvmAddress(value: string): boolean {
  return EVM_ADDRESS_PATTERN.test(value);
}

/**
 * 读取 Registry 合约地址。
 * 未配置、为空或格式非法时返回 null，由调用方转为可恢复的 REGISTRY_NOT_CONFIGURED 错误。
 */
export function getRegistryAddress(): string | null {
  const raw = import.meta.env.VITE_MONAD_REGISTRY_ADDRESS;
  if (!raw) return null;
  return isEvmAddress(raw) ? raw : null;
}

/** 根据交易哈希生成 Monad 测试网浏览器链接，便于页面直接展示证据入口。 */
export function getExplorerTxUrl(txHash: string): string {
  return `${monadTestnet.blockExplorers.default.url}/tx/${txHash}`;
}
