// 钱包连接 Hook（冻结接口）：snapshot + connect/disconnect/switchToMonad/refresh。
// 说明：
// - 底层复用 wagmi 对 EIP-1193 事件（accountsChanged/chainChanged）的订阅，地址与链 ID 自动跟随钱包。
// - snapshot.status 语义：disconnected 未连接；connecting 操作进行中；connected 已连 Monad；
//   wrong-network 已连但链不对；error 上次操作失败且当前未连接。
// - 失败后 snapshot 仍携带 errorCode/errorMessage，且保留最新地址与链 ID，保证可恢复（可重试）。
// 编码 UTF-8。

import { useCallback, useMemo, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useReconnect, useSwitchChain } from 'wagmi';
import type { Address } from 'viem';
import { MONAD_CHAIN_ID } from '../config/monad';
import { Web3Error, toWeb3Error, type Web3ErrorCode } from './errors';
import { getWagmiConfig } from './provider';

/** 钱包快照状态。 */
export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'wrong-network' | 'error';

/** 钱包状态快照：页面只读展示，不直接依赖 wagmi 内部对象。 */
export interface WalletSnapshot {
  status: WalletStatus;
  /** 当前连接地址（未连接为 null）。 */
  address: Address | null;
  /** 当前链 ID（未知为 null）。 */
  chainId: number | null;
  /** 最近一次失败的稳定错误码（无失败为 null）。 */
  errorCode: Web3ErrorCode | null;
  /** 最近一次失败的中文提示（无失败为 null）。 */
  errorMessage: string | null;
}

/** useWallet 返回的冻结接口。 */
export interface UseWalletResult {
  snapshot: WalletSnapshot;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchToMonad: () => Promise<void>;
  refresh: () => Promise<void>;
}

/** 钱包连接与网络切换的唯一入口 Hook；页面不得自行调用 window.ethereum。 */
export function useWallet(): UseWalletResult {
  const config = getWagmiConfig();
  const { address, chainId, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { reconnect } = useReconnect({ config });
  /** 是否有连接/断开/切网操作正在进行。 */
  const [busy, setBusy] = useState(false);
  /** 最近一次操作失败（保留至下一次操作成功）。 */
  const [failure, setFailure] = useState<Web3Error | null>(null);

  /** 连接注入式浏览器钱包；失败时记录可恢复错误，不清空现有连接。 */
  const connect = useCallback(async () => {
    setBusy(true);
    setFailure(null);
    try {
      const connector = connectors[0];
      if (!connector) {
        throw new Web3Error('NO_WALLET', '未检测到可用钱包连接器，请先安装 MetaMask 等浏览器钱包');
      }
      await connectAsync({ connector });
    } catch (error) {
      setFailure(toWeb3Error(error));
    } finally {
      setBusy(false);
    }
  }, [connectAsync, connectors]);

  /** 断开连接并清除历史错误。 */
  const disconnect = useCallback(async () => {
    setBusy(true);
    setFailure(null);
    try {
      await disconnectAsync();
    } catch (error) {
      setFailure(toWeb3Error(error));
    } finally {
      setBusy(false);
    }
  }, [disconnectAsync]);

  /** 请求钱包切换到 Monad Testnet；钱包缺链时 wagmi 会自动触发添加链。 */
  const switchToMonad = useCallback(async () => {
    setBusy(true);
    setFailure(null);
    try {
      await switchChainAsync({ chainId: MONAD_CHAIN_ID });
    } catch (error) {
      setFailure(toWeb3Error(error, 'WRONG_NETWORK'));
    } finally {
      setBusy(false);
    }
  }, [switchChainAsync]);

  /** 重新读取钱包状态（eth_accounts/eth_chainId），用于窗口失焦或钱包异常后的恢复。 */
  const refresh = useCallback(async () => {
    setFailure(null);
    await reconnect();
  }, [reconnect]);

  /** 由 wagmi 响应式数据 + 本地操作态派生冻结的快照语义。 */
  const snapshot = useMemo<WalletSnapshot>(() => {
    let status: WalletStatus;
    if (busy) {
      status = 'connecting';
    } else if (!isConnected) {
      status = failure ? 'error' : 'disconnected';
    } else if (chainId !== MONAD_CHAIN_ID) {
      status = 'wrong-network';
    } else {
      status = 'connected';
    }
    return {
      status,
      address: address ?? null,
      chainId: chainId ?? null,
      errorCode: failure?.code ?? null,
      errorMessage: failure?.message ?? null,
    };
  }, [busy, failure, isConnected, address, chainId]);

  return { snapshot, connect, disconnect, switchToMonad, refresh };
}
