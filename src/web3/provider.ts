// 浏览器钱包（EIP-1193）检测与 wagmi 全局配置。
// 说明：
// - wagmi config 采用惰性单例，避免模块加载期副作用影响测试与 SSR。
// - 连接器只使用内置 injected（MetaMask 等浏览器钱包），不引入额外连接器依赖。
// 编码 UTF-8。

import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import type { EIP1193Provider, Address } from 'viem';
import { monadChain, MONAD_RPC_URL } from '../config/monad';
import { Web3Error, toWeb3Error } from './errors';

/** 声明浏览器注入的 EIP-1193 钱包对象，避免使用 any。 */
declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

/** 读取浏览器注入的 EIP-1193 钱包；不存在时返回 null（对应可恢复的 NO_WALLET 场景）。 */
export function getInjectedProvider(): EIP1193Provider | null {
  if (typeof window === 'undefined') return null;
  return window.ethereum ?? null;
}

let wagmiConfigInstance: ReturnType<typeof createConfig> | null = null;

/** 惰性创建并缓存 wagmi 全局配置：仅 Monad Testnet + 注入式钱包连接器。 */
export function getWagmiConfig(): ReturnType<typeof createConfig> {
  if (!wagmiConfigInstance) {
    wagmiConfigInstance = createConfig({
      chains: [monadChain],
      connectors: [injected({ shimDisconnect: true })],
      transports: {
        [monadChain.id]: http(MONAD_RPC_URL),
      },
    });
  }
  return wagmiConfigInstance;
}

/**
 * 读取当前钱包已连接账户（eth_accounts）。
 * 未装钱包或尚未授权账户时抛出可恢复的 Web3Error（NO_WALLET）。
 */
export async function requestConnectedAccount(): Promise<Address> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Web3Error('NO_WALLET', '未检测到浏览器钱包，请先安装 MetaMask 等钱包后重试');
  }
  try {
    const accounts = (await provider.request({ method: 'eth_accounts' })) as string[] | null;
    const account = accounts?.[0];
    if (!account) {
      throw new Web3Error('NO_WALLET', '钱包尚未连接账户，请先完成钱包连接');
    }
    return account as Address;
  } catch (error) {
    throw toWeb3Error(error);
  }
}
