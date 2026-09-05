import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import App from './app/App';
import { getWagmiConfig } from './web3/provider';
import './styles/global.css';

/** 全局唯一的 React Query 客户端；wagmi 的连接与合约读取状态依赖其缓存。 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

/** Vite 浏览器入口：挂载 wagmi/React Query Provider 后渲染 PawID 应用。 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={getWagmiConfig()}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
