// PawIDRegistry 前端唯一 ABI 来源（与 contracts/src/PawIDRegistry.sol 保持一致）。
// 说明：
// - 本文件是前端引用合约的唯一 ABI 来源，禁止在其他位置手写第二份 ABI。
// - 有 Foundry 时执行 `node scripts/sync-registry-abi.mjs` 从编译产物刷新本文件；
//   无 Foundry 时保持本手写版本（已按冻结接口逐项核对），不得臆造地址。
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
export const registryAbi = [
  {
    type: "function",
    name: "registerPet",
    stateMutability: "nonpayable",
    inputs: [
      { name: "petKey", type: "bytes32" },
      { name: "profileHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "anchorRecord",
    stateMutability: "nonpayable",
    inputs: [
      { name: "petKey", type: "bytes32" },
      { name: "recordHash", type: "bytes32" },
      { name: "recordType", type: "uint8" },
      { name: "uri", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getPet",
    stateMutability: "view",
    inputs: [{ name: "petKey", type: "bytes32" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "profileHash", type: "bytes32" },
      { name: "registeredAt", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "ownerOfPet",
    stateMutability: "view",
    inputs: [{ name: "petKey", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "isPetRegistered",
    stateMutability: "view",
    inputs: [{ name: "petKey", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "PetRegistered",
    anonymous: false,
    inputs: [
      { name: "petKey", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "profileHash", type: "bytes32", indexed: true },
      { name: "registeredAt", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RecordAnchored",
    anonymous: false,
    inputs: [
      { name: "petKey", type: "bytes32", indexed: true },
      { name: "recordHash", type: "bytes32", indexed: true },
      { name: "recordType", type: "uint8", indexed: false },
      { name: "uri", type: "string", indexed: false },
      { name: "anchoredAt", type: "uint64", indexed: false },
    ],
  },
  { type: "error", name: "EmptyPetKey", inputs: [] },
  { type: "error", name: "EmptyProfileHash", inputs: [] },
  {
    type: "error",
    name: "PetAlreadyRegistered",
    inputs: [{ name: "petKey", type: "bytes32" }],
  },
  {
    type: "error",
    name: "PetNotRegistered",
    inputs: [{ name: "petKey", type: "bytes32" }],
  },
  { type: "error", name: "EmptyRecordHash", inputs: [] },
  {
    type: "error",
    name: "NotPetOwner",
    inputs: [
      { name: "petKey", type: "bytes32" },
      { name: "caller", type: "address" },
    ],
  },
] as const;
