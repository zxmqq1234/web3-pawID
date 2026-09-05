import type {
  Badge,
  Credential,
  DemoState,
  GuardianLink,
  InventoryItem,
  LifeEvent,
  Pet,
  PointEntry,
  Relation,
  User,
} from './types';

/** 种子数据使用固定时间，保证刷新和测试时初始演示内容稳定。 */
const SEED_TIME = '2026-01-01T08:00:00.000Z';

/** 递归冻结种子对象，运行时通过 cloneSeedState 获取可写副本。 */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

/** 预置用户：小林是示例主监护人，阿宁用于邀请体验。 */
const users: User[] = [
  { id: 'user-xiaolin', nickname: '小林', kind: 'seed', createdAt: SEED_TIME },
  { id: 'user-aning', nickname: '阿宁', kind: 'seed', createdAt: SEED_TIME },
];

/** 预置宠物资料，所有宠物都带有公开字段、数字形象和模拟身份账户。 */
const pets: Pet[] = [
  {
    id: 'mochi', name: 'Mochi', species: 'cat', breed: '英短', gender: 'female', birthDate: '2023-05-20',
    coatColor: '奶油白', introduction: '一只喜欢在窗边晒太阳的温柔猫咪。', photoKey: 'seed-mochi-photo',
    avatarStyle: '3d', avatarAssetPath: '/src/assets/avatars/mochi-3d.svg', avatarPresetLabel: '预置形象演示',
    publicProfile: { appearance: '奶油白短毛、圆脸、粉色鼻尖', isLostVisible: true },
    identityAccount: { network: 'Monad（模拟网络）', address: '0xMOCHI_DEMO_8F21', createdAt: SEED_TIME, transactionId: 'tx-mochi-create-demo' },
    createdAt: SEED_TIME, updatedAt: SEED_TIME,
  },
  {
    id: 'leo', name: 'Leo', species: 'cat', breed: '橘白短毛', gender: 'male', birthDate: '2021-08-11',
    coatColor: '橘白', introduction: '可靠又有耐心的橘色猫咪。', photoKey: 'seed-leo-photo',
    avatarStyle: 'pixel', avatarAssetPath: '/src/assets/avatars/leo-pixel.svg', avatarPresetLabel: '预置形象演示',
    publicProfile: { appearance: '橘白相间短毛、琥珀色眼睛', isLostVisible: true },
    identityAccount: { network: 'Monad（模拟网络）', address: '0xLEO_DEMO_37AC', createdAt: SEED_TIME, transactionId: 'tx-leo-seed-demo' },
    createdAt: SEED_TIME, updatedAt: SEED_TIME,
  },
  {
    id: 'coco', name: 'Coco', species: 'cat', breed: '布偶猫', gender: 'female', birthDate: '2021-04-02',
    coatColor: '海豹双色', introduction: '安静亲人的蓝眼睛猫咪。', photoKey: 'seed-coco-photo',
    avatarStyle: 'illustration', avatarAssetPath: '/src/assets/avatars/coco-illustration.svg', avatarPresetLabel: '预置形象演示',
    publicProfile: { appearance: '海豹双色长毛、蓝色眼睛', isLostVisible: true },
    identityAccount: { network: 'Monad（模拟网络）', address: '0xCOCO_DEMO_4D18', createdAt: SEED_TIME, transactionId: 'tx-coco-seed-demo' },
    createdAt: SEED_TIME, updatedAt: SEED_TIME,
  },
  {
    id: 'luna', name: 'Luna', species: 'cat', breed: '混血短毛', gender: 'female', birthDate: '2023-05-20',
    coatColor: '银灰', introduction: 'Mochi 的预置同父母姐妹，活泼好奇。', photoKey: 'seed-luna-photo',
    avatarStyle: '3d', avatarAssetPath: '/src/assets/avatars/luna-3d.svg', avatarPresetLabel: '预置形象演示',
    publicProfile: { appearance: '银灰短毛、额头有浅色纹路', isLostVisible: true },
    identityAccount: { network: 'Monad（模拟网络）', address: '0xLUNA_DEMO_91B2', createdAt: SEED_TIME, transactionId: 'tx-luna-seed-demo' },
    createdAt: SEED_TIME, updatedAt: SEED_TIME,
  },
  {
    id: 'grandma-olive', name: 'Olive', species: 'cat', breed: '英短', gender: 'female', birthDate: '2017-02-14',
    coatColor: '银灰', introduction: '族谱中的预置祖辈节点。', photoKey: 'seed-olive-photo',
    avatarStyle: 'pixel', avatarAssetPath: '/src/assets/avatars/olive-pixel.svg', avatarPresetLabel: '预置形象演示',
    publicProfile: { appearance: '银灰短毛、绿色眼睛', isLostVisible: true },
    identityAccount: { network: 'Monad（模拟网络）', address: '0xOLIVE_DEMO_702A', createdAt: SEED_TIME, transactionId: 'tx-olive-seed-demo' },
    createdAt: SEED_TIME, updatedAt: SEED_TIME,
  },
  {
    id: 'grandpa-milo', name: 'Milo', species: 'cat', breed: '英短', gender: 'male', birthDate: '2016-09-30',
    coatColor: '蓝灰', introduction: '族谱中的预置祖辈节点。', photoKey: 'seed-milo-photo',
    avatarStyle: '3d', avatarAssetPath: '/src/assets/avatars/milo-3d.svg', avatarPresetLabel: '预置形象演示',
    publicProfile: { appearance: '蓝灰短毛、金色眼睛', isLostVisible: true },
    identityAccount: { network: 'Monad（模拟网络）', address: '0xMILO_DEMO_51E0', createdAt: SEED_TIME, transactionId: 'tx-milo-seed-demo' },
    createdAt: SEED_TIME, updatedAt: SEED_TIME,
  },
  {
    id: 'grandma-nala', name: 'Nala', species: 'cat', breed: '布偶猫', gender: 'female', birthDate: '2016-06-18',
    coatColor: '奶油双色', introduction: '族谱中的预置祖辈节点。', photoKey: 'seed-nala-photo',
    avatarStyle: 'illustration', avatarAssetPath: '/src/assets/avatars/nala-illustration.svg', avatarPresetLabel: '预置形象演示',
    publicProfile: { appearance: '奶油双色长毛、蓝色眼睛', isLostVisible: true },
    identityAccount: { network: 'Monad（模拟网络）', address: '0xNALA_DEMO_8B4C', createdAt: SEED_TIME, transactionId: 'tx-nala-seed-demo' },
    createdAt: SEED_TIME, updatedAt: SEED_TIME,
  },
  {
    id: 'grandpa-simba', name: 'Simba', species: 'cat', breed: '布偶猫', gender: 'male', birthDate: '2015-11-09',
    coatColor: '海豹重点色', introduction: '族谱中的预置祖辈节点。', photoKey: 'seed-simba-photo',
    avatarStyle: 'pixel', avatarAssetPath: '/src/assets/avatars/simba-pixel.svg', avatarPresetLabel: '预置形象演示',
    publicProfile: { appearance: '海豹重点色长毛、蓝色眼睛', isLostVisible: true },
    identityAccount: { network: 'Monad（模拟网络）', address: '0xSIMBA_DEMO_6C7D', createdAt: SEED_TIME, transactionId: 'tx-simba-seed-demo' },
    createdAt: SEED_TIME, updatedAt: SEED_TIME,
  },
];

/** 仅让 Mochi 拥有确认母亲，保留新增父亲体验；Luna 与双亲关联以派生姐妹。 */
const guardianLinks: GuardianLink[] = [
  { id: 'guardian-mochi-owner', petId: 'mochi', userId: 'user-xiaolin', role: 'owner', status: 'accepted', joinedAt: SEED_TIME },
];

/** 预置关系覆盖 Luna 的双亲与 Mochi 的母亲，并连接四个祖辈。 */
const relations: Relation[] = [
  { id: 'relation-luna-leo', childPetId: 'luna', parentPetId: 'leo', role: 'father', proposedBy: 'system', status: 'accepted', createdAt: SEED_TIME, decidedAt: SEED_TIME },
  { id: 'relation-luna-coco', childPetId: 'luna', parentPetId: 'coco', role: 'mother', proposedBy: 'system', status: 'accepted', createdAt: SEED_TIME, decidedAt: SEED_TIME },
  { id: 'relation-mochi-coco', childPetId: 'mochi', parentPetId: 'coco', role: 'mother', proposedBy: 'system', status: 'accepted', createdAt: SEED_TIME, decidedAt: SEED_TIME },
  { id: 'relation-leo-milo', childPetId: 'leo', parentPetId: 'grandpa-milo', role: 'father', proposedBy: 'system', status: 'accepted', createdAt: SEED_TIME, decidedAt: SEED_TIME },
  { id: 'relation-leo-olive', childPetId: 'leo', parentPetId: 'grandma-olive', role: 'mother', proposedBy: 'system', status: 'accepted', createdAt: SEED_TIME, decidedAt: SEED_TIME },
  { id: 'relation-coco-simba', childPetId: 'coco', parentPetId: 'grandpa-simba', role: 'father', proposedBy: 'system', status: 'accepted', createdAt: SEED_TIME, decidedAt: SEED_TIME },
  { id: 'relation-coco-nala', childPetId: 'coco', parentPetId: 'grandma-nala', role: 'mother', proposedBy: 'system', status: 'accepted', createdAt: SEED_TIME, decidedAt: SEED_TIME },
];

/** Mochi 的六条预置生命记录，均为系统演示资料，不触发首次手动奖励。 */
const lifeEvents: LifeEvent[] = [
  { id: 'event-mochi-created', petId: 'mochi', type: 'family', title: 'Mochi 的 PawID 创建', date: '2023-05-20', description: '预置身份创建事件。', photoKeys: [], visibility: 'family', source: 'system', createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'event-mochi-birthday-1', petId: 'mochi', type: 'birthday', title: '第一次生日', date: '2024-05-20', description: '和家人一起度过的第一个生日。', photoKeys: [], visibility: 'family', source: 'system', createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'event-mochi-vaccine', petId: 'mochi', type: 'health', title: '年度疫苗接种', date: '2024-06-08', description: '预置健康记录演示。', photoKeys: [], visibility: 'family', source: 'system', createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'event-mochi-trip', petId: 'mochi', type: 'travel', title: '第一次短途旅行', date: '2024-10-03', description: '第一次和家人一起出门旅行。', photoKeys: [], visibility: 'family', source: 'system', createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'event-mochi-checkup', petId: 'mochi', type: 'health', title: '健康检查', date: '2025-02-21', description: '预置健康记录演示。', photoKeys: [], visibility: 'family', source: 'system', createdAt: SEED_TIME, updatedAt: SEED_TIME },
  { id: 'event-mochi-window', petId: 'mochi', type: 'daily', title: '窗边的新窝', date: '2025-09-12', description: 'Mochi 找到了最喜欢的晒太阳位置。', photoKeys: [], visibility: 'family', source: 'system', createdAt: SEED_TIME, updatedAt: SEED_TIME },
];

/** 预置凭证明确标识为机构认证示例，不暗示真实机构签发。 */
const credentials: Credential[] = [
  { id: 'credential-mochi-identity', petId: 'mochi', type: 'identity', title: '身份凭证（示例）', issuer: 'PawID 演示机构', issuedAt: '2023-05-20', status: 'valid', source: 'institution_demo', summary: '机构认证（示例），仅用于演示身份卡片。' },
  { id: 'credential-mochi-health', petId: 'mochi', type: 'health', title: '疫苗记录（示例）', issuer: 'PawID 演示机构', issuedAt: '2024-06-08', status: 'valid', source: 'institution_demo', summary: '机构认证（示例），不代表真实医疗数据。' },
];

/** 初始 100 PAWS 作为种子明细，后续余额统一由明细求和。 */
const pointEntries: PointEntry[] = [
  { id: 'points-mochi-seed', petId: 'mochi', amount: 100, balanceAfter: 100, kind: 'seed', taskKey: null, title: '演示初始余额', createdAt: SEED_TIME },
];

/** 固定三件资产目录；种子宠物初始不持有任何装扮。 */
const inventoryItems: InventoryItem[] = [];

/** Mochi 的初始身份徽章。 */
const badges: Badge[] = [
  { id: 'badge-mochi-identity', petId: 'mochi', code: 'identity_passport', name: 'Identity Passport', reason: '完成 PawID 身份创建（演示）', earnedAt: SEED_TIME },
];

/** 复制种子状态时不共享数组和对象引用，避免 reducer 改写不可变种子。 */
export const SEED_STATE = deepFreeze<DemoState>({
  users,
  pets,
  guardianLinks,
  invites: [],
  relations,
  lifeEvents,
  credentials,
  pointEntries,
  inventoryItems,
  badges,
  lostCases: [],
  foundReports: [],
  serviceInterests: [],
  currentRole: 'owner',
  failNext: false,
  createDraft: null,
  processedOperationKeys: [],
});

/** 返回一份可供 Provider 使用的全新种子状态。 */
export function cloneSeedState(): DemoState {
  return structuredClone(SEED_STATE);
}
