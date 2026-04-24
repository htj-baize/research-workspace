# Recommendation Runtime Protocol v0

日期：2026-04-24

## 目的

这份文档定义一版面向 agent-native 推荐系统的最小协议草案。

目标不是直接约束某个具体业务实现，而是给出一套足够小、足够稳、又能覆盖推荐闭环的公共抽象。

这版协议优先服务以下场景：

- 传统内容推荐
- agent 驱动的 next-step recommendation
- workflow recommendation
- `Studio Quest` 这类 continuation recommendation

## 设计原则

### 1. 从决策闭环出发，而不是从 `user / item / feature` 出发

协议的核心对象不是：

- 用户画像
- item 特征
- ranker 特征表

而是：

```text
Context -> Intent -> Opportunity -> Action -> Outcome
```

### 2. 稳定职责边界，不急于稳定全部字段

第一版要稳定的是对象职责，而不是完整业务 schema。

### 3. 核心协议保持薄

业务差异大的信息先通过：

- `metadata`
- domain overlay
- runtime internal logic

来承接，而不是一开始就进入核心协议。

### 4. primitive 和 high-level 并存

协议既要支持：

- 低层 runtime 能力

也要支持：

- 上层直接消费“决定下一步”的高阶接口

## 核心对象

### `Context`

回答：

> 当前决策时刻的上下文切片是什么。

它不是全量 state，而是当前推荐/决策所需的最小现实切片。

建议字段：

```ts
type Context = {
  sessionId: Id;
  userId?: Id;
  surface: string;
  focusObjectIds: Id[];
  recentEvents?: EventRef[];
  constraints?: ConstraintRef[];
  metadata?: Metadata;
};
```

字段语义：

- `sessionId`
  - 当前交互会话标识
- `userId`
  - 可选；不是所有场景都要求登录用户
- `surface`
  - 当前发生推荐/决策的界面或环境，如 `feed`、`studio`、`assistant`
- `focusObjectIds`
  - 当前最相关的对象引用，例如当前角色、当前 work、当前候选主题
- `recentEvents`
  - 最近一段值得进入决策的事件引用
- `constraints`
  - 当前生效的约束引用
- `metadata`
  - 扩展槽

### `Intent`

回答：

> 系统认为用户当前想完成什么。

建议字段：

```ts
type Intent = {
  name: string;
  confidence: number;
  horizon?: "immediate" | "session" | "longer";
  evidence?: string[];
  metadata?: Metadata;
};
```

字段语义：

- `name`
  - 当前目标的规范化名字，如 `explore`、`decide`、`continue_current_object`
- `confidence`
  - 推断置信度，范围建议为 `0..1`
- `horizon`
  - 该目标偏即时、会话级还是更长周期
- `evidence`
  - 解释 intent 的证据字符串；可选
- `metadata`
  - 扩展槽

建议的 v0 taxonomy：

```ts
type IntentName =
  | "explore"
  | "compare"
  | "decide"
  | "continue_current_object"
  | "deepen_current_object"
  | "complete_task"
  | "clarify_goal"
  | "recover_flow";
```

说明：

- `explore`
  - 用户仍在发散与寻找方向
- `compare`
  - 用户在多个候选之间比较
- `decide`
  - 用户接近做出选择
- `continue_current_object`
  - 围绕当前对象继续推进
- `deepen_current_object`
  - 围绕当前对象做更深入推进
- `complete_task`
  - 用户当前目标是完成某项任务
- `clarify_goal`
  - 系统判断当前需要先澄清目标
- `recover_flow`
  - 用户停住、断流或犹豫，需要先恢复互动流

建议：

- 核心协议稳定这 8 个名字
- 更细的领域语义通过 `metadata` 扩展，而不是直接进入核心 taxonomy

### `Opportunity`

回答：

> 当前有哪些成立的下一步机会。

这是这套协议里最关键的对象。

它不是传统意义上的 item，而是更广义的“下一步”。

建议字段：

```ts
type Opportunity = {
  id: Id;
  kind: string;
  headline: string;
  reason: string;
  sourceRefs: Id[];
  actionRef: Id;
  score?: number;
  cost?: Estimate;
  value?: Estimate;
  metadata?: Metadata;
};
```

字段语义：

- `id`
  - 当前机会的唯一标识
- `kind`
  - 机会类型，如 `item`、`continuation`、`workflow_step`
- `headline`
  - 面向上层/用户/agent 的可读标题
- `reason`
  - 为什么当前值得推这一步
- `sourceRefs`
  - 该机会依赖或来源于哪些对象
- `actionRef`
  - 选择该机会后应执行的 action 标识
- `score`
  - 可选；runtime 计算出的排序分数
- `cost`
  - 可选；弱公共抽象
- `value`
  - 可选；弱公共抽象
- `metadata`
  - 扩展槽

建议的 v0 taxonomy：

```ts
type OpportunityKind =
  | "item"
  | "content"
  | "continuation"
  | "workflow_step"
  | "tool_run"
  | "clarification"
  | "navigation";
```

说明：

- `item`
  - 标准 item 机会，如商品、视频、文章
- `content`
  - 更泛的内容单元，不要求是 catalog item
- `continuation`
  - 围绕当前对象或状态的下一步延续
- `workflow_step`
  - 某个任务流的下一步
- `tool_run`
  - 推荐直接调用工具或能力
- `clarification`
  - 推荐先问一个问题缩小空间
- `navigation`
  - 推荐跳转到另一个视图、详情或页面

建议：

- `Opportunity.kind` 保持较粗粒度
- 具体领域模式通过 `metadata` 表达，例如 `continuationMode`、`itemType`

### `Action`

回答：

> 如果选择这个机会，系统要做什么。

建议字段：

```ts
type Action = {
  id: Id;
  type: string;
  input?: Record<string, unknown>;
  requiresConfirmation?: boolean;
  metadata?: Metadata;
};
```

字段语义：

- `id`
  - action 标识
- `type`
  - action 类型，如 `show`, `open`, `execute`, `generate`, `purchase_and_run`
- `input`
  - 执行该 action 所需输入
- `requiresConfirmation`
  - 是否需要显式确认
- `metadata`
  - 扩展槽

建议的 v0 taxonomy：

```ts
type ActionType =
  | "show"
  | "open"
  | "ask"
  | "confirm"
  | "execute"
  | "generate"
  | "navigate"
  | "purchase_and_run";
```

说明：

- `show`
  - 纯展示，不立即跳转或执行
- `open`
  - 打开详情、卡片或具体对象
- `ask`
  - 通过问题澄清信息
- `confirm`
  - 进入确认层，等待用户明确同意
- `execute`
  - 执行一个通用动作
- `generate`
  - 触发内容或工件生成
- `navigate`
  - 导航到某个 surface 或区域
- `purchase_and_run`
  - 付费并立即执行

可以粗略把它们分成两类：

- 展示/交互型
  - `show`
  - `open`
  - `ask`
  - `confirm`
  - `navigate`
- 执行型
  - `execute`
  - `generate`
  - `purchase_and_run`

建议：

- v0 先在 taxonomy 上区分展示型与执行型
- 暂不把它们拆成不同协议对象

### `Outcome`

回答：

> action 发生之后，结果是什么。

建议字段：

```ts
type Outcome = {
  actionId: Id;
  status: "shown" | "accepted" | "rejected" | "executed" | "failed";
  feedbackSignals?: FeedbackSignal[];
  artifactRefs?: Id[];
  metadata?: Metadata;
};
```

字段语义：

- `actionId`
  - 对应哪个 action
- `status`
  - 结果状态
- `feedbackSignals`
  - 结果反馈信号
- `artifactRefs`
  - 结果产物引用，例如新 work、新文档、新消息
- `metadata`
  - 扩展槽

## 轻量辅助对象

### `EventRef`

代表最近事件的引用。

建议字段：

```ts
type EventRef = {
  id: Id;
  type: string;
  timestampMs: number;
  objectRefs?: Id[];
  metadata?: Metadata;
};
```

说明：

- `EventRef` 是通用 runtime 概念，不应该携带过重业务语义

### `ConstraintRef`

代表当前生效约束的引用。

建议字段：

```ts
type ConstraintRef = {
  id: Id;
  kind: string;
  value?: unknown;
  metadata?: Metadata;
};
```

说明：

- 约束可以是成本、权限、风险、surface 规则等
- 第一版不强求统一完整 taxonomy

### `Estimate`

代表成本或价值的弱公共抽象。

建议字段：

```ts
type Estimate = {
  level?: "low" | "medium" | "high";
  score?: number;
  label?: string;
  metadata?: Metadata;
};
```

说明：

- `Estimate` 是有意做薄的
- 第一版只承认“存在成本/价值信号”，不强绑定业务公式

### `FeedbackSignal`

建议字段：

```ts
type FeedbackSignal = {
  type: string;
  value?: number | string | boolean;
  metadata?: Metadata;
};
```

## Runtime Primitive 接口

这层面向底层 runtime、agent 编排层和调试用途。

```ts
interface RecommendationRuntime {
  getContext(input?: ContextQuery): Promise<Context>;
  resolveIntent(input: ResolveIntentInput): Promise<Intent>;
  listOpportunities(input: OpportunityQuery): Promise<Opportunity[]>;
  getAction(input: GetActionInput): Promise<Action>;
  executeAction(input: ExecuteActionInput): Promise<ActionExecutionResult>;
  recordOutcome(input: RecordOutcomeInput): Promise<void>;
}
```

建议语义：

- `getContext`
  - 返回当前决策需要的上下文切片
- `resolveIntent`
  - 在当前上下文上推断 intent
- `listOpportunities`
  - 基于 context 和 intent 返回一组机会
- `getAction`
  - 解析 `actionRef` 为具体 action
- `executeAction`
  - 触发 action 执行
- `recordOutcome`
  - 把结果写回 runtime / analytics / memory pipeline

## High-level 接口

这层面向上层 app、agent 和直接消费“下一步决策”的场景。

```ts
interface RecommendationSdk {
  decideNext(input?: DecideNextInput): Promise<Decision>;
  executeSelection(input: ExecuteSelectionInput): Promise<SelectionExecutionResult>;
}
```

建议语义：

- `decideNext`
  - 一步完成：
    - context 构造
    - intent 推断
    - opportunity 构造与排序
- `executeSelection`
  - 给定选择的 opportunity，完成 action 获取、执行与结果返回

## Decision 结构

```ts
type Decision = {
  context: Context;
  intent: Intent;
  opportunities: Opportunity[];
};
```

## 哪些东西先不进核心协议

第一版协议明确不尝试统一以下内容：

- 完整 state schema
- 完整 memory schema
- 完整 policy schema
- 复杂 cost model
- 复杂 value model
- 完整 taxonomy
- 完整 writeback patch 语义

这些内容要么业务差异太大，要么仍处于设计阶段，更适合通过：

- runtime internal logic
- `metadata`
- domain-specific overlay

承接。

## taxonomy 使用建议

v0 的 taxonomy 目标不是完整覆盖所有业务，而是：

- 让 runtime、SDK、policy、eval 至少能共享一层稳定语义
- 让不同业务通过 `metadata` 做轻扩展
- 避免所有团队各自发明字符串

推荐的使用方式：

```ts
intent.name = "deepen_current_object";
intent.metadata = { objectType: "character" };

opportunity.kind = "continuation";
opportunity.metadata = { continuationMode: "escalate_tension" };

action.type = "generate";
action.metadata = { outputKind: "new_work" };
```

也就是说：

- 核心 taxonomy 保持粗粒度
- 业务细节通过 `metadata` 表达
- 等跨业务稳定收敛后，再考虑把部分 overlay 升级为正式字段

## `Studio Quest` 映射示例

这套协议能直接映射到 `Studio Quest`：

- `Context`
  - 当前 `world.config + atoms + works + session`
- `Intent`
  - `continue_current_object`
  - `deepen_relationship`
  - `escalate_tension`
- `Opportunity`
  - `ContinuationOffer`
- `Action`
  - continuation confirm / generate / writeback
- `Outcome`
  - 用户接受与否
  - 生成是否成功
  - 是否写回 world

## 演进建议

建议下一步沿两个方向推进：

1. 定义 `Intent.name` 和 `Opportunity.kind` 的最小 taxonomy。
2. 讨论 `executeAction` 是否应拆分为：
   - 展示型 action
   - 执行型 action

## 总结

这版 Recommendation Runtime Protocol v0 的核心判断是：

> 下一代推荐系统的公共抽象，不应再以 `user -> item` 为核心，而应以 `context -> intent -> opportunity -> action -> outcome` 的决策闭环为核心。

这让协议既能覆盖传统推荐，也能覆盖 agent-native 推荐与 continuation recommendation。
