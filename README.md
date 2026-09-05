# PawID
# 说明：面向宠物的数字生命护照，身份、家庭共同监护、成长记录、防丢协作与服务生态在同一链路中表达。

## 1. 项目定位与比赛口径
# 说明：讲清产品要交付什么，以及活动硬性门槛在哪里。

- PawID 把宠物身份、家庭共同监护、成长记录、防丢协作和服务生态放在同一条可理解的体验链路中。
- 目标链为 Monad 测试网，前端公网持续可访问，代码与材料公开。
- 比赛为一天线下高强度迷你黑客马拉松，比赛期间启动原创项目，不要求完整商业化产品。
- 团队最多 3 人，通过 MOJO 提交 Logo、预览图、项目介绍、预览链接、公开 GitHub 链接。
- 五分钟实机展示重点为 Monad 测试网、技术、创新与挑战，评审维度为核心要求、完成度、商业模型。
- 详细交付口径见 `docs/monad-blitz-reference.md`，资料读取日期为 2026-09-05，活动内页准确链接待用户补充，本文不虚构 URL。

## 2. 当前状态
# 说明：区分已完成与待完成，未完成事项保持待完成表述，不虚构进度。

- 代码状态：GitHub main 分支已完成合并。
- 公网前端：`http://web3.yrq666.xyz/` 已上线。
- MOJO 提交：项目 399 已提交，状态 pending。
- 钱包与状态内核：Monad 测试网钱包连接与状态内核已实现（Wagmi + Viem）。
- Registry 合约：合约与脚本代码已实现（Foundry + OpenZeppelin），尚未完成测试网真实部署与验证，`VITE_MONAD_REGISTRY_ADDRESS` 尚未配置。
- JWS 生图代理：`/api/ai/*` 代理代码已实现，生产端点与新 Key 尚未部署配置。
- Foundry：尚未在本地运行过部署流程。

## 3. Monskill 与网络配置
# 说明：统一构建标记与测试网参数，前端、钱包、合约使用同一网络。

- Monskill 标记：`built-with=monskills`，`chain=monad-testnet`，见根目录 `.monskills`。
- Monad Testnet RPC：`https://testnet-rpc.monad.xyz`。
- Chain ID：十进制 `10143`，十六进制 `0x279F`。
- 水龙头：`https://testnet.monad.xyz`。
- 主要 Explorer：`https://testnet.monadexplorer.com/`。
- 备用 Explorer：`https://monad-testnet.socialscan.io/`。
- Registry 合约地址：未配置（`VITE_MONAD_REGISTRY_ADDRESS` 待部署后回填）。

## 4. 真实架构
# 说明：讲清链上与链下边界，避免把本地状态误当链上能力。

- 合约路线为 Foundry + OpenZeppelin，合约先部署并通过官方验证 API；当前部署与验证状态均为待完成。
- Registry 链上仅存 petKey、资料与记录 hash、owner、时间、可选公开 URI。
- 图像、视频与隐私资料放在链下，后续接 IPFS 或对象存储。
- 不强引入 Envio 索引器。
- 前端路线为 Vite + React + HashRouter，使用 Wagmi 与 Viem 连接 Monad；非链上数据在浏览器本地状态中持久化（localStorage 与 IndexedDB）。
- Para 集成位仅在用户完成 Para CLI 登录与项目配置后启用，不写入任何 Para Key，当前状态为待完成。
- JWS 生图只经服务端 `/api/ai/*` 代理。
- 密钥只放在服务端环境变量中，不要放进浏览器、URL、客户端日志或公开仓库。
- 已在对话中出现过的 JWS Key 必须轮换，不得复用或记录。
- 活动账号仅用于外部网页登录与 MOJO 流程，绝不写入 README、memory、代码或任何提交。

## 5. 本地启动
# 说明：在本机跑起前端的最小步骤。

- 需要 Node.js 当前 LTS 版本与 npm。
- 安装依赖：`npm ci`。
- 启动开发服务：`npm run dev`。
- 运行测试：现有脚本为 `npm test`，对应 `vitest run`，完成对应模块后按实际用例执行。
- 构建产物：`npm run build`，对应 `tsc -b && vite build`，完成对应模块后执行。
- 本地预览构建结果：`npm run preview`，完成对应模块后执行。
- 应用使用 HashRouter，开发服务与静态部署均从 `#/` 路由进入。

## 6. 合约与验证操作
# 说明：合约部署前的操作口径，未完成前保持待完成表述。

- 部署前先在本地运行 Foundry 流程，当前尚未执行（待完成）。
- 在 Monad 测试网部署 Registry 合约，并记录合约地址与交易哈希（待完成）。
- 验证优先使用官方验证 API `https://agents.devnads.com/v1/verify`，失败才走 Sourcify。
- 验证完成后保留 Explorer 验证链接，并在文档中回填地址与链接。
- 当前部署状态：待完成。
- 当前验证状态：待完成。

## 7. 服务端与 API 环境
# 说明：服务端代理的当前口径，不记录任何密钥内容。

- 服务端提供 `/api/ai/*` 代理，前端不直连生图密钥，代理代码已实现。
- 生产端点与新 Key 尚未部署配置（待完成）。
- 密钥只放在服务端环境变量中，不要放进浏览器、URL、客户端日志或公开仓库。
- 当前 JWS Key 状态：待轮换，不记录、不复用。

## 8. 路由
# 说明：前端页面入口对照表。

- `#/`：首页。
- `#/create`：创建 PawID。
- `#/pets/:id?tab=overview|family|life|assets|safety`：宠物工作台。
- `#/invite/:inviteId`：邀请确认公开页。
- `#/tag/:id`：PawTag 访客公开页。
- `#/ecosystem`：服务生态。

## 9. 当前待完成事项
# 说明：明确外部动作尚未完成，避免对外误报进度。

- Registry 合约测试网部署与验证：待完成。
- `VITE_MONAD_REGISTRY_ADDRESS` 配置与链上存证链路启用：待完成。
- JWS 生产端点部署与新 Key 配置：待完成。
- Para CLI 登录与项目配置：待完成。
- MOJO 提交评审结果跟进：项目 399 当前 pending。
- Logo、预览图、项目介绍、备份截图与视频：待完成。
