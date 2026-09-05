#!/usr/bin/env node
// ABI 一致性检查（src/web3/registryAbi.ts 是前端唯一 ABI 来源）。
// 默认：比对编译产物 ABI 与 TS 文件的函数/事件/错误名集合，不一致即失败；
// 缺编译产物时报 SKIP（保持手写冻结版，不臆改），退出码 0。
// --write：用编译产物 ABI 重新生成 TS 文件全文（保留头部常量注释与链 ID 约定）。
// 可选环境变量：ARTIFACT_PATH（默认 contracts/out/PawIDRegistry.sol/PawIDRegistry.json）、
// TARGET_PATH（默认 src/web3/registryAbi.ts）。
// 编码 UTF-8。

import {readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import process from "node:process";

const artifactPath = process.env.ARTIFACT_PATH ?? path.join("contracts", "out", "PawIDRegistry.sol", "PawIDRegistry.json");
const targetPath = process.env.TARGET_PATH ?? path.join("src", "web3", "registryAbi.ts");
const wantWrite = process.argv.includes("--write");

function fail(message) {
  console.error(`[sync-registry-abi] 失败：${message}`);
  process.exit(1);
}

// 从 TS 源码提取所有 name: "..." 声明，用于集合比对。
function tsNamesOf(source) {
  return new Set([...source.matchAll(/name:\s*"(\w+)"/g)].map((m) => m[1]));
}

// 用产物 ABI 生成 TS 全文（头部常量与注释保持冻结约定）。
function renderTs(abi) {
  return `// PawIDRegistry 前端唯一 ABI 来源（与 contracts/src/PawIDRegistry.sol 保持一致）。
// 说明：
// - 本文件是前端引用合约的唯一 ABI 来源，禁止在其他位置手写第二份 ABI。
// - 有 Foundry 时执行 \`node scripts/sync-registry-abi.mjs --write\` 从编译产物刷新本文件；
//   无 Foundry 时保持手写版本（已按冻结接口逐项核对），不得臆造地址。
// - 链上只存哈希、地址、时间、可选 URI；ABI 中无任何姓名、健康、联系方式字段。
// - Monad Testnet chainId 为 10143，部署地址一律由环境变量传入，不在本仓库写死。
// 编码 UTF-8。

// 合约名（Monskill 验证 API 所需格式：路径:合约名，相对 contracts/ 目录）。
export const REGISTRY_CONTRACT_NAME = "src/PawIDRegistry.sol:PawIDRegistry" as const;

// 编译器版本（与 contracts/foundry.toml 的 solc_version 对应，验证时必须如实上报）。
export const REGISTRY_COMPILER_VERSION = "0.8.28" as const;

// Monad 测试网链 ID（冻结值，禁止改为其他链）。
export const MONAD_TESTNET_CHAIN_ID = 10143 as const;

// PawIDRegistry ABI（冻结接口：2 写 + 3 读 + 2 事件 + 6 自定义错误）。
export const registryAbi = ${JSON.stringify(abi, null, 2)} as const;
`;
}

let artifact;
try {
  artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
} catch {
  console.log(`[sync-registry-abi] SKIP：缺少编译产物 ${artifactPath}（需 forge build）。当前 TS 手写版保持冻结接口，未改动。`);
  process.exit(0);
}
if (!Array.isArray(artifact.abi)) fail(`编译产物缺少 abi 数组：${artifactPath}`);
const source = readFileSync(targetPath, "utf8");
const names = tsNamesOf(source);
const missing = artifact.abi.map((e) => e.name).filter((n) => n && !names.has(n));
if (missing.length > 0) fail(`TS 文件缺失以下条目：${[...new Set(missing)].join(", ")}`);
if (!wantWrite) {
  console.log(`[sync-registry-abi] 通过：产物 ABI（${artifact.abi.length} 条）名称集合均已存在于 ${targetPath}。`);
  process.exit(0);
}
writeFileSync(targetPath, `${renderTs(artifact.abi)}`, "utf8");
console.log(`[sync-registry-abi] 成功：已用编译产物刷新 ${targetPath}。`);
