# PawID 开发记忆
# 说明：记录当前分支、真实化状态与安全边界，历史提交事实保留但不误写为当前能力。

## 1. 当前分支
# 说明：本次文档任务只在隔离分支操作。

- 当前分支：`文档-20260905-pawid-monad-rules`。
- 隔离目录：`G:\工作办公\biancheng\20260905web3-pawID-monad-docs`。
- 基线提交：`473efc2`。
- 远程：`https://gitee.com/ye_zhongji/20260905web3-paw-id.git`。
- 本分支只允许改动 `.monskills`、`docs/monad-blitz-reference.md`、`README.md`、`memory.md`，以及确有缺失时最小补充 `.gitignore`。
- 禁止修改历史 PRD、产品源码、合约与接口代码、依赖清单文件。

## 2. 真实化状态
# 说明：区分历史本地链路与当前真实目标，未完成事项一律标成待完成。

- 历史事实：`473efc2` 及之前分支完成了 React + TypeScript + Vite 本地链路集成，本地状态使用 localStorage 与 IndexedDB。
- 当前真实目标：Monad 测试网部署，Vite + React + HashRouter 前端使用 Wagmi 与 Viem 连接 Monad。
- 合约路线：Foundry + OpenZeppelin。
- Registry 链上仅存 petKey、资料与记录 hash、owner、时间、可选公开 URI。
- 图像、视频与隐私资料放在链下，后续接 IPFS 或对象存储。
- 不强引入 Envio 索引器。
- 当前部署状态：待完成。
- 当前验证状态：待完成。
- 当前公网前端状态：待完成。
- 当前 MOJO 提交状态：待完成。
- 钱包地址：留空（待完成）。
- Registry 合约地址：留空（待完成）。

## 3. Monskill 规则
# 说明：活动识别所需的强制元数据。

- 根目录 `.monskills` 必须包含：`built-with=monskills`，`chain=monad-testnet`。
- Monad Testnet RPC：`https://testnet-rpc.monad.xyz`。
- Chain ID：十进制 `10143`，十六进制 `0x279F`。
- 水龙头：`https://testnet.monad.xyz`。
- 主要 Explorer：`https://testnet.monadexplorer.com/`。
- 备用 Explorer：`https://monad-testnet.socialscan.io/`。
- 活动资料读取日期：2026-09-05，活动内页准确链接待用户补充，不虚构 URL。

## 4. 密钥边界
# 说明：安全红线，任何文件都不记录敏感内容。

- 密钥只放在服务端环境变量中，不要放进浏览器、URL、客户端日志或公开仓库。
- JWS 生图只经服务端 `/api/ai/*` 代理。
- 已在对话中出现过的 JWS Key 必须轮换，不得复用或记录。
- Para 集成位仅在用户完成 Para CLI 登录与项目配置后启用，不写入任何 Para Key。
- 活动账号仅用于外部网页登录与 MOJO 流程，绝不写入 README、memory、代码或任何提交。
- 禁止任何密钥、私钥、助记词、活动账号或邮箱进入文件。

## 5. 验证待办
# 说明：文档提交前的最小校验与外部人工动作。

- 文档扫描确认无用户账号、邮箱、API Key、私钥、助记词。
- 执行 `git diff --check` 确认无空白错误。
- 精确暂存白名单文件并提交，提交信息为 `文档: 添加 Monad Blitz 交付规则`。
- 外部人工待办：测试币领取、合约部署与验证、Para 登录与配置、公网前端发布、MOJO 提交、截图与视频备份，当前均为待完成。
- 验证优先使用官方验证 API `https://agents.devnads.com/v1/verify`，失败才走 Sourcify。

## 6. Git 状态
# 说明：记录本次文档提交结果，便于主 Agent 接手。

- 本次改动文件：`.monskills`、`docs/monad-blitz-reference.md`、`README.md`、`memory.md`。
- `.gitignore` 是否改动：未改动；原有 `.env.*` 与 `*.local` 已覆盖 `.env.local`，无需补充。
- 提交信息：`文档: 添加 Monad Blitz 交付规则`。
- 提交哈希：见本分支 `git log -1 --oneline`，以该命令输出为准。
- 校验结果：`git diff --check` 通过（2026-09-05，提交前已执行）。
