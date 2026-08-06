# AlterU 异步共享世界 API 开发需求（评估稿 v0.1）

## 实现状态（2026-08-06）

- 同事提供的 `alteru-game-backend` Skill 已用于建立本游戏专属 Cloudflare Durable Object Worker。
- staging：`https://game.aiwaves.tech/city-of-tides-lab`；production beta：`https://game.aiwaves.tech/city-of-tides`。世界真源均为 DO SQLite，前端通过 Remote Gateway 接入。
- 自动验收已覆盖幂等、版本冲突、6 条上限、4 人争抢 3 份物资、pending grant 查询/ack、4 人完成工程和永久锚点。前端已实现“个人存档回读确认后才 ack”的补偿闭环。
- 生产 beta 为真实环境实验：部署 Skill 内含凭据且 CORS 反射来源，身份字段仍由客户端传入。健康接口明确返回 `identity_mode=unverified-production-beta`；生产以 `PUBLIC_BETA=true` 开放受限写入、关闭 lab 重置/强制结算，并用幂等、数量、TTL、频率和三人举报隐藏降低风险。平台提供 Worker 可验证身份后必须关闭 `PUBLIC_BETA`，改为验签后写入，并限制允许来源及轮换令牌。
- 本文后续的平台通用 API 路径仍是长期迁移目标；当前实现路由为 `/api/world/*`。

> 用途：供平台/后端同事评估“即时痕迹 → 季节变化 → 永久锚点”三层异步共享世界实验。
>
> 本稿不要求实时联机、WebSocket、房间语音、在线状态或同步战斗。所有玩家可以在不同时间进入世界。

## 1. 目标

为同一个游戏 UUID 提供一个服务器权威的公共世界，使多个已登录 AlterU 玩家能够：

1. 留下有时效的留言、警告、公共援助和环境改变。
2. 回应其他玩家，并共同推进一个有起止时间的季节工程。
3. 在季节结算后，将少量满足条件的结果晋升为永久世界锚点。
4. 在重试、双击、断网恢复和少量并发写入下，不重复扣物品、不重复计算贡献、不产生分叉世界。
5. 保留每次世界变化的作者、来源事件、版本和审核状态，以便解释、回放、隐藏或回滚。

《潮痕之城》是首个实验消费者，但接口命名和数据模型应允许后续游戏复用。

## 2. 非目标

首版不需要：

- 实时位置同步、WebSocket 或在线 presence。
- 多人即时战斗、权威物理帧或房主迁移。
- 自由创建无限世界；首个实验一个游戏只有 `world_key=main`。
- 通用 MMO 任务编辑器。
- 让大语言模型直接写数据库或直接修改公共数值。
- 在公共世界服务中保存玩家全部私密剧情、私密背包和个人偏好。

## 3. 现有接口继续承担的职责

| 能力 | 继续使用的现有接口 | 说明 |
|---|---|---|
| 玩家身份 | `/note/telegram/user/get/info/by/telegram_id` | 世界服务从登录态取得作者 ID，客户端 ID 只用于显示查询 |
| 私人进度/偏好 | `/note/aigram/ai/game/save/data` | 私人背包、已读游标、语言、声音等仍用个人存档 |
| 玩法统计 | `record/play` + `get/play/stats` | 只做分析，不作为世界状态真源 |
| AI 叙述 | `game-chat` 或候选 stateful API | 只描述已提交事件，不参与事务 |
| 通知 | 现有 notify action | 回应、季节完成、锚点入选后可通知相关玩家 |
| 图片/上传 | 现有 gen-image/upload | 生成媒体绑定已提交事件 ID，失败不回滚世界 |

新增服务只负责公共世界、事件、公共物件、季节工程和永久锚点。

## 4. 三层世界模型

### 4.1 第一层：即时痕迹

示例：留言、危险警告、临时灯火、路线标记、绳索、避雨点、公共物资箱。

- 有 `expires_at`，到期后退出正常查询和状态计算。
- 每个区域默认只返回最新 6 条有效痕迹；服务端仍保留审计记录。
- 支持回应、确认有用和贡献加固。
- 支持“所有人可使用的临时援助”和“有有限数量、需要原子领取的公共物品”。

### 4.2 第二层：季节变化

示例：本季修复灯塔、开放沉水车站、恢复市场供给。

- 有服务器定义的 `starts_at`、`ends_at` 和状态。
- 玩家行动可以向工程贡献，但同一个 `action_id` 只计算一次。
- 工程进度、参与人数和完成状态为服务器权威值。
- 季节结束时由服务端只结算一次，生成摘要并重置临时状态。

### 4.3 第三层：永久锚点

示例：永久开放一个区域、命名一处发现、建立纪念物、把一次共同工程写入世界历史。

- 不能由单个普通客户端直接创建。
- 只能由季节结算器根据已提交事件和规则生成候选并提交。
- 必须保存来源季节、贡献者和证据事件 ID。
- 可以被管理员隐藏或回滚，但审计事件不能物理消失。

## 5. 核心数据结构

字段名可以按现有后端规范调整，但语义需保留。

```ts
interface SharedWorld {
  id: string
  session_id: string          // 游戏永久 UUID
  world_key: string           // 首版固定 main
  ruleset_id: string          // city-of-tides-v1
  ruleset_version: number
  version: number             // 每次权威修改递增
  cursor: number              // 全局事件序号
  active_season_id: string
  snapshot: Record<string, unknown>
  created_at: number
  updated_at: number
}

interface WorldEvent {
  id: string
  world_id: string
  seq: number                 // 世界内严格递增
  world_version: number
  action_id: string           // 客户端 UUID，幂等键
  actor_user_id: string       // 服务端从登录态写入
  type: string
  region_id?: string
  entity_id?: string
  payload: Record<string, unknown>
  caused_by_event_ids?: string[]
  season_id: string
  visibility: 'public' | 'hidden' | 'deleted'
  created_at: number          // 服务端时间
  expires_at?: number
}

interface WorldEntity {
  id: string
  world_id: string
  kind: 'trace' | 'aid' | 'item_cache' | 'project' | 'anchor'
  region_id: string
  version: number
  state: Record<string, unknown>
  created_by_event_id: string
  expires_at?: number
  status: 'active' | 'completed' | 'expired' | 'hidden'
}

interface WorldSeason {
  id: string
  world_id: string
  sequence: number
  starts_at: number
  ends_at: number
  status: 'scheduled' | 'active' | 'resolving' | 'resolved'
  summary?: Record<string, unknown>
  resolved_by_event_id?: string
}
```

### 5.1 领取回执

单件或有限数量物品需要服务端回执，避免“公共箱扣掉了，但玩家个人存档没有写成功”。

```ts
interface GrantReceipt {
  id: string
  world_id: string
  user_id: string
  action_id: string
  source_entity_id: string
  grant: Record<string, unknown>
  created_at: number
  acknowledged_at?: number
}
```

玩家重新进入时可以读取未确认回执，并把物品恢复到私人存档。

## 6. 建议接口

路径仅为建议，可继续放在现有 `/note/aigram/ai/game/` 命名空间。

### 6.1 获取或创建游戏主世界

```http
POST /note/aigram/ai/game/world/ensure
```

```json
{
  "session_id": "<game UUID>",
  "world_key": "main",
  "ruleset_id": "city-of-tides-v1"
}
```

要求：

- `(session_id, world_key)` 唯一。
- 重复请求返回同一个 `world_id`，不能重复创建。
- 普通客户端不能更改既有 `ruleset_id`。

返回：

```json
{
  "world_id": "w_...",
  "version": 481,
  "cursor": 1297,
  "server_time": 1785992042000,
  "active_season": {
    "id": "season_12",
    "starts_at": 1785542400000,
    "ends_at": 1786147200000,
    "status": "active"
  }
}
```

### 6.2 读取世界快照与增量事件

```http
GET /note/aigram/ai/game/world/state
  ?session_id=<uuid>
  &world_id=<id>
  &after_cursor=1280
  &region_id=lighthouse
  &event_limit=50
  &trace_limit=6
```

返回：

```json
{
  "world_id": "w_...",
  "version": 481,
  "cursor": 1297,
  "server_time": 1785992042000,
  "snapshot": {
    "clock": 37,
    "regions": {
      "lighthouse": { "light": 62, "status": "recovering" }
    }
  },
  "active_season": {},
  "events": [],
  "active_traces": [],
  "projects": [],
  "anchors": [],
  "has_more_events": false
}
```

要求：

- `events` 按 `seq` 升序返回，支持游标续读。
- `active_traces` 默认由服务端过滤过期、隐藏和被屏蔽用户内容。
- `server_time` 是 TTL、季节和倒计时的唯一权威时间。
- 首屏允许按区域只取 6 条痕迹，但事件历史必须支持分页查询。

### 6.3 提交世界行动

```http
POST /note/aigram/ai/game/world/action
```

```json
{
  "session_id": "<game UUID>",
  "world_id": "w_...",
  "action_id": "client-generated-uuid",
  "expected_version": 481,
  "ruleset_version": 1,
  "type": "repair_lighthouse",
  "payload": {
    "region_id": "lighthouse",
    "message": "我把备用线路接到了第二层。",
    "target_entity_id": null
  }
}
```

成功：

```json
{
  "accepted": true,
  "duplicate": false,
  "version": 482,
  "cursor": 1298,
  "server_time": 1785992042200,
  "committed_events": [],
  "snapshot_patch": {},
  "entity_updates": [],
  "grant_receipts": []
}
```

版本冲突：

```json
{
  "accepted": false,
  "code": "VERSION_CONFLICT",
  "current_version": 483,
  "cursor": 1300,
  "retryable": true
}
```

要求：

- 唯一约束至少包含 `(world_id, action_id)`。
- 重复 `action_id` 返回第一次提交的原结果，不能再次执行 reducer。
- `actor_user_id` 必须来自平台认证上下文，忽略客户端上传的用户 ID。
- 服务端按 `ruleset_id + ruleset_version` 验证行动、消耗、TTL、状态边界和目标实体。
- AI 调用不得放在数据库事务内。先提交结构化事件，再异步生成叙述。
- 首个低流量实验可以使用世界级 `expected_version`；后续并发增加时可升级为实体级 `expected_entity_version`，接口需预留兼容空间。

### 6.4 读取并确认本人领取回执

```http
GET /note/aigram/ai/game/world/grants?session_id=<uuid>&world_id=<id>&status=pending
POST /note/aigram/ai/game/world/grant/ack
```

确认请求：

```json
{
  "session_id": "<game UUID>",
  "world_id": "w_...",
  "receipt_id": "grant_..."
}
```

领取动作本身仍通过 `/world/action` 的 `claim_item` 提交。领取数量扣减与回执创建必须在同一事务中完成。

### 6.5 查询历史与永久锚点

```http
GET /note/aigram/ai/game/world/history
  ?session_id=<uuid>
  &world_id=<id>
  &season_id=<optional>
  &before_cursor=<optional>
  &limit=50
```

用途：季节档案、永久锚点来源、管理员审计和玩家查看“为什么世界变成这样”。

### 6.6 举报公共内容

```http
POST /note/aigram/ai/game/world/report
```

```json
{
  "session_id": "<game UUID>",
  "world_id": "w_...",
  "entity_id": "trace_...",
  "reason": "harassment"
}
```

首个实验至少需要：举报、服务端隐藏、管理员恢复/删除和审计记录。普通删除不能删除底层事件，只改变可见性。

## 7. 服务端规则执行

世界服务必须先运行确定性规则，再写事件。大语言模型只能收到提交后的结果。

建议首个实验直接部署一个 `city-of-tides-v1` reducer，而不是先建设可视化通用规则编辑器。

Reducer 输入：

```ts
type ReducerInput = {
  worldSnapshot: unknown
  activeSeason: WorldSeason
  actorUserId: string
  action: {
    id: string
    type: string
    payload: unknown
  }
  serverTime: number
}
```

Reducer 输出：

```ts
type ReducerOutput = {
  accepted: boolean
  rejectionCode?: string
  events: Array<{
    type: string
    payload: unknown
    regionId?: string
    entityId?: string
    expiresAt?: number
  }>
  snapshotPatch: unknown
  entityWrites: unknown[]
  grantWrites: unknown[]
}
```

所有数值边界、物品数量、唯一作者贡献和锚点条件由 reducer 计算，禁止信任客户端上传的结果值。

## 8. 季节结算

季节结算由服务端 scheduler 或受保护的内部任务触发，不能由普通客户端按钮直接触发。

要求：

1. 基于服务器时间锁定已结束季节。
2. 使用唯一键保证同一季节只结算一次。
3. 读取该季节的权威事件和工程状态。
4. 生成季节摘要、完成工程和永久锚点候选。
5. 按 `city-of-tides-v1` 规则决定哪些候选正式晋升。
6. 追加 `season_resolved`、`anchor_committed` 等事件。
7. 创建下一季快照；临时痕迹不进入新季，永久锚点继续存在。
8. AI 摘要失败时使用确定性模板，不阻塞新季开启。

首个实验建议的永久锚点门槛：

- 季节工程达到 100%。
- 至少 5 名不同玩家产生有效贡献。
- 至少 3 名不同玩家确认或回应最终候选。
- 候选类型位于服务端白名单，例如 `unlock_region`、`name_landmark`、`build_memorial`、`preserve_history`。
- 自由留言文本不能直接成为永久世界规则；进入永久展示前需要审核或模板化处理。

具体阈值属于游戏 ruleset，不应写死在通用数据库层。

## 9. 一致性与并发要求

必须验证以下情况：

1. 同一个请求因网络重试提交 3 次，只产生 1 次事件和 1 次状态变化。
2. 两名玩家同时领取最后 1 件物品，只有 1 人成功，另一人收到明确的 `ITEM_UNAVAILABLE`。
3. 两名玩家基于同一版本推进工程，一人成功后另一人收到冲突并可重新读取后重试。
4. 请求乱序到达时，旧版本行动不能静默覆盖新状态。
5. 季节结算任务重复执行不会重复生成锚点或重复开启下一季。
6. 客户端提交伪造的 `actor_user_id`、状态增量或越界数量时被忽略/拒绝。
7. AI 超时、图片生成失败或通知失败不会回滚已经提交的世界事件。

## 10. 内容与权限

- 读取公共世界可以按产品决定是否允许平台外访客；写入必须是已认证 AlterU 用户。
- 公共自由文本首版最多 120 字，服务端限制频率和长度。
- 建议限流基线：同一用户每 30 秒最多 1 次公共写入、每天最多 20 条新痕迹、每个区域最多 2 条本人活跃痕迹；回应和领取另设较高限额。
- 需要服务端内容审核、举报、隐藏和管理员恢复。
- 被隐藏内容不进入正常快照、AI Prompt、季节工程或永久锚点计算。
- 真实玩家留言与 AI 角色台词必须在数据和 UI 中区分。
- 私密剧情、联系人秘密和个人关系数值不能写入公共事件。

## 11. 存储、压缩与保留

- 世界事件为追加式审计真源，不允许客户端覆盖整段历史。
- 世界快照是事件的缓存结果；至少每 200–500 个事件或每次季节结算生成新快照。
- 过期痕迹从正常读取中隐藏，但建议保留 90 天用于审核和问题追踪；永久锚点来源事件长期保留。
- 所有 schema 和 ruleset 都需要版本号，旧事件必须能够迁移或由旧 reducer 重放。
- 世界快照损坏时应能从最近有效快照加后续事件重建。

## 12. 性能目标

不包含 AI 和生图时间：

- 读取主世界首屏 P95 ≤ 500 ms。
- 提交普通行动 P95 ≤ 800 ms。
- 返回快照默认压缩后 ≤ 100 KB。
- 单页事件默认最多 50 条，支持游标分页。
- 世界 action 事务超时不得被包装成剧情成功；客户端收到明确失败后才能重试。

这些是实验目标，后端可根据现有基础设施调整，但需要明确实际 SLA。

## 13. AI 与媒体接入边界

推荐流程：

```text
玩家提交意图
→ World API 校验并提交结构化事件
→ 客户端立即显示确定性结果
→ AI 根据 committed event 生成叙述
→ 叙述作为非权威附件绑定 event_id
→ 生图同样绑定 event_id 原位更新
```

AI 不得：

- 直接提交世界数值补丁。
- 声称未被 reducer 接受的行动已经发生。
- 把 `thinking`、内部规则或私密用户数据写入公共事件。
- 因生成失败阻塞行动提交、季节结算或物品领取。

如果需要让所有玩家看到同一段 AI 叙述，后端可以增加受保护的 `event_attachment` 写入或内部 worker；普通客户端不能覆盖他人事件叙述。

## 14. 错误码建议

| 错误码 | 含义 | 客户端处理 |
|---|---|---|
| `WORLD_NOT_FOUND` | 世界不存在 | 重新 ensure |
| `VERSION_CONFLICT` | 基于旧版本提交 | 拉取最新状态并重新验证 |
| `DUPLICATE_ACTION` | action 已处理 | 使用首次结果，不重复显示 |
| `INVALID_ACTION` | ruleset 不允许 | 显示规则拒绝，不写剧情事实 |
| `ENTITY_NOT_FOUND` | 目标已删除或过期 | 刷新当前区域 |
| `TRACE_EXPIRED` | 回应目标已过期 | 提示潮痕已消失 |
| `ITEM_UNAVAILABLE` | 物品已被领完 | 显示后来者先到一步 |
| `RATE_LIMITED` | 写入过快 | 返回可重试时间 |
| `CONTENT_REJECTED` | 内容审核拒绝 | 保留输入供用户修改 |
| `SEASON_CLOSED` | 季节已结算 | 自动进入新季并重试合法动作 |
| `RULESET_MISMATCH` | 客户端规则版本过旧 | 要求刷新游戏版本 |

## 15. 分阶段评估范围

### Phase A：共享事件账本

必须包含：

- `world/ensure`、`world/state`、`world/action`。
- 登录身份、幂等 action ID、世界版本、事件 cursor。
- 有时效痕迹、回应、区域状态和基本审核/限流。
- 浏览器两个会话能够先后看到彼此变化。

支持：第一层真实实验，第二/第三层仍为 UI 模拟。

### Phase B：季节与公共物件

必须增加：

- WorldEntity、季节工程、有限数量物品、领取回执。
- scheduler、季节只结算一次、下一季快照。
- 工程贡献者与来源事件。

支持：第一、第二层真实实验，第三层候选生成。

### Phase C：永久锚点与运营能力

必须增加：

- 锚点白名单和服务端晋升规则。
- 永久历史查询、来源链、隐藏/回滚和管理员工具。
- 可选的共享 AI 叙述附件。

支持：完整三层真实实验。

## 16. 验收场景

后端交付时至少提供自动化或可重复的以下证据：

1. 用户 A 在灯塔留下 24 小时警告，用户 B 随后进入能读取并回应。
2. 服务端时间超过 `expires_at` 后，警告退出活跃痕迹和状态计算，但历史仍可审计。
3. 区域查询最多返回 6 条活跃痕迹，翻页历史不丢失。
4. 用户 A 与 B 同时领取剩余数量为 1 的物资，只产生一张成功回执。
5. 五名不同用户共同完成一个季节工程，重复请求不增加贡献人数。
6. 季节结束后临时状态清理，工程摘要保留，下一季正常开启。
7. 满足规则的候选只生成一个永久锚点，下一季和新设备都能读取。
8. 管理员隐藏锚点后，普通世界查询不再显示，但审计历史仍在。
9. 客户端断网重试同一 `action_id`，世界版本只增加一次。
10. AI 接口完全不可用时，以上 1–9 仍全部成立。

## 17. 需要后端同事确认的问题

1. 现有平台桥是否可以为新的 world API 复用登录鉴权，不接收客户端用户 ID？
2. 现有数据库是否适合提供事务、唯一键和递增世界版本/游标？
3. scheduler 是否已有可复用基础设施，能保证同一季节任务只执行一次？
4. 内容审核、举报和管理员隐藏是否已有平台能力可复用？
5. 是否可以为领取回执提供用户维度查询，保证跨设备恢复？
6. 世界 API 是否需要兼容 iOS fire-and-forget 桥，还是所有写入都使用有返回值的 `callAigramAPI POST`？本需求要求 action 必须返回提交结果，不能使用 fire-and-forget。
7. 首版采用世界级 `expected_version` 是否足够，还是现有并发规模需要直接做实体级版本？
8. 事件与过期公共文本的保存周期、合规删除和导出要求是什么？
9. 是否需要平台外只读访问；如果需要，身份和限流如何处理？
10. 后端希望用游戏专用 reducer，还是已有安全的通用规则执行/状态机能力？

---

评估结论建议按 Phase A / B / C 分别给出：预计工作量、可复用现有模块、主要风险、需要产品确认的决策，以及可供前端联调的最早接口合同。
