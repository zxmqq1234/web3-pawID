# PawID 开发记忆
# 说明：记录当前分支、真实化状态与安全边界，历史提交事实保留但不误写为当前能力。

## 1. 当前分支
# 说明：本次文档任务只在隔离 worktree 操作。

- 当前分支：本次任务专用分支，分支名与 worktree 路径见 `git worktree list` 输出（分支 `文档-20260905-清理*字眼`，目录 `G:\工作办公\biancheng\pawid-worktrees\` 下）。
- 基线提交：`origin/main@0f6a5b5`。
- 远程：`https://github.com/zxmqq1234/web3-pawID.git`。
- 本分支只允许改动 `README.md`、`memory.md`、`docs/**`、`ASSET_SOURCES.md`、PRD 文件（已用 git mv 改名为 `PawID_Web3项目_PRD.md`）；`PPT/build.js` 与 `PPT/.gitignore` 在基线 `0f6a5b5` 上不存在，无需处理。
- 禁止修改产品源码、合约与接口代码、依赖清单文件与 PPT 二进制。

## 2. 真实化状态
# 说明：区分已完成与待完成，未完成事项一律标成待完成。

- 历史事实：早期前端版本使用本地状态（localStorage 与 IndexedDB）表达全部数据；当前版本已接入 Monad 测试网钱包与状态内核。
- 当前状态：GitHub main 分支已完成合并；公网前端 `http://web3.yrq666.xyz/` 已上线；MOJO 项目 399 已提交，状态 pending。
- 合约路线：Foundry + OpenZeppelin；合约与脚本代码已实现，尚未完成测试网真实部署与验证，`VITE_MONAD_REGISTRY_ADDRESS` 尚未配置。
- JWS 生图代理代码已实现，生产端点与新 Key 尚未部署配置。
- Foundry 尚未在本地运行部署流程。
- Registry 链上仅存 petKey、资料与记录 hash、owner、时间、可选公开 URI。
- 图像、视频与隐私资料放在链下，后续接 IPFS 或对象存储。
- 不强引入 Envio 索引器。
- 当前部署状态：待完成。
- 当前验证状态：待完成。
- 当前 Para 登录状态：待完成。
- 钱包连接：已实现；Registry 合约地址：未配置（待部署后回填）。

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
- 负责范围扫描旧定性关键词（任务给定的中英文新旧定性词清单，含英文大写标识类词）确认清零。
- 执行 `git diff --check` 确认无空白错误。
- 精确暂存白名单文件并提交，提交信息为 `文档: 更新 PawID 真实项目说明`。
- 外部人工待办：合约部署与验证、`VITE_MONAD_REGISTRY_ADDRESS` 回填、JWS 生产端点与新 Key 配置、Para 登录与配置、MOJO 项目 399 评审跟进、截图与视频备份，当前均为待完成或 pending。
- 验证优先使用官方验证 API `https://agents.devnads.com/v1/verify`，失败才走 Sourcify。

## 6. Git 状态
# 说明：记录本次文档提交结果，便于主 Agent 接手。

- 本次改动文件：`README.md`、`memory.md`、`ASSET_SOURCES.md`、`docs/monad-blitz-reference.md`、`PawID_Web3项目_PRD.md`（由旧版纯本地状态定性命名的 PRD 经 git mv 改名并改写，旧文件名已不在仓库中）。
- `.gitignore` 是否改动：未改动。
- 提交信息：`文档: 更新 PawID 真实项目说明`。
- 提交哈希：见本分支 `git log -1 --oneline`，以该命令输出为准。
- 校验结果：`git diff --check` 通过（2026-09-05，提交前已执行）。
- 已知残留：src 部分源码文件名/文案仍含旧定性词（如首页组件文案、本地状态存储组件文件名），源码不在本次授权范围，由后续任务处理。
