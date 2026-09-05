/** 演示中可切换的访问角色。 */
export type DemoRole = 'owner' | 'invitee' | 'visitor';

/** 宠物物种，亲缘关系只允许同物种建立。 */
export type PetSpecies = 'cat' | 'dog';

/** 宠物性别，unknown 表示用户未填写。 */
export type PetGender = 'female' | 'male' | 'unknown';

/** 数字形象的预置风格。 */
export type AvatarStyle = '3d' | 'pixel' | 'illustration';

/** 监护关系的角色与生命周期状态。 */
export type GuardianRole = 'owner' | 'co_guardian';
export type GuardianStatus = 'accepted' | 'pending' | 'rejected';

/** 用户是预置演示用户还是后续业务创建的用户。 */
export type UserKind = 'seed' | 'demo';

/** 预置或演示用户。 */
export interface User {
  id: string;
  nickname: string;
  kind: UserKind;
  createdAt: string;
}

/** 宠物公开资料，所有页面通过 petId 关联。 */
export interface Pet {
  id: string;
  name: string;
  species: PetSpecies;
  breed: string;
  gender: PetGender;
  birthDate: string | null;
  coatColor: string;
  introduction: string;
  photoKey: string | null;
  avatarStyle: AvatarStyle;
  avatarAssetPath: string;
  avatarPresetLabel: string;
  publicProfile: {
    appearance: string;
    isLostVisible: boolean;
  };
  identityAccount: {
    network: string;
    address: string;
    createdAt: string;
    transactionId: string;
  };
  createdAt: string;
  updatedAt: string;
}

/** 宠物与用户之间的监护成员关系。 */
export interface GuardianLink {
  id: string;
  petId: string;
  userId: string;
  role: GuardianRole;
  status: GuardianStatus;
  joinedAt: string | null;
}

/** 共同监护邀请及其处理状态。 */
export type InviteStatus = 'pending' | 'accepted' | 'rejected';
export interface Invite {
  id: string;
  petId: string;
  inviterId: string;
  inviteeNickname: string;
  relation: 'co_guardian';
  token: string;
  status: InviteStatus;
  createdAt: string;
  acceptedAt: string | null;
}

/** 父母关系的申请方向与确认状态。 */
export type ParentRole = 'father' | 'mother';
export type RelationStatus = 'pending' | 'accepted' | 'rejected';
export interface Relation {
  id: string;
  childPetId: string;
  parentPetId: string;
  role: ParentRole;
  proposedBy: string;
  status: RelationStatus;
  createdAt: string;
  decidedAt: string | null;
}

/** 生命档案的事件类型。 */
export type LifeEventType = 'family' | 'health' | 'birthday' | 'travel' | 'daily';
export type LifeEventSource = 'system' | 'manual';
export type LifeEventVisibility = 'family' | 'public';

/** 宠物的生命档案记录。 */
export interface LifeEvent {
  id: string;
  petId: string;
  type: LifeEventType;
  title: string;
  date: string;
  description: string;
  photoKeys: string[];
  visibility: LifeEventVisibility;
  source: LifeEventSource;
  createdAt: string;
  updatedAt: string;
}

/** 生命档案凭证的来源标签。 */
export type CredentialSource = 'user_filled' | 'mutual_confirmed' | 'institution_demo';
export type CredentialStatus = 'valid' | 'expired' | 'pending';

/** 仅用于前端演示的身份、健康或血统凭证。 */
export interface Credential {
  id: string;
  petId: string;
  type: 'identity' | 'health' | 'lineage';
  title: string;
  issuer: string;
  issuedAt: string;
  status: CredentialStatus;
  source: CredentialSource;
  summary: string;
}

/** 积分变化明细，正数为收入，负数为支出。 */
export type PointEntryKind = 'seed' | 'reward' | 'redeem';
export interface PointEntry {
  id: string;
  petId: string;
  amount: number;
  balanceAfter: number;
  kind: PointEntryKind;
  taskKey: string | null;
  title: string;
  createdAt: string;
}

/** 固定装扮商品及其持有、穿戴状态。 */
export type InventoryItemCode = 'bow' | 'birthday_hat' | 'starry_cape';
export interface InventoryItem {
  id: string;
  petId: string;
  code: InventoryItemCode;
  name: string;
  price: number;
  assetPath: string;
  owned: boolean;
  equipped: boolean;
  purchasedAt: string | null;
}

/** 宠物获得的徽章。 */
export interface Badge {
  id: string;
  petId: string;
  code: 'identity_passport' | 'home_again';
  name: string;
  reason: string;
  earnedAt: string;
}

/** 寻宠事件生命周期。 */
export type LostCaseStatus = 'searching' | 'reported' | 'closed' | 'reunited';
export interface LostCase {
  id: string;
  petId: string;
  lastLocation: string;
  lostAt: string;
  description: string;
  status: LostCaseStatus;
  createdAt: string;
  closedAt: string | null;
}

/** PawTag 访客提交的发现线索。 */
export interface FoundReport {
  id: string;
  lostCaseId: string | null;
  petId: string;
  location: string;
  message: string;
  contact: string;
  createdAt: string;
}

/** 服务生态卡片的本地意向记录。 */
export interface ServiceInterest {
  serviceId: string;
  interested: boolean;
  updatedAt: string;
}

/** 创建身份页可恢复的草稿。 */
export interface CreateDraft {
  step: number;
  photoKey: string | null;
  name: string;
  species: PetSpecies;
  breed: string;
  gender: PetGender;
  birthDate: string | null;
  coatColor: string;
  introduction: string;
  avatarStyle: AvatarStyle;
  avatarAssetPath: string;
}

/** localStorage 中的完整、可序列化演示状态。 */
export interface DemoState {
  users: User[];
  pets: Pet[];
  guardianLinks: GuardianLink[];
  invites: Invite[];
  relations: Relation[];
  lifeEvents: LifeEvent[];
  credentials: Credential[];
  pointEntries: PointEntry[];
  inventoryItems: InventoryItem[];
  badges: Badge[];
  lostCases: LostCase[];
  foundReports: FoundReport[];
  serviceInterests: ServiceInterest[];
  currentRole: DemoRole;
  failNext: boolean;
  createDraft: CreateDraft | null;
  /** 已经完成的一次性操作键，用于抵抗重复提交。 */
  processedOperationKeys: string[];
}

/** 用于新增宠物的最小资料输入。 */
export interface CreatePetInput {
  /** UI 提交令牌，用于防止重复提交同一创建操作。 */
  requestId?: string;
  name: string;
  species: PetSpecies;
  breed?: string;
  gender?: PetGender;
  birthDate?: string | null;
  coatColor?: string;
  introduction?: string;
  photoKey?: string | null;
  avatarStyle?: AvatarStyle;
  avatarAssetPath?: string;
}

/** 用于编辑宠物公开资料的可选字段。 */
export interface UpdatePetInput {
  name?: string;
  gender?: PetGender;
  birthDate?: string | null;
  introduction?: string;
  coatColor?: string;
  avatarStyle?: AvatarStyle;
  avatarAssetPath?: string;
}

/** 用于邀请共同监护人的输入。 */
export interface CreateInviteInput {
  petId: string;
  inviteeNickname: string;
}

/** 用于新增父母关系申请的输入。 */
export interface CreateParentRelationInput {
  childPetId: string;
  parentPetId: string;
  role: ParentRole;
}

/** 新增生命档案的输入。 */
export interface LifeEventInput {
  petId: string;
  type: LifeEventType;
  title: string;
  date: string;
  description?: string;
  photoKeys?: string[];
  visibility?: LifeEventVisibility;
}

/** 标记走失的输入。 */
export interface LostCaseInput {
  petId: string;
  lastLocation: string;
  lostAt: string;
  description?: string;
}

/** 访客提交线索的输入。 */
export interface FoundReportInput {
  petId: string;
  location: string;
  message?: string;
  contact?: string;
}
