# 《潮痕之城》技术文档

## 1. 技术栈

- 前端：React 18、TypeScript 5、Less、Vite 5，构建基址为 `base: './'`。
- 叙事内核：模板化 `StoryCartridge`、文本协议解析器、纯函数 reducer、Aigram / demo / remote 三种 adapter。
- 玩家身份与存档：平台资料接口读取 `name/head_url`；`useGameSave` 以 `city-of-tides-v2` 为个人存档命名空间，localStorage 为平台外回退。
- 运行时内容：Aigram 连续故事接口负责扩写剧情；平台 `gen-image` 负责场景与物品图；Web Audio API 合成环境声与反馈音。
- 异步多人层：原 Cloudflare Worker、Durable Object 与 SQLite 后端继续保留，正式 session ID 为 `1a2916b0-8751-4e5d-9f9b-92daf5f7c96f`。当前 v2 序章不把公共面板放进主流程，后续在地区事件中按需读取痕迹、援助、季节工程与永久锚点。

## 2. 目录结构

```text
src/story/
  StoryShell.tsx                 # 封面、对话流、数值 HUD、行动区、世界抽屉、恢复弹窗
  story.less                     # 单列移动优先布局与响应式视觉系统
  cartridges/cityOfTides.ts     # 中英文世界观、序章状态、地图、物品与 demo 路线
  adapters/aigram.ts            # Aigram 连续故事请求与导演约束
  adapters/mock.ts              # 可复现序章演示
  adapters/remote.ts            # 已绑定 chat_id 的连续世界适配器
  engine/protocol.ts            # AI 文本协议解析
  engine/reducer.ts             # 数值、角色、同行者、地图、物品和剧情块状态更新
  engine/imageDirector.ts       # “AI 提议 + 本地导演规则兜底”的出图决策
  engine/worldContext.ts        # 完整存档上下文与同行者连续性合同
  useStoryEngine.ts             # 存档恢复、行动提交、生图队列、重试和重新开始
  usePlayerProfile.ts           # 当前玩家姓名与头像
  audio/useStoryAudio.ts        # 程序化环境声与事件提示音
src/shared-world/
  engine.ts                     # 异步共享世界事件 reducer 与读模型
  gateway.ts                    # Local / Remote 多人 Gateway
  useCityWorld.ts               # 公共世界读取、轮询、写入与冲突恢复
  useGrantInventory.ts          # 公共援助领取与个人存档回执
worker/
  index.js                      # 共享世界 API、Durable Object 与 SQLite 事务
_qa/
  city-prologue.ts              # 双语状态、尼洛连续性、序章自由度单元测试
  city-v2-browser.mjs           # 390/320/桌面真实浏览器全流程与存档恢复测试
doc/
  story.md                      # 故事圣经与章节路线
  requirements.md               # 玩法需求
  visual.md                     # 视觉与交互规范
  world-brief.json              # 可机器校验的世界合同
```

## 3. 核心模块

### 叙事状态与主循环

- `cityOfTides.ts` 是内容真源。中文和英文由同一个 `build(locale)` 生成，角色、地点、物品和选择 ID 不随语言变化。
- 初始值固定为体力 72、潮息 40、城市联结 10。`applyParsedScene()` 只接受协议允许的数值变化，并保留地图、同行者、关系和物品历史。
- `worldContext.ts` 在每次 AI 行动前传入当前目标、位置、时间、数值、所有已知人物、同行者、地图、物品、关系和最近剧情，避免模型把新人物当作新开局。尼洛加入后，除非正文明确写出离队原因，否则不能从同行者状态中消失。
- 序章 demo 是确定性验收路径，不是正式内容上限。正式模式允许玩家直接输入最多 240 字的自由行动，Aigram 从同一状态继续生成。

### 信息顺序与操作

- 首次进入先显示原生 16:9 封面与一句玩法承诺；进入后对话区保持 `scrollTop=0`，阅读顺序是世界背景 → 当前变化 → 角色回应 / 他人痕迹 → 玩家行动。
- 普通行动按钮使用 `onClick`，单击立即提交；自由行动输入框使用表单并在发送按钮 `onPointerDown` 时提交。横向选择宽度根据文字长度计算，允许滑动但不铺满整行。
- 第二次打开且 `scene > 0` 时显示“继续游戏 / 重新开始”弹窗。“继续游戏”滚到最新锚点并关闭弹窗；“重新开始”必须二次确认，再只清除本游戏世界。
- “世界”抽屉包含同行者、城市、行囊、潮记。地点和物品行均可点开查看数值、用途、限制和背景；第一次打开行囊会把缺图物品排入后台生图队列。

### 图片、声音与多语言

- 封面和开场图使用独立宽图资源。运行时场景导演 v3 保留与本轮正文一致的 AI 镜头提议，再叠加当前可见剧情、最新地点和统一画风；若提议命中返航渡轮等开场残留词，则改用本地正向场景描述。残留词只参与本地检测，不会以“禁止出现”清单再次发送给生图模型。
- 人物中近景才使用玩家头像 `ref_url`；环境、建筑、远景和空镜使用纯文字生成，避免人物参考图锁定空间构图。旧存档中未完成的 v1/v2 图片任务在恢复时升级为 v3；已完成的历史图片不自动重画。
- 出图采用“AI 提议 + 本地导演兜底”：关键发现、关系转折、显著地点变化和章节节点优先出图；较长无图间隔由本地规则补图。生图进行中不阻塞行动。
- 物品图 prompt 使用统一的潮铜、盐玻璃、深色防水织物和克制写实基调，并明确排除封面地点与人物。
- `useStoryAudio()` 在用户首次手势后解锁，用 Web Audio 合成潮声、提示、成功、失败、发现、宝物和图片显影反馈，不依赖音频文件。
- 所有界面文案走轻量 zh / en 字典；系统语言决定初始语言，玩家输入另一语言时会自动切换后续叙事语言。

### 异步共享世界

- 原多人后端不删除：`WorldRoom` 仍保存限时痕迹、公共援助、季节工程和永久锚点，并以 session ID 作为唯一世界锚点。
- v2 主线默认不展示旧版公共经营面板。接入点位于地区事件层：玩家先有完整单人目标，再在到达地点时看见最多若干条与当前场景相关的他人痕迹或可领取援助。
- Pages 镜像只承载前端；共享世界、存档和生成请求始终指向同一正式后端，不能形成第二套世界状态。

## 4. 扩展点

- 改主线章节：编辑 `src/story/cartridges/cityOfTides.ts` 与 `doc/story.md`；新增地点时同时补 `initialMap`、世界合同和序章/章节测试。
- 加地区委托或宝物：在 cartridge 增加人物、物品、地点定义，并让 AI 协议返回稳定 ID；数值上下限继续由 reducer 校验。
- 调出图节奏：修改 `engine/imageDirector.ts` 的关键事件和无图间隔规则；只换美术风格时改 cartridge 的 `sceneImageDirection` / `itemImageDirection`。
- 换题材复用模板：新增独立 cartridge，保留 StoryShell、协议、reducer、存档与 QA 合同；正式游戏仓库只注册自己的 cartridge。
- 接入多人痕迹：在地区响应中通过 `src/shared-world/gateway.ts` 查询当前区域读模型，把结果转换为叙事块；不要把公共面板重新放回主导航首页。
- 调整部署：源码仍保存在 GitHub；正式前端部署到 `game.aiwaves.tech/<session_id>/`，GitHub Pages 使用同一 commit 做镜像，`games.json.url` 只写 session ID 地址。

## 5. 当前实验边界

- 本次可玩范围是序章垂直切片，到潮钟瞭望台开放四区后保持可继续输入，不把它伪装成结局。
- 四区完整任务链、47 名失踪者的中后期线索和 Gate Zero 结局仍需按 `doc/story.md` 分章实现。
- 多人后端能力已保留，但与主线地区事件的轻量融合将在下一阶段接入；当前版本优先验证“故事本身即使没有其他玩家也足够成立”。
