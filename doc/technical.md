# 《潮痕之城》技术文档

## 1. 技术栈

- 前端：React 18、TypeScript 5、Less、Vite 5，构建 `base: './'`。
- 状态：追加式共享世界事件、纯函数 reducer、每 15 秒可见态轮询；Web Audio 程序化音景。
- 远端：Cloudflare Worker、Durable Object 与 SQLite；正式前端和 API 共用永久 session ID 路径 `https://game.aiwaves.tech/1a2916b0-8751-4e5d-9f9b-92daf5f7c96f`。
- 身份与个人存档：实时读取 Aigram shell 身份；资料接口读取 `name/head_url`；`useGameSave` 保存援助回执镜像与个人进入记录。
- 自有后台寻址：`getGameApiBase()` 从 Remix 可替换的 `GAME_ID` 派生 `"/" + GAME_ID`；禁止 `.env.production` 或源码写死正式域名/旧 UUID。平台用户、排行榜、存档等 API 仍走 Aigram bridge，不使用该 base。
- 默认入口：`src/main.tsx` 直接渲染异步共享世界 `CityOfTidesShell`。个人故事引擎仍保留为未发布研究代码，不参与默认 MiniAPP/网页 bundle 入口。

## 2. 目录结构

```text
src/main.tsx                         # 默认产品入口，渲染共享世界 Shell
src/shared-world/
  CityOfTidesShell.tsx               # 封面、对话流、行动区、世界抽屉与详情
  city-of-tides.less                 # 单列移动优先布局与视觉系统
  engine.ts                          # 确定性事件 reducer 与读模型
  gateway.ts                         # Local / Remote SharedWorldGateway
  useCityWorld.ts                    # 身份、轮询、提交、冲突恢复和区域状态
  ../shared/runtime/game-api-base.ts # 从 GAME_ID 派生同 Worker API base
  useGrantInventory.ts               # pending 回执、云存档回读确认与 ack 补偿
  playerInventory.ts                 # receipt_id 去重与个人行囊纯函数
  types.ts                           # 世界事件、行动、视图与玩家类型
  i18n.ts                            # zh/en 文案和本地化键
  icons.tsx                          # 统一单线 SVG 图标
  useTideAudio.ts                    # Web Audio 音效与环境声
src/story/                           # 保留的个人冒险研究实现，不是默认产品入口
worker/
  index.js                           # WorldRoom DO、API 路由与 SQLite 事务
  bindings.json                      # WORLD、生产 beta 与 lab 绑定
_qa/
  shared-world-engine.ts             # reducer 与三层世界规则测试
  interaction-shell.mjs              # 入口、滚动与行动回归测试
  release-visual.ts                  # 默认共享入口多尺寸视觉/控制台检查
  production-backend.mjs             # 正式 API 写入、幂等、物品和举报验收
```

## 3. 核心模块

未发布的个人冒险研究引擎使用 `StorySave.version = 8`，包含 `facts` 与 `decisionContext`。模型可用 `[fact]` 持久化发现、承诺和路线选择，`worldContext.ts` 每轮把权威事实回送给续写模型；已有地点、人物、关系和事实仍只能由 reducer 提交。它不参与默认产品 bundle。

`domainRules.ts` 在危险调度与 adapter 之前处理三项返乡首选：旧路、救尼洛、登高观察。命中规则时完全跳过模型调用，本地文本、事实、数值、时钟、地图、目标、人物登场与三项后续选择原子提交；重复动作只给拒绝结果，不重复领取收益。尼洛使用 `hiddenUntilIntroduced`，只有“救人”正文成立的同一回合才进入人物存档。

### 默认入口与响应式布局

- `src/main.tsx` 静态导入 `CityOfTidesShell` 和 `city-of-tides.less`，保证 MiniAPP 与 UUID 正式主站默认打开共享世界，而不是个人故事 `StoryShell`。Pages 只验证同 commit 静态构建，不作为共享 API 运行时。
- 首次打开只渲染封面入口；共享世界数据在背景加载，按钮就绪后进入主 Shell。
- Shell 使用单列 CSS Grid；720 px 以下占满 `100dvh`，对话区独立滚动，底部行动区保持可见。
- platform-layout 按没有外部访客栏的真实平台构图验收；external-guest 只检查远程覆盖后游戏仍可操作。

### 状态管理与 Gateway

- `WorldArchive.events` 是可回放事件记录；`readWorld()` 推导区域值、有效痕迹、工程、锚点与领取回执。
- `commitWorldAction()` 校验版本、幂等键、实体状态和不同用户门槛。
- 默认通过 `getGameApiBase()` 连接 `/<GAME_ID>/api/*`；部署路由在 Worker 前剥掉 `/<GAME_ID>`，Worker 内仍处理 `/api/*`。
- `?api_base=` 只用于明确的 staging/QA 覆盖；`?local=1` 才启用 `LocalSharedWorldGateway` 的离线 demo。正式构建不读取任何 `VITE_*_API_BASE`。
- Remote Gateway 先执行 ensure/state，再提交 action；版本冲突最多重试 3 次，并复用同一个 `action_id`。
- `useCityWorld()` 在远端模式使用当前 Aigram 玩家；每 15 秒及页面重新可见时刷新世界。

### 身份、头像与个人资料

- 当前玩家 ID 在动作发生时通过 `getTelegramId()` 读取，登录态通过 `isInAigramNow()` 实时读取，避免 guest-shell 登录后沿用启动时身份。
- 当前玩家资料由 `/note/telegram/user/get/info/by/telegram_id` 读取 `data.name` 与 `data.head_url`。
- 他人痕迹由 `actor_profile` 持久化作者姓名/头像；UI 显示头像+姓名并在平台内调用 `openAigramProfile(userId)`。

### 公共援助与个人行囊

- Worker 在扣减公共援助的同一事务内生成 `grant_receipt`；前端不能自行增加物品。
- `useGrantInventory()` 使用 `useGameSave<CityPlayerSave>('city-of-tides-player')`，以只初始化一次的本地 mirror 作为读写真源。
- pending 回执按 `receipt_id` 幂等合并并写平台云存档；回读确认全部 receipt ID 后才调用 `/api/world/grant/ack`。
- 网络中断时回执保持 pending；再次进入会补偿同步且不重复增加数量。

### Worker、并发与治理

- `WorldRoom` 以 `world_key=main` 选择 Durable Object；SQLite 保存世界快照、事件、幂等缓存、领取回执和举报。
- action 在单个 DO 内串行；事件、快照、回执和缓存结果在同一事务提交。
- 服务端覆盖客户端时间与数值，并限制公共写入频率、每日条数和每区本人有效痕迹数量。
- 跨季后的第一条 ensure/state 请求惰性结算；普通客户端不能强制结算。
- 同一用户对同一实体只记一次举报，三名不同举报者使该实体退出公共快照。

### 音频与多语言

- `useTideAudio()` 在首次有效手势后解锁 Web Audio，页面隐藏时暂停。
- `i18n.ts` 自动检测 zh/en，读取 `game_locale` 覆盖并允许顶部切换。
- 普通行动即时提交；只有留言和回应展开 textarea。所有滚动容器内交互使用 `onClick`。

## 4. 扩展点

- 新增一次性潮路、救援、身份登场或互斥承诺：编辑 cartridge 的 `initialFacts / domainRules`，并同步 `_qa/domain-rules.ts`；不要只在 demo 文本或 prompt 里写数值结果。

- 改区域、动作、工程、锚点文案：编辑 `src/shared-world/i18n.ts`。
- 调数值、TTL、工程门槛：同步修改 `src/shared-world/engine.ts` 与 `worker/index.js`，并补 reducer/后端测试。
- 新增公共物品：扩展 `TraceKind`、Worker grant payload、`playerInventory.ts` 与回执 ack 流程。
- 换共享世界表现层：保留 `SharedWorldGateway`、`WorldArchive/WorldAction` 与 reducer，替换 `CityOfTidesShell.tsx` 和 Less。
- 更换游戏自有 World API：保留 `getGameApiBase()` 的 `/<GAME_ID>` 挂载合同并新增 Gateway 实现；禁止用 env 或绝对 URL 绑定源游戏 Worker。
- 平台开放 API：继续通过 `callAigramAPI()` / `postAigramAPI()` 与 `api_origin` 宿主桥接，不能与游戏自有 `API_BASE` 混用。
- 恢复或继续个人冒险研究：从 `src/story/` 单独建立明确的新产品入口；不得再次静默替换当前共享世界默认入口。
- 发布：正式多人验收以同 Worker 的 UUID 主站为准；Pages 只承担源码/静态构建镜像，不声称共享世界可写可读。Remix 后必须检查 bundle 中不含源游戏绝对 host/UUID API base。

## 5. 已知限制与生产边界

- 平台尚未向自定义 Worker 暴露可验证的签名身份。生产后端当前以受限 public beta 运行，依靠幂等、数量、TTL、限流和多人举报降低风险，但不等同于密码学验签。
- 平台提供签名 token/header 或验证端点后，应先在 Worker 验证身份，再关闭 `PUBLIC_BETA`。
- 当前季节结算由访问触发，不使用定时 Alarm；无人访问时会在下一次访问按原边界时间补结算。

## 连续性守门（2026-08-13）

- 正式入口的区域选择由 `CityOfTidesShell.tsx` 的 `pendingRegionId` 分成两步：先打开 `.ct-transit` 渡口潮图台，确认后才调用 `setSelectedRegionId()`；取消不会改变当前区域。
- `src/shared-world/i18n.ts` 维护中英双语的出发区、目的区和中转说明；快捷行动继续来自按区域穷举的 `ACTIONS`，不存在由生成文本临时塞入陌生人物或任务名的入口。
- 未发布的个人冒险研究引擎仍通过 Cartridge `transitionAnchor`、`continuity.ts` 与 reducer 执行生成选项接地和地图桥接；`_qa/continuity-gate.ts` 只证明该研究引擎，不代替默认共享世界入口的视觉验收。
