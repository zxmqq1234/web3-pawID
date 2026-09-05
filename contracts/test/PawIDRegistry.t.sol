// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// PawIDRegistry Foundry 单测：覆盖成功路径与全部冻结错误路径。
// 运行（需先安装 Foundry，并执行 forge install --no-git foundry-rs/forge-std）：
//   cd contracts && forge test -vv
// 注意：当前交付环境若缺 Foundry，本文件仍作为可审计的约定文本，不静默安装系统工具。

import {Test} from "forge-std/Test.sol";
import {PawIDRegistry} from "../src/PawIDRegistry.sol";

/// @notice PawIDRegistry 最小行为测试套件（中文注释，UTF-8）。
contract PawIDRegistryTest is Test {
    PawIDRegistry private registry;

    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);

    bytes32 private petKey = keccak256("pawid-pet-1");
    bytes32 private profileHash = keccak256("pawid-profile-1");
    bytes32 private recordHash = keccak256("pawid-record-1");

    /// @notice 每个用例前部署一份全新注册表，保证用例隔离。
    function setUp() public {
        registry = new PawIDRegistry();
    }

    /// @notice 登记成功：持久化归属/哈希/时间并触发事件。
    function test_RegisterPet_Success() public {
        vm.expectEmit(true, true, true, true);
        emit PawIDRegistry.PetRegistered(petKey, ALICE, profileHash, uint64(block.timestamp));

        vm.prank(ALICE);
        registry.registerPet(petKey, profileHash);

        (address owner, bytes32 storedHash, uint64 registeredAt) = registry.getPet(petKey);
        assertEq(owner, ALICE);
        assertEq(storedHash, profileHash);
        assertEq(registeredAt, uint64(block.timestamp));
        assertEq(registry.ownerOfPet(petKey), ALICE);
        assertTrue(registry.isPetRegistered(petKey));
    }

    /// @notice 空 petKey 必须 revert。
    function test_RevertWhen_RegisterPet_EmptyKey() public {
        vm.expectRevert(PawIDRegistry.EmptyPetKey.selector);
        registry.registerPet(bytes32(0), profileHash);
    }

    /// @notice 空 profileHash 必须 revert。
    function test_RevertWhen_RegisterPet_EmptyProfileHash() public {
        vm.expectRevert(PawIDRegistry.EmptyProfileHash.selector);
        registry.registerPet(petKey, bytes32(0));
    }

    /// @notice 重复登记同一 petKey 必须 revert。
    function test_RevertWhen_RegisterPet_DuplicateKey() public {
        vm.prank(ALICE);
        registry.registerPet(petKey, profileHash);

        vm.expectRevert(abi.encodeWithSelector(PawIDRegistry.PetAlreadyRegistered.selector, petKey));
        vm.prank(BOB);
        registry.registerPet(petKey, profileHash);
    }

    /// @notice 归属者锚定记录成功并触发事件。
    function test_AnchorRecord_Success() public {
        vm.prank(ALICE);
        registry.registerPet(petKey, profileHash);

        vm.expectEmit(true, true, false, true);
        emit PawIDRegistry.RecordAnchored(petKey, recordHash, 1, "ipfs://example", uint64(block.timestamp));

        vm.prank(ALICE);
        registry.anchorRecord(petKey, recordHash, 1, "ipfs://example");
    }

    /// @notice 空 recordHash 必须 revert。
    function test_RevertWhen_AnchorRecord_EmptyRecordHash() public {
        vm.prank(ALICE);
        registry.registerPet(petKey, profileHash);

        vm.expectRevert(PawIDRegistry.EmptyRecordHash.selector);
        vm.prank(ALICE);
        registry.anchorRecord(petKey, bytes32(0), 1, "");
    }

    /// @notice 未登记 petKey 的锚定必须 revert。
    function test_RevertWhen_AnchorRecord_PetNotRegistered() public {
        vm.expectRevert(abi.encodeWithSelector(PawIDRegistry.PetNotRegistered.selector, petKey));
        vm.prank(ALICE);
        registry.anchorRecord(petKey, recordHash, 1, "");
    }

    /// @notice 非归属者锚定必须 revert。
    function test_RevertWhen_AnchorRecord_NotOwner() public {
        vm.prank(ALICE);
        registry.registerPet(petKey, profileHash);

        vm.expectRevert(abi.encodeWithSelector(PawIDRegistry.NotPetOwner.selector, petKey, BOB));
        vm.prank(BOB);
        registry.anchorRecord(petKey, recordHash, 1, "");
    }

    /// @notice 未登记 key 的 getPet 必须 revert。
    function test_RevertWhen_GetPet_NotRegistered() public {
        vm.expectRevert(abi.encodeWithSelector(PawIDRegistry.PetNotRegistered.selector, petKey));
        registry.getPet(petKey);
    }

    /// @notice 未登记 key 的 ownerOfPet 必须 revert。
    function test_RevertWhen_OwnerOfPet_NotRegistered() public {
        vm.expectRevert(abi.encodeWithSelector(PawIDRegistry.PetNotRegistered.selector, petKey));
        registry.ownerOfPet(petKey);
    }

    /// @notice 未登记 key 的 isPetRegistered 返回 false（只读预检，不 revert）。
    function test_IsPetRegistered_FalseWhenUnknown() public view {
        assertFalse(registry.isPetRegistered(petKey));
    }
}
