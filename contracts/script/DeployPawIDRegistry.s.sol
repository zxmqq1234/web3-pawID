// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// 仅本地安全环境使用的开发部署脚本（回退方案，默认不执行）。
// 说明：
// - 正式部署方案按 Monskill 留出 Alchemy Agent Wallet + CreateX CREATE2 通道，
//   但当前 monskill 缺失 wallet 子 skill，禁止猜测 alchemy 命令，故此处仅提供
//   接收本地 Foundry 签名的开发回退脚本，并明确标注“仅本地安全环境”。
// - 本脚本无构造函数参数；PawIDRegistry 部署不需要构造参数，验证时 constructorArgs 为空。
// - 绝不在本仓库写入私钥；签名统一走 forge script 的 --private-key / --ledger 等外部参数。
// 本地示例（仅回退、仅本地链，默认不执行）：
//   cd contracts
//   forge script script/DeployPawIDRegistry.s.sol:DeployPawIDRegistry \
//     --rpc-url http://127.0.0.1:8545 --broadcast

import {Script, console} from "forge-std/Script.sol";
import {PawIDRegistry} from "../src/PawIDRegistry.sol";

/// @notice 部署 PawIDRegistry 的本地开发脚本。
contract DeployPawIDRegistry is Script {
    /// @notice 广播部署并打印地址；调用方负责提供籤名与 RPC。
    function run() external returns (PawIDRegistry deployed) {
        vm.startBroadcast();
        deployed = new PawIDRegistry();
        vm.stopBroadcast();
        console.log("PawIDRegistry deployed at:", address(deployed));
    }
}
