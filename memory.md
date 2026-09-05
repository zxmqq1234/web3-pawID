# PawID 基线开发记忆

## 今日状态

已完成 PawID 纯前端演示的 React + TypeScript + Vite 全量功能集成。当前分支为 `功能-20260905-pawid-frontend-demo`，未修改 master；七个功能分支均已通过普通 merge 进入本分支，当前集成基线 HEAD 为 `5e352df`。

## 技术栈与边界

- React、TypeScript、Vite
- `react-router-dom` 的 `HashRouter`
- `lucide-react`、`qrcode.react`
- Context + `useReducer` 作为唯一业务状态源
- localStorage 结构化保存状态，IndexedDB 保存 `photoKey -> Blob`
- 原生 CSS Tokens，支持桌面和手机布局、键盘焦点、`prefers-reduced-motion`
- 纯前端演示，不连接真实链、钱包、支付、定位、通知或外部 API；无需 API Key 或钱包

## 公共契约

- 领域模型：`src/domain/types.ts`
- 不可变种子：`src/domain/seed.ts`
- Store：`src/store/DemoProvider.tsx`
- reducer 与统一模拟异步操作：`src/store/actions.ts`
- 派生查询：`src/store/selectors.ts`
- 存储：`src/store/storage.ts`
- 共享 UI：`src/shared/ui.tsx`
- 路由应用壳：`src/app/App.tsx`

业务页面直接使用 `useDemoStore()` 获取 `state`、`actions`、`selectors`。稳定 action 包括 `createPet`、`updatePet`、`createInvite`、`decideInvite`、`createParentRelation`、`decideRelation`、`addLifeEvent`、`updateLifeEvent`、`deleteLifeEvent`、`redeemItem`、`equipItem`、`openLostCase`、`addFoundReport`、`closeLostCase`、`toggleInterest`、`setRole`、`setFailNext`、`saveCreateDraft`、`clearCreateDraft`、`resetDemo`。

## 资源与提交记录

- 资源提交：`f9120f7`、`60bc044`
- 七笔功能提交：`72fb3a6`（首页与服务生态）、`4277df6`（创建向导）、`70a094f`（工作台总览与消息）、`22b2d0d`（家庭邀请与宠物族谱）、`0c95b8d`（生命档案）、`1a1c15e`（成长资产）、`e4092b0`（防丢守护与 PawTag）
- 七笔 merge 提交已进入当前集成 HEAD：`4257c37`、`c56572a`、`b2d250d`、`992982d`、`0be0923`、`25bdbd6`、`5e352df`
- 种子中的旧 `/src/assets/**` 头像路径由应用层回退解析到实际 `/assets/**`；不修改种子数据
- 原创 SVG 只称宠物肖像、预置宠物肖像或界面插图，不称真实照片

## 路由完成状态

- `#/` -> `HomePage`
- `#/create` -> `CreateWizard`
- `#/pets/:id` -> 读取 `id` 与 `?tab=`，无效 tab 回落 `overview`；有效 tab 由 `WorkbenchLayout` 包裹并进入 `OverviewPage`、`FamilyPage`、`LifePage`、`AssetsPage` 或 `SafetyPage`；不存在的宠物显示解释型 `NotFoundPage`
- `#/invite/:inviteId` -> `InviteConfirmPage`
- `#/tag/:id` -> `TagVisitorPage`
- `#/ecosystem` -> `EcosystemPage`
- 其他路径 -> `NotFoundPage`
- 根部仅保留一份 `DemoProvider + ToastProvider + HashRouter`；工作台复用自身消息抽屉，首页、创建、生态和公开页提供演示控制入口

## 分支、验证与远程

分支为 `功能-20260905-pawid-frontend-demo`，不推送、不改写 merge 历史。最终验证结果占位：

- `npm test -- --run`：待最终收口执行
- `npm run build`：待最终收口执行
- `git diff --check`：待最终收口执行
- 指定 rg 搜索：待最终收口执行
- 最终集成提交：待最终收口执行

远程仍待推送。远程地址为 `https://gitee.com/ye_zhongji/20260905web3-paw-id.git`，网络或权限问题不影响本地交付。
