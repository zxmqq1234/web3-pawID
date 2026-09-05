/// <reference types="vite/client" />

// Vite 环境变量类型声明：只声明本仓库真实使用的变量，避免用 any 掩盖配置缺失。

/** 应用可用的环境变量集合。 */
interface ImportMetaEnv {
  /** PawIDRegistry 合约地址（0x 开头 40 位十六进制）；未配置或非法时链上写操作不可用。 */
  readonly VITE_MONAD_REGISTRY_ADDRESS?: string;
}

/** 标准 Vite import.meta.env 入口。 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
