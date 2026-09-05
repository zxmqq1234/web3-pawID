// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title PawIDRegistry 宠物身份登记与记录锚定最小注册表（Monad Testnet）
/// @notice 链上仅存储哈希、地址、时间戳与可选 URI；不存储宠物姓名、健康详情、
///         联系方式、图片或任何身份敏感资料。敏感资料只保存在链下，链上仅存其哈希承诺。
/// @dev 无管理员角色，因此不引入 Ownable（避免中心化后门，保持最小权限）；
///      错误采用 OpenZeppelin 风格的自定义错误（custom error），节省 gas 且便于前端解析。
///      编译器版本固定为 0.8.28，验证载荷中的 compilerVersion 必须与实际编译产物一致。
contract PawIDRegistry {
    /// @notice 单只宠物的链上核心资料（仅哈希与归属，不含敏感明文）。
    struct Pet {
        address owner; // 登记人，即该 petKey 的归属者
        bytes32 profileHash; // 链下宠物资料的哈希承诺
        uint64 registeredAt; // 登记时间（block.timestamp 截断为 uint64）
    }

    /// @notice petKey 到宠物资料的映射，未登记的 key 对应 owner 为零地址。
    mapping(bytes32 => Pet) private _pets;

    /// @notice 宠物登记成功事件。
    event PetRegistered(
        bytes32 indexed petKey,
        address indexed owner,
        bytes32 indexed profileHash,
        uint64 registeredAt
    );

    /// @notice 宠物记录锚定成功事件（recordHash 为链下记录的哈希承诺，uri 为可选链下定位符）。
    event RecordAnchored(
        bytes32 indexed petKey,
        bytes32 indexed recordHash,
        uint8 recordType,
        string uri,
        uint64 anchoredAt
    );

    /// @notice petKey 为空（bytes32(0)）。
    error EmptyPetKey();
    /// @notice profileHash 为空（bytes32(0)）。
    error EmptyProfileHash();
    /// @notice petKey 已被登记。
    error PetAlreadyRegistered(bytes32 petKey);
    /// @notice petKey 尚未登记。
    error PetNotRegistered(bytes32 petKey);
    /// @notice recordHash 为空（bytes32(0)）。
    error EmptyRecordHash();
    /// @notice 调用者不是该 petKey 的归属者。
    error NotPetOwner(bytes32 petKey, address caller);

    /// @notice 登记一只宠物，任何账户均可为未被使用的 petKey 登记。
    /// @param petKey 宠物唯一键（链下派生），不可为零、不可重复。
    /// @param profileHash 链下宠物资料的哈希承诺，不可为零。
    function registerPet(bytes32 petKey, bytes32 profileHash) external {
        if (petKey == bytes32(0)) revert EmptyPetKey();
        if (profileHash == bytes32(0)) revert EmptyProfileHash();
        if (_pets[petKey].owner != address(0)) revert PetAlreadyRegistered(petKey);

        uint64 registeredAt = uint64(block.timestamp);
        _pets[petKey] = Pet({owner: msg.sender, profileHash: profileHash, registeredAt: registeredAt});

        emit PetRegistered(petKey, msg.sender, profileHash, registeredAt);
    }

    /// @notice 为已登记宠物锚定一条链下记录的哈希承诺，仅归属者可调用。
    /// @param petKey 已登记的宠物唯一键。
    /// @param recordHash 链下记录的哈希承诺，不可为零。
    /// @param recordType 记录类型（链下约定编号，合约仅透传不解释）。
    /// @param uri 可选的链下定位符（如 IPFS 引用），合约仅存储不校验。
    function anchorRecord(bytes32 petKey, bytes32 recordHash, uint8 recordType, string calldata uri) external {
        if (recordHash == bytes32(0)) revert EmptyRecordHash();
        Pet memory pet = _pets[petKey];
        if (pet.owner == address(0)) revert PetNotRegistered(petKey);
        if (pet.owner != msg.sender) revert NotPetOwner(petKey, msg.sender);

        emit RecordAnchored(petKey, recordHash, recordType, uri, uint64(block.timestamp));
    }

    /// @notice 读取宠物的归属与核心资料，未登记则 revert。
    /// @param petKey 宠物唯一键。
    /// @return owner 归属者地址。
    /// @return profileHash 链下资料哈希承诺。
    /// @return registeredAt 登记时间。
    function getPet(bytes32 petKey) external view returns (address owner, bytes32 profileHash, uint64 registeredAt) {
        Pet memory pet = _pets[petKey];
        if (pet.owner == address(0)) revert PetNotRegistered(petKey);
        return (pet.owner, pet.profileHash, pet.registeredAt);
    }

    /// @notice 读取宠物归属者，未登记则 revert。
    /// @param petKey 宠物唯一键。
    /// @return 归属者地址。
    function ownerOfPet(bytes32 petKey) external view returns (address) {
        address owner = _pets[petKey].owner;
        if (owner == address(0)) revert PetNotRegistered(petKey);
        return owner;
    }

    /// @notice 最小只读辅助：查询 petKey 是否已登记（供前端预检，不扩展功能）。
    /// @param petKey 宠物唯一键。
    /// @return 已登记返回 true，否则返回 false。
    function isPetRegistered(bytes32 petKey) external view returns (bool) {
        return _pets[petKey].owner != address(0);
    }
}
