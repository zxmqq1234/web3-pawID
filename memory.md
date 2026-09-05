# PawID 基线开发记忆

## 今日状态

已建立 PawID 纯前端演示的 React + TypeScript + Vite 应用内核。当前分支为 `功能-20260905-pawid-frontend-demo`，未修改 master。PRD 已在 master 的初始提交中保存，源码只在任务白名单目录内开发。

## 技术栈

- React、TypeScript、Vite
- `react-router-dom` 的 `HashRouter`
- `lucide-react`、`qrcode.react`
- Context + `useReducer` 作为唯一业务状态源
- localStorage 结构化保存状态，IndexedDB 保存 `photoKey -> Blob`
- 原生 CSS Tokens，支持桌面和手机布局、键盘焦点、`prefers-reduced-motion`

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

## 分支与提交策略

先在 master 提交 PRD：`文档: 添加 PawID 演示需求`，再创建 `功能-20260905-pawid-frontend-demo` 开发分支。基线完成后只提交白名单内相关源码，不推送、不合并、不创建 worktree。

## 远程情况

已配置 `origin`：`https://gitee.com/ye_zhongji/20260905web3-paw-id.git`，执行过 `git fetch origin`。远程没有产生可用输出，网络或权限问题不影响本地基线交付，也没有删除或修改远程。

## 下一步

由后续功能智能体在 `src/features/**` 接入首页、创建身份、工作台总览、家庭族谱、生命档案、成长资产、防丢守护、邀请、PawTag 和服务生态页面。基线不包含具体业务页面，只提供 FeatureSlot、NotFound 和公共状态/UI 契约。
