# 《潮痕之城》技术文档

## 1. 技术栈

- 前端：React 18、TypeScript 5、Less、Vite 5，`base: './'`。
- 状态：追加式世界事件 + 纯函数 reducer；Web Audio 程序化音景。
- 远端：Cloudflare Worker + Durable Object + SQLite，由补充了 `dist/` 静态打包能力的 `alteru-game-backend` Skill 部署到永久 session ID 路径 `https://game.aiwaves.tech/1a2916b0-8751-4e5d-9f9b-92daf5f7c96f`；同域根路径提供前端，`/api/*` 提供世界接口。
- 身份：AlterU 内通过 `/note/telegram/user/get/info/by/telegram_id` 读取 `name/head_url`；本地实验使用四名固定模拟旅人。

## 2. 目录结构

```text
src/shared-world/
  CityOfTidesShell.tsx   # 封面入口、对话式 UI、单击行动、留言、世界抽屉与详情
  engine.ts              # 确定性事件 reducer 与读模型
  gateway.ts             # Local/Remote Gateway
  useCityWorld.ts        # 身份、轮询、提交和冲突恢复
  useGrantInventory.ts   # pending 回执、个人云存档回读确认与 ack 补偿
  playerInventory.ts     # receipt_id 去重与个人行囊纯函数
  types.ts               # 世界事件、行动、视图类型
  i18n.ts                # zh/en 与本地演示文本
  useTideAudio.ts        # Web Audio 音效/环境声
  city-of-tides.less     # 单列响应式视觉系统
worker/
  index.js               # WorldRoom DO、API 路由、SQLite 事务
  bindings.json          # WORLD、生产 beta 写入和关闭 lab 控制的绑定
_qa/
  shared-world-engine.ts # 本地 reducer 测试
  interaction-shell.mjs # 封面门禁、顶部起读、单击行动和留言输入回归测试
  remote-shared-world.mjs# staging 多用户并发/三层验收
  production-backend.mjs# 生产写入/幂等/物品/举报/权限验收
  capture.mjs            # 运行画面状态截图
```

## 3. 核心模块

### 状态管理与循环

- `WorldArchive.events` 是前端可回放事件记录，`readWorld()` 推导区域值、痕迹、工程、锚点和领取回执。
- `commitWorldAction()` 校验版本、幂等键、实体状态和不同用户门槛。
- `useCityWorld()` 正常显示真实玩家；远端每 15 秒及页面重新可见时刷新。

### Gateway

- 无 API 配置：`LocalSharedWorldGateway` 把 demo archive 存入 localStorage。
- 有 `VITE_ALTERU_API_BASE` 或 `?api_base=`：`RemoteSharedWorldGateway` 先 ensure/state，再 action；版本冲突最多重试 3 次且复用同一 `action_id`。
- Remote Gateway 同时实现 pending grants 查询和 ack；Local Gateway 不伪造个人云存档。
- 正常线上构建由 `.env.production` 使用 `VITE_ALTERU_API_BASE=https://game.aiwaves.tech/1a2916b0-8751-4e5d-9f9b-92daf5f7c96f`。
- 发布路径必须使用 `games.json.uuid` / session ID，禁止使用游戏名。部署器将 `dist/` 递归编码进 Worker 静态文件表。平台通用上传接口当前只允许图片、视频、音频和 HTML，实测拒绝 ZIP，因此 Remix `zipurl` 暂时继续直接指向 GitHub 仓库归档；不伪装 MIME，也不维护自有 CDN 副本。

### 公共援助与个人行囊

- Worker 在扣减公共援助的同一事务内生成 `grant_receipt`；前端不能根据按钮点击自行增加物品。
- `useGrantInventory()` 使用 `useGameSave<CityPlayerSave>('city-of-tides-player')`，以只初始化一次的本地 mirror 作为读写真源，避免连续领取时第二次覆盖第一次。
- pending 回执先经 `playerInventory.ts` 按 `receipt_id` 幂等合并，再调用平台 `save/data`。由于平台写接口是 fire-and-forget，前端随后通过 `get/data/list` 重新读取本人存档；只有所有 receipt ID 可见后才调用 `/api/world/grant/ack`。
- 云端延迟或断网时 Worker 回执保持 pending；刷新或重新进入会再次合并，数量不会重复增加。正常模式的“世界 → 行囊”显示已确认物品和同步状态；实验身份不写真实玩家存档。

### Worker 与存储

- `WorldRoom` 以 `world_key` 选择 DO；首版正式世界为 `main`。
- SQLite 表：`world`、`world_event`、`action_result_cache`、`grant_receipt`、`report`。
- action 在同一 DO 内串行；事件、快照、回执和缓存结果在 `transactionSync` 中一次提交。
- 服务端覆盖客户端时间和数值，实行 30 秒公共写入限流、每日 20 条、每区本人最多 2 条有效痕迹。
- 过季后的第一条 ensure/state 请求由服务端自动结算最多 12 个遗漏季节；客户端不能在生产中强制结算。
- 举报表对“用户+实体”唯一；同一实体达到 3 名不同举报者后从公共快照隐藏。单用户每日最多举报 20 次。
- `/api/world/lab/reset` 与强制季节结算只在 staging `LAB_MODE=true` 可用；生产部署为 `LAB_MODE=false`。

### 屏幕适配、音频与多语言

- 首次打开只渲染封面入口；世界数据在背景加载，按钮就绪后进入主 Shell。入口状态不写公共世界，也不改变三层多人数据。
- `useGrantInventory()` 在同一个个人存档中保留 `hasEntered`，旧版已有 `_lastActive` 的存档同样视为曾进入。第二次打开时恢复弹窗提供两条路径：继续游戏把独立对话区设置为 `scrollHeight`；重新开始经确认后设置为 `scrollTop=0`。两条路径都不会修改公共世界；世界轮询与行动提交不再自动滚到底部。
- 普通快捷行动调用 `submitTrace(kind, defaultCopy)` 立即提交；`submissionRef` 与 `world.busy` 共同防止连点重复。只有 `message` 与 `replyToId` 展开 textarea，并拒绝空内容。
- 对话 DOM 固定为世界背景、当前区域（含锚点/工程）、有效痕迹；行动区在独立 footer 中显示 busy 与成功/错误反馈。
- Shell 为单列 CSS Grid，唯一列使用 `minmax(0,1fr)`；720 px 以下占满 `100dvh`。
- 对话区独立滚动，底部行动保持可见；drawer/detail 在移动端成为 bottom sheet。入口在桌面双栏、移动端纵向，正方形正式海报不做强制横裁。
- `useTideAudio()` 在首个用户手势后解锁；`i18n.ts` 自动检测 zh/en 并允许覆盖。

## 4. 扩展点

- 改题材/剧情：修改 `i18n.ts` 的区域、动作、工程和锚点文案；不要改 Gateway。
- 调数值/时效：同步修改 `engine.ts` 与 `worker/index.js` 的 TTL、效果和门槛，并补对应 QA。
- 加新公共物品：扩展 `TraceKind`、Worker grant payload 和私人存档的 receipt ack 流程。
- 换表现层：保留 `SharedWorldGateway`、`WorldArchive/WorldAction` 和三层规则，可替换 `CityOfTidesShell.tsx` 与 Less。
- 迁移平台 World API：实现新的 Gateway 并替换 API base；UI 与 reducer 无需重写。

## 5. 已知限制与生产实验边界

- 平台当前没有向自定义 Worker 暴露可验证的签名身份。为完成真实环境实验，生产后端显式配置 `PUBLIC_BETA=true`，健康检查返回 `identity_mode=unverified-production-beta`；写入仍受登录 ID、数量、TTL、幂等、每区/每日限流和三人举报隐藏约束，但这不能替代密码学身份验证。
- 平台提供签名 token/header 或验证端点后，应在 Worker 验证成功后才读取 `user_id`，随后关闭 `PUBLIC_BETA`；代码默认在 `LAB_MODE` 和 `PUBLIC_BETA` 都不是 `true` 时拒绝 action、grant、ack、report 写入。
- 部署 Skill 内含 Cloudflare 凭据，只在临时目录运行，未复制或提交到项目；正式交接应改为 secret/env 并轮换令牌。
- 当前采用“访问触发的服务端惰性季节结算”，不是定时 Alarm；无人访问时季节会在下一次访问才落账，但使用原边界时间，不改变结果。
