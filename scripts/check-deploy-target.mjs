#!/usr/bin/env node
// 部署前目标地址检查（只读 RPC，不部署、不签名、不读取私钥）。
// 用途：正式部署前，用 eth_chainId + eth_getCode 确认目标地址状态，避免覆盖已部署合约。
// 退出码：0 = 目标地址无字节码且链 ID 正确（可继续走正式部署流程）；
//         1 = 缺失地址/格式错误/RPC 不可达/链 ID 非 10143/地址已有字节码。
// 所需环境变量：REGISTRY_ADDRESS（目标/已部署地址；禁止臆测，本仓库不提供任何地址）。
// 可选：MONAD_TESTNET_RPC_URL（默认 https://testnet-rpc.monad.xyz）。
// 正式部署通道（文档化接口，不在本脚本执行）：Alchemy Agent Wallet 会话 + 经由
// 规范 CreateX 工厂（0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed）的 CREATE2 部署。
// 当前 monskill 缺失 wallet 子 skill，禁止猜测 alchemy 命令；
// 回退仅为 contracts/script/DeployPawIDRegistry.s.sol（明确标注“仅本地安全环境”，默认不执行）。
// 本脚本若检测到私钥类变量，仅告警且绝不读取/打印其值。
// 编码 UTF-8。

import process from "node:process";

const EXPECTED_CHAIN_ID = 10143; // Monad Testnet 冻结值
const DEFAULT_RPC_URL = "https://testnet-rpc.monad.xyz";
const CREATEX_ADDRESS = "0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed"; // 规范 CreateX 工厂，仅文档化

function fail(message) {
  console.error(`[check-deploy-target] 失败：${message}`);
  process.exit(1);
}

function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(value ?? "");
}

async function rpcCall(url, method, params) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({jsonrpc: "2.0", id: 1, method, params}),
    });
  } catch (err) {
    fail(`RPC 不可达（${url}）：${err.message}`);
  }
  if (!res.ok) fail(`RPC HTTP 错误：${res.status} ${res.statusText}`);
  const body = await res.json();
  if (body.error) fail(`RPC 返回错误：${JSON.stringify(body.error)}`);
  return body.result;
}

const target = process.env.REGISTRY_ADDRESS ?? process.env.DEPLOY_TARGET_ADDRESS ?? "";
if (!target) {
  fail("缺少 REGISTRY_ADDRESS（目标/已部署地址）。当前无部署账户与资金，禁止臆测地址；请由部署流程显式传入。");
}
if (!isAddress(target)) fail(`REGISTRY_ADDRESS 格式非法：${target}`);
if (process.env.DEPLOYER_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? process.env.MNEMONIC) {
  console.warn("[check-deploy-target] 告警：检测到私钥类环境变量，本脚本不会读取、打印或传输其值。");
}

const rpcUrl = process.env.MONAD_TESTNET_RPC_URL ?? DEFAULT_RPC_URL;
const chainHex = await rpcCall(rpcUrl, "eth_chainId", []);
if (Number(chainHex) !== EXPECTED_CHAIN_ID) {
  fail(`链 ID 不符：期望 ${EXPECTED_CHAIN_ID}（Monad Testnet），实际 ${chainHex}。已终止。`);
}
const code = await rpcCall(rpcUrl, "eth_getCode", [target, "latest"]);
if (code && code !== "0x" && code !== "0x0") {
  fail(`目标地址 ${target} 已有字节码（${code.length} 字符），禁止覆盖部署。请核对是否为已部署的 PawIDRegistry。`);
}

console.log(`[check-deploy-target] 通过：链 ID=${EXPECTED_CHAIN_ID}，目标 ${target} 无字节码，可进入正式部署流程。`);
console.log(`[check-deploy-target] 正式部署通道：Alchemy Agent Wallet 会话 + CreateX（${CREATEX_ADDRESS}）CREATE2；回退见 contracts/script/DeployPawIDRegistry.s.sol（仅本地安全环境）。`);
console.log("[check-deploy-target] 声明：本脚本未部署任何合约，未给出新地址。");
