#!/usr/bin/env node
// Monskill 验证载荷生成器（只组装 payload 文件，绝不发送网络请求、不触碰私钥）。
// 优先级：优先生成 Monskill 验证 API（https://agents.devnads.com/v1/verify）所需字段，
// 仅 API 失败才允许 Sourcify 回退（回退命令见本脚本成功输出）。
// 所需输入：
//   必需 REGISTRY_ADDRESS（已部署地址；缺失即失败，禁止臆测）；
//   必需 STANDARD_JSON_PATH（forge verify-contract --show-standard-json-input 的输出文件）；
//   可选 ARTIFACT_PATH（默认 contracts/out/PawIDRegistry.sol/PawIDRegistry.json 的 foundryMetadata 来源）；
//   可选 CONTRACT_NAME（默认 src/PawIDRegistry.sol:PawIDRegistry）；
//   可选 CHAIN_ID（默认 10143，必须为 10143，否则失败）；
//   可选 COMPILER_VERSION（不传则取产物 metadata.compiler.version；传入则必须与产物一致）；
//   可选 OUTPUT_PATH（默认系统临时目录 pawid-registry-verify-10143.json，不污染仓库）。
// 本合约无构造函数：若传入 CONSTRUCTOR_ARGS 即失败（防止误带构造参数）。
// 生成产物 standardJsonInput 来自 forge，foundryMetadata 来自编译产物 .metadata。
// 编码 UTF-8。

import {readFileSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const VERIFY_API = "https://agents.devnads.com/v1/verify";
const EXPECTED_CHAIN_ID = 10143;
const DEFAULT_CONTRACT_NAME = "src/PawIDRegistry.sol:PawIDRegistry";
const DEFAULT_ARTIFACT = path.join("contracts", "out", "PawIDRegistry.sol", "PawIDRegistry.json");

function fail(message) {
  console.error(`[build-verify-payload] 失败：${message}`);
  process.exit(1);
}

function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(value ?? "");
}

const contractAddress = process.env.REGISTRY_ADDRESS ?? "";
if (!contractAddress) fail("缺少 REGISTRY_ADDRESS（已部署地址）。未部署则无可验证对象，禁止臆测地址。");
if (!isAddress(contractAddress)) fail(`REGISTRY_ADDRESS 格式非法：${contractAddress}`);

const chainId = Number(process.env.CHAIN_ID ?? EXPECTED_CHAIN_ID);
if (chainId !== EXPECTED_CHAIN_ID) fail(`CHAIN_ID 必须为 ${EXPECTED_CHAIN_ID}（Monad Testnet），实际 ${process.env.CHAIN_ID}`);
if (process.env.CONSTRUCTOR_ARGS) fail("本合约无构造函数，禁止传入 CONSTRUCTOR_ARGS。");

const contractName = process.env.CONTRACT_NAME ?? DEFAULT_CONTRACT_NAME;
const artifactPath = process.env.ARTIFACT_PATH ?? DEFAULT_ARTIFACT;
const standardJsonPath = process.env.STANDARD_JSON_PATH ?? "";
if (!standardJsonPath) {
  fail("缺少 STANDARD_JSON_PATH。请先执行：forge verify-contract <ADDR> <CONTRACT> --chain 10143 --show-standard-json-input > <STANDARD_JSON_PATH>（仅生成输入文件，不发送验证请求）。");
}

let artifact;
try {
  artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
} catch {
  fail(`读取编译产物失败：${artifactPath}。请先在 contracts/ 下执行 forge build。`);
}
if (!artifact.metadata) fail(`编译产物缺少 .metadata：${artifactPath}`);
const artifactCompiler = artifact.metadata?.compiler?.version ?? artifact.metadata?.compilerVersion ?? "";
let compilerVersion = process.env.COMPILER_VERSION ?? artifactCompiler;
if (!compilerVersion) fail("无法确定 compilerVersion（产物与环境变量均缺失），请如实提供。");
if (process.env.COMPILER_VERSION && artifactCompiler && process.env.COMPILER_VERSION !== artifactCompiler) {
  fail(`COMPILER_VERSION 与产物不一致：环境变量=${process.env.COMPILER_VERSION}，产物=${artifactCompiler}。必须如实上报。`);
}

let standardJsonInput;
try {
  standardJsonInput = JSON.parse(readFileSync(standardJsonPath, "utf8"));
} catch {
  fail(`读取 standard json input 失败：${standardJsonPath}。`);
}

const payload = {
  chainId,
  contractAddress,
  contractName,
  compilerVersion,
  standardJsonInput,
  foundryMetadata: artifact.metadata,
};
const outputPath = process.env.OUTPUT_PATH ?? path.join(os.tmpdir(), "pawid-registry-verify-10143.json");
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`[build-verify-payload] 成功：已生成 Monskill 验证载荷：${outputPath}`);
console.log(`[build-verify-payload] 下一步（手动）：curl -X POST ${VERIFY_API} -H "Content-Type: application/json" -d @${outputPath}`);
console.log("[build-verify-payload] 仅 API 失败才允许 Sourcify 回退：");
console.log(`[build-verify-payload] forge verify-contract ${contractAddress} ${contractName} --chain 10143 --verifier sourcify --verifier-url "https://sourcify-api-monad.blockvision.org/"`);
console.log("[build-verify-payload] 声明：本脚本未发送任何网络请求，未验证任何合约。");
